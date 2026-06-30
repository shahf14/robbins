'use client';

import type {
  AiCoachingInsight,
  CoachHandoff,
  DailyBabyStep,
  DailyReflection,
  DomainCardSummary,
  FormulationApproved,
  FormulationGateResponse,
  FormulationSession,
  Goal,
  LifeDomain,
  LifeDomainState,
  LifeContextStatus,
  Milestone,
  ReflectionAnalysis,
  WeeklyReview,
} from './types';
import type {AppLocale} from '@/i18n/config';
import {mergeLocalAuthHeaders} from '@/lib/auth/client-headers';
import {notifyLocalAuthRequired} from '@/lib/auth/local-auth-events';
import type {CuratedDailyTaskOption} from './curated-daily-tasks';
import type {DailyFocusContext} from '@/lib/daily-focus-context';
import {parseGoalCreateResponse} from './schemas';
import type {formulationSessionPatchSchema} from './schemas';
import type {z} from 'zod';
import {
  applyTodayStepUpdate,
  removeTodayStepFromSnapshot,
  writeTodayStepsSnapshot,
} from './today-steps-sync';

type GoalWithMilestones = Goal & {milestones?: Milestone[]};

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

  if (payload === null) {
    throw new LifeCoachApiError(
      'Received an invalid response from the server.',
      response.status || 0
    );
  }

  return payload;
}

async function syncTodayStepMutation<T extends {step: DailyBabyStep}>(promise: Promise<T>): Promise<T> {
  const result = await promise;
  applyTodayStepUpdate(result.step);
  return result;
}

