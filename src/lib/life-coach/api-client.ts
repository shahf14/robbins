'use client';

import type {
  CoachHandoff,
  DomainCardSummary,
  FormulationApproved,
  FormulationGateResponse,
  LifeDomain,
  LifeContextStatus,
  LifeDomainState,
  ReflectionAnalysis,
  WeeklyReview,
} from './types';
import type {
  AiCoachingInsightResponse,
  DailyBabyStepResponse,
  DailyReflectionResponse,
  FormulationSessionResponse,
  GoalResponse,
  GoalWithMilestonesResponse,
  LifeDomainStateResponse,
  MilestoneResponse,
  ParticipantProfileResponse,
} from './response-dtos';
import type {MutationSuccess} from '@/lib/api-response';
import type {AppLocale} from '@/i18n/config';
import {mergeLocalAuthHeaders} from '@/lib/auth/client-headers';
import {notifyLocalAuthRequired} from '@/lib/auth/local-auth-events';
import type {CuratedDailyTaskOption} from './curated-daily-tasks';
import type {DailyFocusContext} from '@/lib/daily-focus-context';
import {parseGoalCreateResponse, type InspireGoalResponse, type DailyStepStatusUpdateResponse, type AiGenerateDailyStepsResponse} from './schemas';
import type {formulationSessionPatchSchema} from './schemas';
import type {z} from 'zod';
import {
  applyTodayStepUpdate,
  removeTodayStepFromSnapshot,
  writeTodayStepsSnapshot,
} from './today-steps-sync';

type GoalWithMilestones = GoalWithMilestonesResponse;

const MAX_GOALS_LIMIT = 200;

export class LifeCoachApiError extends Error {
  readonly status: number;
  readonly details?: unknown;

  constructor(message: string, status: number, details?: unknown) {
    super(message);
    this.name = 'LifeCoachApiError';
    this.status = status;
    this.details = details;
  }
}

const LIFE_COACH_FETCH_TIMEOUT_MS = 20_000;

async function lifeCoachFetch<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      signal: init?.signal ?? AbortSignal.timeout(LIFE_COACH_FETCH_TIMEOUT_MS),
      headers: mergeLocalAuthHeaders(init),
    });
  } catch (error) {
    if (error instanceof TypeError) {
      throw new LifeCoachApiError('offline', 503, {offline: true});
    }
    throw error;
  }

  // The body may not be JSON (e.g. an unhandled 500 HTML page, an infra-level
  // 413/429, or an empty response). Parse defensively so we always surface a
  // LifeCoachApiError with a useful message instead of a raw SyntaxError.
  let payload: (T & {error?: string; details?: unknown}) | null = null;
  try {
    const text = await response.text();
    payload = text ? (JSON.parse(text) as T & {error?: string; details?: unknown}) : null;
  } catch {
    payload = null;
  }

  if (!response.ok) {
    const message =
      payload?.error || response.statusText || `Request failed (${response.status}).`;
    if (response.status === 401 || response.status === 403) {
      notifyLocalAuthRequired();
    }
    const nestedDetails =
      payload && typeof payload === 'object'
        ? (payload as {details?: unknown}).details
        : undefined;
    const payloadDetails =
      payload && typeof payload === 'object'
        ? (() => {
            const {error: _error, details: _details, offline, ...rest} = payload as {
              error?: string;
              details?: unknown;
              offline?: boolean;
              [key: string]: unknown;
            };
            const merged = {
              ...(nestedDetails && typeof nestedDetails === 'object' ? nestedDetails : {}),
              ...(offline ? {offline: true} : {}),
              ...rest,
            };
            return Object.keys(merged).length > 0 ? merged : undefined;
          })()
        : undefined;
    throw new LifeCoachApiError(
      message,
      response.status,
      typeof nestedDetails === 'string' ? nestedDetails : payloadDetails
    );
  }

  if (response.status === 204 || payload === null) {
    return undefined as T;
  }

  return payload;
}

async function syncTodayStepMutation<T extends {step: DailyBabyStepResponse}>(
  promise: Promise<MutationSuccess<T>>
): Promise<MutationSuccess<T>> {
  const result = await promise;
  applyTodayStepUpdate(result.step);
  return result;
}