export const lifeCoachApi = {
  listDomains() {
    return lifeCoachFetch<{domains: DomainCardSummary[]; states: LifeDomainState[]}>('/api/life-coach/domains');
  },
  getDomain(domain: LifeDomain) {
    return lifeCoachFetch<{
      domain: LifeDomain;
      state: LifeDomainState | null;
      goals: GoalWithMilestones[];
      todaySteps: DailyBabyStep[];
      recentSteps: DailyBabyStep[];
      insights: AiCoachingInsight[];
      weeklyReview: AiCoachingInsight | null;
      dailyFocus: DailyFocusContext;
    }>(`/api/life-coach/domains/${domain}`);
  },
  saveAssessment(domain: LifeDomain, input: Omit<LifeDomainState, 'id' | 'user_id' | 'domain' | 'created_at' | 'updated_at'>) {
    return lifeCoachFetch<{state: LifeDomainState}>(`/api/life-coach/domains/${domain}/assessment`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  inspireGoal(input: Record<string, unknown>) {
    return lifeCoachFetch<{inspiration: string}>('/api/life-coach/ai/inspire-goal', {
      method: 'POST',
      body: JSON.stringify({...input, mode: 'goal'}),
    });
  },
  expandText(input: Record<string, unknown>) {
    return lifeCoachFetch<{expanded: string}>('/api/life-coach/ai/expand-text', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  inspireMilestones(input: Record<string, unknown>) {
    return lifeCoachFetch<{days_30: string; days_60: string; days_90: string}>('/api/life-coach/ai/inspire-goal', {
      method: 'POST',
      body: JSON.stringify({...input, mode: 'milestones'}),
    });
  },
  structureGoal(input: Record<string, unknown>) {
    return lifeCoachFetch<{
      goal: Partial<Goal>;
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
    return payload as {goal: Goal};
  },
  createGeneralDailyTaskSeries(input: {
    domain: LifeDomain;
    title: string;
    times_per_day: number;
    target_days: number;
  }) {
    return lifeCoachFetch<{steps: DailyBabyStep[]}>('/api/life-coach/daily-steps/general-series', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  listGoals() {
    return lifeCoachFetch<{goals: GoalWithMilestones[]}>('/api/life-coach/goals');
  },
  updateGoal(id: string, input: Record<string, unknown>) {
    return lifeCoachFetch<{goal: Goal}>(`/api/life-coach/goals/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
  updateMilestoneStatus(id: string, status: 'pending' | 'completed') {
    return lifeCoachFetch<{milestone: Milestone}>(`/api/life-coach/milestones/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({status}),
    });
  },
  deleteGoal(id: string) {
    return lifeCoachFetch<{ok: boolean}>(`/api/life-coach/goals/${id}`, {
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
    const result = await lifeCoachFetch<{date: string; steps: DailyBabyStep[]}>(
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
    const result = await lifeCoachFetch<{
      date: string;
      steps: DailyBabyStep[];
      inserted: DailyBabyStep[];
    }>('/api/life-coach/curated-daily-tasks', {
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
  }) {
    return syncTodayStepMutation(
      lifeCoachFetch<{step: DailyBabyStep}>('/api/life-coach/daily-steps', {
        method: 'POST',
        body: JSON.stringify(input),
      })
    );
  },
  async getDailySteps(date: string) {
    const params = new URLSearchParams({date});
    const result = await lifeCoachFetch<{date: string; steps: DailyBabyStep[]}>(
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
  getDailyStepsRange(start: string, end: string) {
    const params = new URLSearchParams({start, end});
    return lifeCoachFetch<{start: string; end: string; steps: DailyBabyStep[]}>(
      `/api/life-coach/daily-steps?${params.toString()}`
    );
  },
  updateDailyStepStatus(id: string, input: Record<string, unknown>) {
    return syncTodayStepMutation(
      lifeCoachFetch<{step: DailyBabyStep}>(`/api/life-coach/daily-steps/${id}/status`, {
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
      lifeCoachFetch<{step: DailyBabyStep}>(`/api/life-coach/daily-steps/${id}/content`, {
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
      lifeCoachFetch<{step: DailyBabyStep}>(`/api/life-coach/daily-steps/${id}`, {
        method: 'PATCH',
        body: JSON.stringify(input),
      })
    );
  },
  suggestSkipRecovery(
    id: string,
    input: {locale?: string; blocker_reason?: string | null} = {}
  ) {
    return lifeCoachFetch<{
      content: {
        title: string;
        description: string;
        estimated_minutes: number;
        difficulty: 'easy' | 'medium' | 'hard';
      };
    }>(`/api/life-coach/daily-steps/${id}/simplify`, {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  replaceCuratedDailyStep(
    id: string,
    input: {replacement_task_id: string; locale?: AppLocale}
  ) {
    return syncTodayStepMutation(
      lifeCoachFetch<{step: DailyBabyStep}>(`/api/life-coach/daily-steps/${id}/replace-curated`, {
        method: 'POST',
        body: JSON.stringify(input),
      })
    );
  },
  rescheduleDailyStep(id: string, scheduledDate: string, rescheduledFrom?: string) {
    return syncTodayStepMutation(
      lifeCoachFetch<{step: DailyBabyStep}>(`/api/life-coach/daily-steps/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({scheduled_date: scheduledDate, rescheduled_from: rescheduledFrom}),
      })
    );
  },
  async deleteDailyStep(id: string) {
    const result = await lifeCoachFetch<{ok: boolean}>(`/api/life-coach/daily-steps/${id}`, {
      method: 'DELETE',
    });
    removeTodayStepFromSnapshot(id);
    return result;
  },
  saveSkipCoachAdjustment(input: {
    skip_date?: string;
    step_id?: string | null;
    goal_id?: string | null;
    blocker_reason?: string | null;
    coach_action: 'shrink_tomorrow' | 'change_time' | 'plan_b';
    locale?: string;
  }) {
    return lifeCoachFetch<{adjustment: import('@/lib/skip-coach-loop').SkipCoachAdjustment}>(
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
    return lifeCoachFetch<{unlock: import('@/lib/db/repositories/gamification-unlocks').GamificationUnlock | null}>(
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
    return lifeCoachFetch<{reflection: DailyReflection}>('/api/life-coach/reflections', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  analyzeReflection(input: Record<string, unknown>) {
    return lifeCoachFetch<{analysis: ReflectionAnalysis}>('/api/life-coach/ai/analyze-reflection', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  generateWeeklyReview(input: Record<string, unknown>) {
    return lifeCoachFetch<{review: WeeklyReview; insight: AiCoachingInsight}>('/api/life-coach/ai/weekly-review', {
      method: 'POST',
      body: JSON.stringify(input),
    });
  },
  getLatestWeeklyReview() {
    return lifeCoachFetch<{review: AiCoachingInsight | null}>('/api/life-coach/weekly-review/latest');
  },
  listInsights() {
    return lifeCoachFetch<{insights: AiCoachingInsight[]}>('/api/life-coach/insights');
  },
};

export const formulationApi = {
  getGate() {
    return lifeCoachFetch<{gate: FormulationGateResponse}>('/api/life-coach/formulation-sessions/gate');
  },
  getLatest() {
    return lifeCoachFetch<{draft: FormulationSession | null; completed: FormulationSession | null}>(
      '/api/life-coach/formulation-sessions/latest'
    );
  },
  create(locale?: 'he' | 'en') {
    return lifeCoachFetch<{session: FormulationSession}>('/api/life-coach/formulation-sessions', {
      method: 'POST',
      body: JSON.stringify({locale}),
    });
  },
  get(id: string) {
    return lifeCoachFetch<{session: FormulationSession}>(`/api/life-coach/formulation-sessions/${id}`);
  },
  patch(id: string, body: z.infer<typeof formulationSessionPatchSchema>) {
    return lifeCoachFetch<{session: FormulationSession}>(`/api/life-coach/formulation-sessions/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(body),
    });
  },
  complete(id: string) {
    return lifeCoachFetch<{session: FormulationSession}>(
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
    return lifeCoachFetch<{
      session?: FormulationSession;
      reflection?: string;
      questions?: FormulationSession['llm_exploration_questions'];
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
    }>(`/api/life-coach/formulation-sessions/${id}/ai`, {
      method: 'POST',
      body: JSON.stringify({action, locale}),
    });
  },
  getParticipantProfile() {
    return lifeCoachFetch<{
      gender: string | null;
      age: number | null;
      life_context_statuses: LifeContextStatus[];
      life_context_note: string | null;
      wake_time: string | null;
      sleep_time: string | null;
      preferred_action_window: import('@/lib/user-preferences').PreferredActionWindow | null;
    }>('/api/life-coach/profile');
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
    return lifeCoachFetch<{
      gender: string | null;
      age: number | null;
      life_context_statuses: LifeContextStatus[];
      life_context_note: string | null;
      wake_time: string | null;
      sleep_time: string | null;
      preferred_action_window: import('@/lib/user-preferences').PreferredActionWindow | null;
    }>('/api/life-coach/profile', {
      method: 'PATCH',
      body: JSON.stringify(input),
    });
  },
};