export const lifeCoachApi = {
  listDomains() {
    return lifeCoachFetch<{domains: DomainCardSummary[]; states: LifeDomainStateResponse[]}>('/api/life-coach/domains');
  },
  getDomain(domain: LifeDomain) {
    return lifeCoachFetch<{
      domain: LifeDomain;
      state: LifeDomainStateResponse | null;
      goals: GoalWithMilestones[];
      todaySteps: DailyBabyStepResponse[];
      recentSteps: DailyBabyStepResponse[];
      insights: AiCoachingInsightResponse[];
      weeklyReview: AiCoachingInsightResponse | null;
      dailyFocus: DailyFocusContext;
    }>(`/api/life-coach/domains/${domain}`);
  },
  saveAssessment(domain: LifeDomain, input: Omit<LifeDomainState, 'id' | 'user_id' | 'domain' | 'created_at' | 'updated_at'>) {
    return lifeCoachFetch<MutationSuccess<{state: LifeDomainStateResponse}>>(`/api/life-coach/domains/${domain}/assessment`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  inspireGoal(input: Record<string, unknown>) {
    return lifeCoachFetch<InspireGoalResponse>('/api/life-coach/ai/inspire-goal', {
      method: 'POST',
      body: JSON.stringify({...input, mode: 'goal'}),
    });
  },
  expandText(input: Record<string, unknown>) {
    return lifeCoachFetch<MutationSuccess<{expanded: string}>>('/api/life-coach/ai/expand-text', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  inspireMilestones(input: Record<string, unknown>) {
    return lifeCoachFetch<InspireGoalResponse>('/api/life-coach/ai/inspire-goal', {
      method: 'POST',
      body: JSON.stringify({...input, mode: 'milestones'}),
    });
  },
  structureGoal(input: Record<string, unknown>) {
    return lifeCoachFetch<{
      goal: Partial<GoalResponse>;
      milestones: Array<{
        title: string;
        description: string;
        target_date: string | null;
      }>;
      suggested_baby_steps: Array<{
        domain: LifeDomain;
        goal_id: string | null;
        title: string;
        description: string;
        estimated_minutes: number;
        difficulty: 'easy' | 'medium' | 'hard';
      }>;
      realism_check?: import('@/lib/life-coach/types').GoalRealismCheck | null;
      next_best_action?: import('@/lib/life-coach/types').NextBestAction | null;
    }>('/api/life-coach/ai/structure-goal', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  async createGoal(input: {
    idempotency_key: string;
    formulation_session_id?: string;
    goal: Record<string, unknown>;
    milestones?: unknown[];
    initial_steps?: unknown[];
  }) {
    const payload = await lifeCoachFetch<unknown>('/api/life-coach/goals', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    parseGoalCreateResponse(payload);
    return payload as MutationSuccess<{goal: GoalResponse}>;
  },
  createGeneralDailyTaskSeries(input: {
    domain: LifeDomain;
    title: string;
    times_per_day: number;
    target_days: number;
  }) {
    return lifeCoachFetch<MutationSuccess<{steps: DailyBabyStepResponse[]}>>('/api/life-coach/daily-steps/general-series', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  listGoals(params?: {limit?: number; offset?: number}) {
    const search = new URLSearchParams();
    search.set('limit', String(params?.limit ?? MAX_GOALS_LIMIT));
    if (params?.offset !== undefined) search.set('offset', String(params.offset));
    return lifeCoachFetch<{
      goals: GoalWithMilestones[];
      limit: number;
      offset: number;
      total_count: number;
    }>(`/api/life-coach/goals?${search.toString()}`);
  },
  ensureCommitmentSteps() {
    return lifeCoachFetch<{ok: true}>('/api/life-coach/steps/ensure-commitment', {
      method: 'POST',
    });
  },
  updateGoal(id: string, input: Record<string, unknown>) {
    return lifeCoachFetch<MutationSuccess<{goal: GoalResponse}>>(`/api/life-coach/goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  updateMilestoneStatus(id: string, status: 'pending' | 'completed') {
    return lifeCoachFetch<MutationSuccess<{milestone: MilestoneResponse}>>(`/api/life-coach/milestones/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({status}),
    });
  },
  deleteGoal(id: string) {
    return lifeCoachFetch<void>(`/api/life-coach/goals/${id}`, {
      method: 'DELETE',
    });
  },
  async generateDailySteps(input: {
    date?: string;
    force?: boolean;
    domain?: LifeDomain;
    include_first_win?: boolean;
    locale?: AppLocale;
    wake_time?: string;
    sleep_time?: string;
    coaching_style?: string;
    physical_considerations?: string[];
    preferred_action_window?: string;
  }) {
    const result = await lifeCoachFetch<AiGenerateDailyStepsResponse>(
      '/api/life-coach/ai/generate-daily-steps',
      {
        method: 'POST',
        body: JSON.stringify(input),
      }
    );
    writeTodayStepsSnapshot(result.date, result.steps);
    return result;
  },
  getCuratedDailyTasks(input: {
    domain: LifeDomain;
    date: string;
    locale?: AppLocale;
  }) {
    const params = new URLSearchParams({
      domain: input.domain,
      date: input.date,
    });
    if (input.locale) params.set('locale', input.locale);
    return lifeCoachFetch<{
      domain: LifeDomain;
      date: string;
      tasks: CuratedDailyTaskOption[];
    }>(`/api/life-coach/curated-daily-tasks?${params.toString()}`);
  },
  async selectCuratedDailyTasks(input: {
    domain: LifeDomain;
    task_ids: string[];
    date: string;
    locale?: AppLocale;
  }) {
    const result = await lifeCoachFetch<
      MutationSuccess<{
        date: string;
        steps: DailyBabyStepResponse[];
        inserted: DailyBabyStepResponse[];
      }>
    >('/api/life-coach/curated-daily-tasks', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    writeTodayStepsSnapshot(result.date, result.steps);
    return result;
  },
  createDailyStep(input: {
    goal_id: string | null;
    domain: LifeDomain;
    title: string;
    description?: string;
    estimated_minutes: number;
    difficulty: 'easy' | 'medium' | 'hard';
    scheduled_date: string;
    status?: 'pending' | 'completed' | 'skipped' | 'partial';
    is_general?: boolean;
    idempotency_key?: string;
  }) {
    const idempotency_key = input.idempotency_key ?? crypto.randomUUID();
    return syncTodayStepMutation(
      lifeCoachFetch<MutationSuccess<{step: DailyBabyStepResponse}>>('/api/life-coach/daily-steps', {
        method: 'POST',
        body: JSON.stringify({...input, idempotency_key}),
      })
    );
  },
  async getDailySteps(date: string) {
    const params = new URLSearchParams({date});
    const result = await lifeCoachFetch<{date: string; steps: DailyBabyStepResponse[]}>(
      `/api/life-coach/daily-steps?${params.toString()}`
    );
    writeTodayStepsSnapshot(result.date, result.steps);
    return result;
  },
  getDailyCoachMessage(date: string, locale?: string) {
    const params = new URLSearchParams({date});
    if (locale) params.set('locale', locale);
    return lifeCoachFetch<{
      message: {
        sentence: string;
        action_framing: string;
        text: string;
        primary_step_id: string | null;
      };
    }>(`/api/life-coach/daily-coach-message?${params.toString()}`);
  },
  getDailyFocus(date?: string) {
    const path = date
      ? `/api/life-coach/daily-focus?date=${encodeURIComponent(date)}`
      : '/api/life-coach/daily-focus';
    return lifeCoachFetch<{dailyFocus: DailyFocusContext}>(path);
  },
  getDailyStepsRange(start: string, end: string, params?: {limit?: number; offset?: number}) {
    const search = new URLSearchParams({start, end});
    if (params?.limit !== undefined) search.set('limit', String(params.limit));
    if (params?.offset !== undefined) search.set('offset', String(params.offset));
    return lifeCoachFetch<{
      start: string;
      end: string;
      steps: DailyBabyStepResponse[];
      limit: number;
      offset: number;
      total_count: number;
    }>(`/api/life-coach/daily-steps?${search.toString()}`);
  },
  updateDailyStepStatus(id: string, input: Record<string, unknown>) {
    return syncTodayStepMutation(
      lifeCoachFetch<DailyStepStatusUpdateResponse>(`/api/life-coach/daily-steps/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    );
  },
  updateDailyStepContent(
    id: string,
    input: {
      title: string;
      description?: string;
      estimated_minutes: number;
      difficulty: 'easy' | 'medium' | 'hard';
    }
  ) {
    return syncTodayStepMutation(
      lifeCoachFetch<MutationSuccess<{step: DailyBabyStepResponse}>>(`/api/life-coach/daily-steps/${id}/content`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    );
  },
  updateDailyStep(
    id: string,
    input: Partial<{
      goal_id: string | null;
      domain: LifeDomain;
      title: string;
      description: string;
      estimated_minutes: number;
      difficulty: 'easy' | 'medium' | 'hard';
      scheduled_date: string;
      status: 'pending' | 'completed' | 'skipped' | 'partial';
      is_general: boolean;
    }>
  ) {
    return syncTodayStepMutation(
      lifeCoachFetch<MutationSuccess<{step: DailyBabyStepResponse}>>(`/api/life-coach/daily-steps/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    );
  },
  suggestSkipRecovery(
    id: string,
    input: {locale?: string; blocker_reason?: string | null} = {}
  ) {
    return lifeCoachFetch<MutationSuccess<{
      content: {
        title: string;
        description: string;
        estimated_minutes: number;
        difficulty: 'easy' | 'medium' | 'hard';
      };
    }>>(`/api/life-coach/daily-steps/${id}/simplify`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  replaceCuratedDailyStep(
    id: string,
    input: {replacement_task_id: string; locale?: AppLocale}
  ) {
    return syncTodayStepMutation(
      lifeCoachFetch<MutationSuccess<{step: DailyBabyStepResponse}>>(`/api/life-coach/daily-steps/${id}/replace-curated`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    );
  },
  rescheduleDailyStep(id: string, scheduledDate: string, rescheduledFrom?: string) {
    return syncTodayStepMutation(
      lifeCoachFetch<MutationSuccess<{step: DailyBabyStepResponse}>>(`/api/life-coach/daily-steps/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({scheduled_date: scheduledDate, rescheduled_from: rescheduledFrom}),
      })
    );
  },
  async deleteDailyStep(id: string) {
    await lifeCoachFetch<void>(`/api/life-coach/daily-steps/${id}`, {
      method: 'DELETE',
    });
    removeTodayStepFromSnapshot(id);
  },
  saveSkipCoachAdjustment(input: {
    skip_date?: string;
    step_id?: string | null;
    goal_id?: string | null;
    blocker_reason?: string | null;
    coach_action: 'shrink_tomorrow' | 'change_time' | 'plan_b';
    locale?: string;
  }) {
    return lifeCoachFetch<MutationSuccess<{adjustment: import('@/lib/skip-coach-loop').SkipCoachAdjustment}>>(
      '/api/life-coach/skip-coach-adjustment',
      {method: 'POST', body: JSON.stringify(input)}
    );
  },
  recordGamificationEvent(input: {
    kind: 'mystery_unlock' | 'reflection_loot' | 'identity_title';
    reward_key: string;
    week_start?: string | null;
    context?: Record<string, unknown> | null;
  }) {
    return lifeCoachFetch<MutationSuccess<{unlock: import('@/lib/db/repositories/gamification-unlocks').GamificationUnlock | null}>>(
      '/api/life-coach/gamification-unlocks',
      {method: 'POST', body: JSON.stringify(input)}
    );
  },
  listGamificationUnlocks() {
    return lifeCoachFetch<{unlocks: import('@/lib/db/repositories/gamification-unlocks').GamificationUnlock[]}>(
      '/api/life-coach/gamification-unlocks'
    );
  },
  saveReflection(input: Record<string, unknown>) {
    return lifeCoachFetch<MutationSuccess<{reflection: DailyReflectionResponse}>>('/api/life-coach/reflections', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  analyzeReflection(input: Record<string, unknown>) {
    return lifeCoachFetch<MutationSuccess<{analysis: ReflectionAnalysis}>>('/api/life-coach/ai/analyze-reflection', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  generateWeeklyReview(input: Record<string, unknown>) {
    return lifeCoachFetch<MutationSuccess<{review: WeeklyReview; insight: AiCoachingInsightResponse}>>('/api/life-coach/ai/weekly-review', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  getLatestWeeklyReview() {
    return lifeCoachFetch<{review: AiCoachingInsightResponse | null}>('/api/life-coach/weekly-review/latest');
  },
  listInsights(params?: {limit?: number; offset?: number}) {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) search.set('limit', String(params.limit));
    if (params?.offset !== undefined) search.set('offset', String(params.offset));
    const query = search.toString();
    return lifeCoachFetch<{
      insights: AiCoachingInsightResponse[];
      limit: number;
      offset: number;
      total_count: number;
    }>(query ? `/api/life-coach/insights?${query}` : '/api/life-coach/insights');
  },
};

export const formulationApi = {
  getGate() {
    return lifeCoachFetch<{gate: FormulationGateResponse}>('/api/life-coach/formulation-sessions/gate');
  },
  getLatest() {
    return lifeCoachFetch<{draft: FormulationSessionResponse | null; completed: FormulationSessionResponse | null}>(
      '/api/life-coach/formulation-sessions/latest'
    );
  },
  create(locale?: 'he' | 'en') {
    return lifeCoachFetch<MutationSuccess<{session: FormulationSessionResponse}>>('/api/life-coach/formulation-sessions', {
      method: 'POST',
      body: JSON.stringify({locale}),
    });
  },
  get(id: string) {
    return lifeCoachFetch<{session: FormulationSessionResponse}>(`/api/life-coach/formulation-sessions/${id}`);
  },
  patch(id: string, body: z.infer<typeof formulationSessionPatchSchema>) {
    return lifeCoachFetch<MutationSuccess<{session: FormulationSessionResponse}>>(`/api/life-coach/formulation-sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  complete(id: string) {
    return lifeCoachFetch<MutationSuccess<{session: FormulationSessionResponse}>>(
      `/api/life-coach/formulation-sessions/${id}/complete`,
      {method: 'POST', body: '{}'}
    );
  },
  runAi(
    id: string,
    action:
      | 'reflect'
      | 'generate_exploration_questions'
      | 'draft_formulation'
      | 'suggest_micro_goal',
    locale?: 'he' | 'en'
  ) {
    return lifeCoachFetch<
      MutationSuccess<{
        session?: FormulationSessionResponse;
        reflection?: string;
        questions?: FormulationSessionResponse['llm_exploration_questions'];
        formulation?: FormulationApproved;
        suggestions?: Partial<CoachHandoff> & {
          burning_focus?: string;
          goal_options?: Array<{
            id: string;
            goal_type: 'practical' | 'mindset' | 'freestyle';
            title: string;
            value: string;
            micro_goal_week: string;
            anticipated_barrier: string;
            plan_b: string;
          }>;
          generated_by?: 'llm';
        };
        generated_by?: 'llm';
      }>
    >(`/api/life-coach/formulation-sessions/${id}/ai`, {
      method: 'POST',
      body: JSON.stringify({action, locale}),
    });
  },
  getParticipantProfile() {
    return lifeCoachFetch<{profile: ParticipantProfileResponse}>('/api/life-coach/profile').then(
      (data) => data.profile
    );
  },
  updateParticipantProfile(input: {
    life_context_statuses?: LifeContextStatus[];
    life_context_note?: string | null;
    gender?: string | null;
    age?: number | null;
    wake_time?: string | null;
    sleep_time?: string | null;
    preferred_action_window?: import('@/lib/user-preferences').PreferredActionWindow | null;
    coaching_style?: import('@/lib/user-preferences').CoachingStyle | null;
    family_status?: import('@/lib/user-preferences').FamilyStatus | null;
    physical_considerations?: import('@/lib/user-preferences').PhysicalConsideration[] | null;
  }) {
    return lifeCoachFetch<MutationSuccess<{profile: ParticipantProfileResponse}>>('/api/life-coach/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    }).then((data) => data.profile);
  },
};
