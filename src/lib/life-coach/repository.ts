/**
 * Life-coach repository — backed entirely by local SQLite.
 * All functions are synchronous-under-the-hood (better-sqlite3),
 * but exposed as async to keep the call sites compatible.
 */

import {getDb, dbAll, dbGet, dbRun} from '@/lib/db/sqlite';
import {parseJsonArrayOr, parseJsonObjectOr, parseJsonOr} from '@/lib/safe-json';
import {
  getUserBehaviorProfile,
  refreshUserBehaviorProfile,
} from '@/lib/behavior-profile/repository';
import {ensurePlanBFields} from '@/lib/life-coach/plan-b';
import {clampStepReasoning} from '@/lib/life-coach/step-reasoning';
import {detectRecurringBlockers} from '@/lib/blocker-patterns/detect-recurring-blockers';
import {buildLongTermProfile, buildShortTermContext} from '@/lib/coach-memory';
import {dateDaysAgo} from '@/lib/coach-memory/data';
import {computeExecutionHistorySummary} from '@/lib/execution-history/summarize';
import {randomUUID} from 'crypto';
import {rowToGoal, rowToMilestone, upsertGoal, upsertMilestone} from '@/lib/db/repositories/goals';
import {upsertWeeklyReviewProjection} from '@/lib/db/repositories/insights';
import {
  insertFormulationSession,
  rowToFormulationSession,
  updateFormulationSession,
} from '@/lib/db/repositories/formulation-sessions';
import {
  normalizeLifeContextSelection,
  serializeLifeContextStatuses,
} from '@/lib/formulation/life-context';
import {syncSessionNarrativeFromInsights} from '@/lib/formulation/formulation-insights';
import {
  buildPassiveReflection,
  deriveConcernSummary,
  dimensionsFromRatings,
  getRatingFollowUps,
} from '@/lib/formulation/passive-ratings';
import {
  profileFromFormulationSession,
  validatePassiveRatingsForProfile,
} from '@/lib/formulation/guided-questions';
import {previousWizardPhase} from '@/lib/formulation/phase-nav';
import {evaluateRiskScreen} from '@/lib/formulation/risk-screen';
import type {z} from 'zod';
import type {
  AiCoachingInsight,
  CoachHandoff,
  DailyBabyStep,
  DailyReflection,
  DomainCardSummary,
  FormulationApproved,
  FormulationDimensions,
  FormulationGateResponse,
  FormulationSession,
  Goal,
  LifeContextStatus,
  LifeDomain,
  LifeDomainState,
  Milestone,
  StructuredDailyBabyStep,
  StructuredGoalMilestone,
} from './types';
import type {formulationSessionPatchSchema} from './schemas';
import {dateToYMD, addDaysYMD} from '@/lib/date-utils';
import {
  DEFAULT_COMMITMENT_DAYS,
  getCommitmentEndDate,
  resolveCommitmentDays,
  resolveCommitmentStart,
} from '@/lib/behavior-science/goal-commitment';
import {
  rowToInsight,
  rowToReflection,
  rowToState,
} from './repository-mappers';
import {
  listDailyBabyStepsForDate,
  listRecentDailyBabySteps,
} from './daily-step-repository';
import {listRecentReflections} from './reflection-insight-repository';
import {
  getOnboardingServerStatus,
  updateUserParticipantProfile,
} from './user-profile-repository';

export {
  createDailyBabyStep,
  deleteDailyBabyStep,
  getDailyBabyStepById,
  insertDailyBabySteps,
  listDailyBabyStepsForDate,
  listDailyBabyStepsForRange,
  listRecentDailyBabySteps,
  rescheduleDailyBabyStep,
  updateDailyBabyStepContent,
  updateDailyBabyStepStatus,
} from './daily-step-repository';

export {
  createAiInsight,
  getDailyReflectionForDate,
  getLatestWeeklyReview,
  hasWeeklyReviewForPeriod,
  listInsights,
  listRecentReflections,
  markWeeklyPlanAdjustmentsApplied,
  upsertDailyReflection,
} from './reflection-insight-repository';

export {
  deleteUserAccount,
  ensureUserProfile,
  getOnboardingServerStatus,
  getUserParticipantProfile,
  isUserOnboardingComplete,
  markUserOnboardingComplete,
  updateUserParticipantProfile,
} from './user-profile-repository';
export type {OnboardingServerStatus} from './user-profile-repository';

// ---------------------------------------------------------------------------
// Life domain states
// ---------------------------------------------------------------------------

export async function listLifeDomainStates(userId?: string): Promise<LifeDomainState[]> {
  const rows = dbAll<Record<string, unknown>>(
    userId
      ? `SELECT * FROM domain_assessments WHERE user_id = ? ORDER BY domain ASC`
      : `SELECT * FROM domain_assessments ORDER BY domain ASC`,
    userId ? [userId] : []
  );
  return rows.map(rowToState);
}

export async function getLifeDomainState(domain: LifeDomain, userId?: string): Promise<LifeDomainState | null> {
  const row = dbGet<Record<string, unknown>>(
    userId
      ? `SELECT * FROM domain_assessments WHERE domain = ? AND user_id = ?`
      : `SELECT * FROM domain_assessments WHERE domain = ?`,
    userId ? [domain, userId] : [domain]
  );
  return row ? rowToState(row) : null;
}

export async function upsertLifeDomainState(
  userId: string,
  domain: LifeDomain,
  input: Omit<LifeDomainState, 'id' | 'user_id' | 'domain' | 'created_at' | 'updated_at'>
): Promise<LifeDomainState> {
  const now = new Date().toISOString();
  const existing = dbGet<{id: string; created_at: string}>(
    `SELECT id, created_at FROM domain_assessments WHERE user_id = ? AND domain = ?`,
    [userId, domain]
  );
  const id = existing?.id ?? randomUUID();
  const created_at = existing?.created_at ?? now;

  dbRun(
    `INSERT OR REPLACE INTO domain_assessments
      (id, user_id, domain, current_score, current_state, desired_state,
       main_blockers, available_time_per_day, intensity_preference, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id, userId, domain,
      input.current_score,
      input.current_state ?? null,
      input.desired_state ?? null,
      JSON.stringify(input.main_blockers ?? []),
      input.available_time_per_day,
      input.intensity_preference,
      created_at, now,
    ]
  );

  const row = dbGet<Record<string, unknown>>(
    `SELECT * FROM domain_assessments WHERE id = ?`, [id]
  );
  return rowToState(row!);
}

export async function listGoals(
  options?: {domain?: LifeDomain; status?: Goal['status']; userId?: string}
): Promise<Goal[]> {
  let sql = `SELECT * FROM goals WHERE 1=1`;
  const params: unknown[] = [];

  if (options?.domain) {
    sql += ` AND domain = ?`;
    params.push(options.domain);
  }
  if (options?.userId) {
    sql += ` AND user_id = ?`;
    params.push(options.userId);
  }
  if (options?.status) {
    sql += ` AND status = ?`;
    params.push(options.status);
  }
  sql += ` ORDER BY updated_at DESC`;

  const rows = dbAll<Record<string, unknown>>(sql, params);
  return rows.map(rowToGoal);
}

export async function getGoalById(id: string, userId?: string): Promise<Goal | null> {
  const row = dbGet<Record<string, unknown>>(
    userId ? `SELECT * FROM goals WHERE id = ? AND user_id = ?` : `SELECT * FROM goals WHERE id = ?`,
    userId ? [id, userId] : [id]
  );
  return row ? rowToGoal(row) : null;
}

export async function listMilestonesForGoal(goalId: string, userId?: string): Promise<Milestone[]> {
  const rows = dbAll<Record<string, unknown>>(
    userId
      ? `SELECT * FROM milestones WHERE goal_id = ? AND user_id = ? ORDER BY created_at ASC`
      : `SELECT * FROM milestones WHERE goal_id = ? ORDER BY created_at ASC`,
    userId ? [goalId, userId] : [goalId]
  );
  return rows.map(rowToMilestone);
}

export async function updateMilestoneStatus(
  id: string,
  status: Milestone['status'],
  userId?: string
): Promise<Milestone> {
  const completedAt = status === 'completed' ? new Date().toISOString() : null;
  dbRun(
    userId
      ? `UPDATE milestones SET status = ?, completed_at = ? WHERE id = ? AND user_id = ?`
      : `UPDATE milestones SET status = ?, completed_at = ? WHERE id = ?`,
    userId ? [status, completedAt, id, userId] : [status, completedAt, id]
  );
  const row = dbGet<Record<string, unknown>>(
    userId ? `SELECT * FROM milestones WHERE id = ? AND user_id = ?` : `SELECT * FROM milestones WHERE id = ?`,
    userId ? [id, userId] : [id]
  );
  if (!row) throw new Error(`Milestone ${id} not found`);
  return rowToMilestone(row);
}

export async function createGoalBundle(
  userId: string,
  input: Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at'>,
  milestones: StructuredGoalMilestone[],
  initialSteps: StructuredDailyBabyStep[],
  scheduledDate: string
): Promise<Goal> {
  const now = new Date().toISOString();
  const goalId = randomUUID();
  const today = dateToYMD(new Date());
  const goal: Goal = {
    id: goalId,
    user_id: userId,
    ...input,
    commitment_days: input.commitment_days ?? DEFAULT_COMMITMENT_DAYS,
    commitment_started_at: input.commitment_started_at ?? today,
    created_at: now,
    updated_at: now,
  };

  const db = getDb();
  db.transaction(() => {
    upsertGoal(goal);

    if (milestones.length > 0) {
    const stmt = db.prepare(
      `INSERT OR REPLACE INTO milestones
        (id, goal_id, user_id, title, description, target_date, day_marker, status, created_at)
       VALUES (?,?,?,?,?,?,?,?,?)`
    );
      for (const m of milestones) {
        stmt.run(
          randomUUID(), goalId, userId, m.title, m.description ?? '',
          m.target_date ?? null, inferDayMarker(m.title), 'pending', now
        );
      }
    }

    if (initialSteps.length > 0) {
      const stmt = db.prepare(
      `INSERT OR REPLACE INTO daily_steps
        (id, user_id, goal_id, domain, title, description, estimated_minutes,
         difficulty, scheduled_date, status, generated_by_ai,
         fallback_title, fallback_description, fallback_estimated_minutes,
         reasoning, expected_resistance, pain_addressed, success_signal,
         created_at, updated_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
    );
      for (const raw of initialSteps) {
        const s = ensurePlanBFields(raw, 'he');
        stmt.run(
          randomUUID(), userId, goalId, s.domain,
          s.title, s.description ?? '', s.estimated_minutes,
          s.difficulty, scheduledDate, 'pending', 1,
          s.fallback_title ?? null,
          s.fallback_description ?? null,
          s.fallback_estimated_minutes ?? 2,
          clampStepReasoning(s.reasoning),
          s.expected_resistance ?? null,
          s.pain_addressed ?? null,
          s.success_signal ?? null,
          now, now
        );
      }
    }
  })();

  await ensureCommitmentDailySteps(userId, goal);
  return goal;
}

/** Ensures one pending step per day in the active commitment window through today. */
export async function ensureCommitmentDailySteps(userId: string, goal: Goal): Promise<number> {
  if (goal.status !== 'active') return 0;

  const start = resolveCommitmentStart(goal);
  const days = resolveCommitmentDays(goal);
  const end = getCommitmentEndDate(start, days);
  const today = dateToYMD(new Date());
  const through = end < today ? end : today;
  if (through < start) return 0;

  const db = getDb();
  const existing = dbAll<{scheduled_date: string}>(
    `SELECT scheduled_date FROM daily_steps WHERE user_id = ? AND goal_id = ? AND scheduled_date BETWEEN ? AND ?`,
    [userId, goal.id, start, through]
  );
  const existingDates = new Set(existing.map((row) => row.scheduled_date));
  const stmt = db.prepare(
    `INSERT INTO daily_steps
      (id, user_id, goal_id, domain, title, description, estimated_minutes,
       difficulty, scheduled_date, status, generated_by_ai, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?, 'pending', 0, ?, ?)`
  );
  const now = new Date().toISOString();
  let created = 0;

  for (let offset = 0; ; offset++) {
    const date = addDaysYMD(start, offset);
    if (date > through) break;
    if (existingDates.has(date)) continue;
    stmt.run(
      randomUUID(),
      userId,
      goal.id,
      goal.domain,
      goal.title,
      goal.description?.trim() || goal.success_metric?.trim() || '',
      10,
      'easy',
      date,
      now,
      now
    );
    created++;
  }

  return created;
}

function inferDayMarker(title: string): number | null {
  if (title.includes('30')) return 30;
  if (title.includes('60')) return 60;
  if (title.includes('90')) return 90;
  return null;
}

export async function updateGoal(
  id: string,
  input: Partial<Omit<Goal, 'id' | 'user_id' | 'created_at' | 'updated_at'>> & {
    renew_commitment?: boolean;
  },
  options?: {trackRevision?: boolean; userId?: string}
): Promise<Goal> {
  const now = new Date().toISOString();
  const existing = await getGoalById(id, options?.userId);

  if (!existing) throw new Error(`Goal ${id} not found`);

  const {renew_commitment: renewCommitment, ...goalPatch} = input;
  const commitmentStartedAt =
    renewCommitment === true
      ? dateToYMD(new Date())
      : goalPatch.commitment_started_at !== undefined
        ? goalPatch.commitment_started_at
        : existing.commitment_started_at ?? null;

  // Track content revisions — auto-detect if title / description / success_metric actually changed
  const contentChanged =
    (goalPatch.title !== undefined && goalPatch.title !== existing.title) ||
    (goalPatch.description !== undefined && goalPatch.description !== existing.description) ||
    (goalPatch.success_metric !== undefined && goalPatch.success_metric !== existing.success_metric);
  const revisionCount =
    (options?.trackRevision || contentChanged)
      ? (existing.revision_count ?? 0) + 1
      : (existing.revision_count ?? 0);

  // Set completed_at when transitioning to completed
  const completedAt =
    goalPatch.status === 'completed' && existing.status !== 'completed'
      ? now
      : existing.completed_at ?? null;

  // Detect abandonment before first step: goal is being archived/paused and has no completed steps
  let abandonedBeforeFirstStep = existing.abandoned_before_first_step ?? 0;
  if (
    goalPatch.status && ['archived', 'paused'].includes(goalPatch.status) &&
    existing.status === 'active' &&
    !abandonedBeforeFirstStep
  ) {
    const completedStep = dbGet<{id: string}>(
      `SELECT id FROM daily_steps WHERE goal_id = ? AND status = 'completed' LIMIT 1`,
      [id]
    );
    if (!completedStep) abandonedBeforeFirstStep = 1;
  }

  const updated: Goal = {
    ...existing,
    ...goalPatch,
    commitment_started_at: commitmentStartedAt,
    revision_count: revisionCount,
    completed_at: completedAt,
    abandoned_before_first_step: abandonedBeforeFirstStep,
    updated_at: now,
  };
  upsertGoal(updated);

  const commitmentTouched =
    renewCommitment === true ||
    goalPatch.commitment_days !== undefined ||
    goalPatch.commitment_started_at !== undefined;
  if (commitmentTouched && updated.status === 'active' && options?.userId) {
    await ensureCommitmentDailySteps(options.userId, updated);
  }

  return updated;
}

export async function deleteGoal(id: string, userId?: string): Promise<void> {
  const existing = await getGoalById(id, userId);
  if (!existing) throw new Error(`Goal ${id} not found`);
  const db = getDb();
  db.transaction(() => {
    dbRun(`DELETE FROM milestones WHERE goal_id = ?`, [id]);
    dbRun(`DELETE FROM daily_steps WHERE goal_id = ?`, [id]);
    dbRun(`DELETE FROM health_phases WHERE goal_id = ?`, [id]);
    dbRun(userId ? `DELETE FROM goals WHERE id = ? AND user_id = ?` : `DELETE FROM goals WHERE id = ?`, userId ? [id, userId] : [id]);
  })();
}

// ---------------------------------------------------------------------------
// Daily baby steps
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Daily reflections
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Composite helpers
// ---------------------------------------------------------------------------

export async function listDomainCardSummaries(userId?: string): Promise<DomainCardSummary[]> {
  const today = dateToYMD(new Date());
  const [states, goals, steps] = await Promise.all([
    listLifeDomainStates(userId),
    listGoals({status: 'active', userId}),
    listDailyBabyStepsForDate(today, userId),
  ]);
  return buildDomainCardSummaries(states, goals, steps);
}

export async function listActiveGoalUsers(): Promise<string[]> {
  const rows = dbAll<{user_id: string}>(
    `SELECT DISTINCT user_id FROM goals WHERE status = 'active'`
  );
  return rows.map((r) => r.user_id).filter(Boolean);
}

export async function getUserGenerationContext(
  userId: string
) {
  const [domainStates, goals, dailySteps, reflections] = await Promise.all([
    listLifeDomainStates(userId),
    listGoals({status: 'active', userId}),
    listRecentDailyBabySteps(21, userId),
    listRecentReflections(14, userId),
  ]);

  const normalizedGoals = goals;
  const milestonesByGoalId: Record<string, Milestone[]> = {};

  await Promise.all(
    normalizedGoals.map(async (goal: Goal) => {
      milestonesByGoalId[goal.id] = await listMilestonesForGoal(goal.id, userId);
    })
  );

  const behaviorProfile = getUserBehaviorProfile(userId);
  const recurringBlockers = detectRecurringBlockers(userId, 14);
  const executionHistory = computeExecutionHistorySummary(dailySteps, reflections, 14, userId);
  const periodStart7 = dateDaysAgo(6);
  const shortTermContext = buildShortTermContext(userId, {
    steps: dailySteps.filter((s) => s.scheduled_date >= periodStart7),
    reflections: reflections.filter((r) => r.date >= periodStart7),
    domainStates,
  });
  const longTermProfile = buildLongTermProfile(userId);

  return {
    domainStates,
    goals: normalizedGoals,
    dailySteps,
    reflections,
    milestonesByGoalId,
    behaviorProfile,
    recurringBlockers,
    executionHistory,
    shortTermContext,
    longTermProfile,
  };
}

export {detectRecurringBlockers};

// ---------------------------------------------------------------------------
// Formulation sessions
// ---------------------------------------------------------------------------

/** Clears all wizard answers on the session; keeps id, user, locale, started_at. */
function resetFormulationSessionWizardData(session: FormulationSession): void {
  const blank = emptyFormulationSession(session.user_id, session.locale);
  session.current_phase = 'consent';
  if (session.status === 'crisis_stopped') {
    session.status = 'draft';
  }
  session.life_context_status = blank.life_context_status;
  session.life_context_statuses = blank.life_context_statuses;
  session.life_context_status_note = blank.life_context_status_note;
  session.participant_gender = blank.participant_gender;
  session.participant_age = blank.participant_age;
  session.consent_accepted_at = blank.consent_accepted_at;
  session.consent_version = blank.consent_version;
  session.boundaries_ack = blank.boundaries_ack;
  session.risk_q1 = blank.risk_q1;
  session.risk_q2 = blank.risk_q2;
  session.risk_follow_up_confirmed = blank.risk_follow_up_confirmed;
  session.risk_level = blank.risk_level;
  session.risk_action = blank.risk_action;
  session.risk_screen_at = blank.risk_screen_at;
  session.presenting_concern_raw = blank.presenting_concern_raw;
  session.presenting_concern_user_words = blank.presenting_concern_user_words;
  session.reflection_llm_text = blank.reflection_llm_text;
  session.passive_ratings = blank.passive_ratings;
  session.rating_follow_ups = blank.rating_follow_ups;
  session.dimensions = blank.dimensions;
  session.formulation_draft = blank.formulation_draft;
  session.formulation_approved = blank.formulation_approved;
  session.user_edited_formulation = blank.user_edited_formulation;
  session.formulation_approved_at = blank.formulation_approved_at;
  session.coach_handoff = blank.coach_handoff;
  session.checkin_prefill = blank.checkin_prefill;
  session.phases_skipped = blank.phases_skipped;
  session.prior_question_key = blank.prior_question_key;
  session.prior_question_answer = blank.prior_question_answer;
  session.prior_question_answers = blank.prior_question_answers;
  session.llm_exploration_questions = blank.llm_exploration_questions;
  session.llm_exploration_answers = blank.llm_exploration_answers;
  session.last_ai_action = blank.last_ai_action;
  session.last_ai_tokens = blank.last_ai_tokens;
  session.last_ai_model = blank.last_ai_model;
  session.last_ai_duration_ms = blank.last_ai_duration_ms;
  session.completed_at = blank.completed_at;
  session.duration_sec = blank.duration_sec;
}

function emptyFormulationSession(userId: string, locale: 'he' | 'en'): FormulationSession {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    user_id: userId,
    locale,
    status: 'draft',
    current_phase: 'consent',
    life_context_status: null,
    life_context_statuses: [],
    life_context_status_note: null,
    participant_gender: null,
    participant_age: null,
    consent_accepted_at: null,
    consent_version: null,
    boundaries_ack: null,
    risk_q1: null,
    risk_q2: null,
    risk_follow_up_confirmed: null,
    risk_level: null,
    risk_action: null,
    risk_screen_at: null,
    presenting_concern_raw: null,
    presenting_concern_user_words: null,
    reflection_llm_text: null,
    passive_ratings: [],
    rating_follow_ups: [],
    dimensions: null,
    formulation_draft: null,
    formulation_approved: null,
    user_edited_formulation: false,
    formulation_approved_at: null,
    coach_handoff: null,
    checkin_prefill: null,
    phases_skipped: [],
    prior_question_key: null,
    prior_question_answer: null,
    prior_question_answers: [],
    llm_exploration_questions: [],
    llm_exploration_answers: [],
    last_ai_action: null,
    last_ai_tokens: null,
    last_ai_model: null,
    last_ai_duration_ms: null,
    started_at: now,
    completed_at: null,
    updated_at: now,
    duration_sec: null,
  };
}

export async function createFormulationSession(
  userId: string,
  locale: 'he' | 'en' = 'he'
): Promise<FormulationSession> {
  const existing = dbGet<Record<string, unknown>>(
    `SELECT id FROM formulation_sessions WHERE user_id = ? AND status = 'draft' LIMIT 1`,
    [userId]
  );
  if (existing) {
    const session = await getFormulationSession(userId, existing.id as string);
    if (session) return session;
  }

  const session = emptyFormulationSession(userId, locale);
  insertFormulationSession(session);
  return session;
}

export async function getFormulationSession(
  userId: string,
  id: string
): Promise<FormulationSession | null> {
  const row = dbGet<Record<string, unknown>>(
    `SELECT * FROM formulation_sessions WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  return row ? rowToFormulationSession(row) : null;
}

export async function getActiveDraftFormulation(userId: string): Promise<FormulationSession | null> {
  const row = dbGet<Record<string, unknown>>(
    `SELECT * FROM formulation_sessions WHERE user_id = ? AND status = 'draft' ORDER BY updated_at DESC LIMIT 1`,
    [userId]
  );
  return row ? rowToFormulationSession(row) : null;
}

export async function getLatestCompletedFormulation(
  userId: string
): Promise<FormulationSession | null> {
  const row = dbGet<Record<string, unknown>>(
    `SELECT * FROM formulation_sessions WHERE user_id = ? AND status = 'completed' ORDER BY completed_at DESC LIMIT 1`,
    [userId]
  );
  return row ? rowToFormulationSession(row) : null;
}

async function hasCompletedFormulation(userId: string): Promise<boolean> {
  const row = dbGet<{count: number}>(
    `SELECT COUNT(*) as count FROM formulation_sessions WHERE user_id = ? AND status = 'completed'`,
    [userId]
  );
  return (row?.count ?? 0) > 0;
}

async function userHasActiveGoals(userId: string): Promise<boolean> {
  const row = dbGet<{count: number}>(
    `SELECT COUNT(*) as count FROM goals WHERE user_id = ? AND status = 'active'`,
    [userId]
  );
  return (row?.count ?? 0) > 0;
}

export async function getFormulationGate(userId: string): Promise<FormulationGateResponse> {
  const completed = await hasCompletedFormulation(userId);
  if (completed) {
    const latest = await getLatestCompletedFormulation(userId);
    return {
      required: false,
      latest_completed_id: latest?.id ?? null,
    };
  }

  const onboarding = await getOnboardingServerStatus(userId);
  if (onboarding.completedAt) {
    return {required: false, reason: 'onboarding_complete'};
  }

  if (await userHasActiveGoals(userId)) {
    return {required: false, reason: 'has_active_goal'};
  }

  const dismissed = dbGet<{formulation_gate_dismissed: number}>(
    `SELECT formulation_gate_dismissed FROM users WHERE id = ?`,
    [userId]
  );
  if (dismissed?.formulation_gate_dismissed === 1) {
    return {required: false, reason: 'dismissed'};
  }

  const draft = await getActiveDraftFormulation(userId);
  return {
    required: true,
    reason: 'first_goal',
    draft_id: draft?.id ?? null,
  };
}

export async function patchFormulationSession(
  userId: string,
  id: string,
  patch: z.infer<typeof formulationSessionPatchSchema>
): Promise<{session: FormulationSession; risk_needs_follow_up?: boolean}> {
  const session = await getFormulationSession(userId, id);
  if (!session) {
    throw new Error('Session not found.');
  }

  const now = new Date().toISOString();
  let riskNeedsFollowUp = false;

  switch (patch.phase) {
    case 'consent': {
      const statuses = normalizeLifeContextSelection(patch.life_context_statuses);
      session.life_context_statuses = statuses;
      session.life_context_status = statuses[0] ?? null;
      session.life_context_status_note = patch.life_context_status_note ?? null;
      session.participant_gender = patch.gender ?? null;
      session.participant_age = patch.age_prefer_not ? null : (patch.age ?? null);
      session.boundaries_ack = patch.boundaries_ack;
      session.consent_version = patch.consent_version;
      session.consent_accepted_at = now;
      session.current_phase = patch.next_phase;
      await updateUserParticipantProfile(userId, {
        gender: session.participant_gender,
        age: session.participant_age,
        life_context_statuses: session.life_context_statuses,
      });
      break;
    }

    case 'risk': {
      session.risk_q1 = patch.risk_q1;
      session.risk_q2 = patch.risk_q2;
      session.risk_follow_up_confirmed =
        patch.risk_follow_up_confirmed === undefined
          ? session.risk_follow_up_confirmed
          : patch.risk_follow_up_confirmed
            ? 1
            : 0;
      if (patch.presenting_concern_raw) {
        session.presenting_concern_raw = patch.presenting_concern_raw;
      }
      const risk = evaluateRiskScreen({
        q1: patch.risk_q1,
        q2: patch.risk_q2,
        followUpConfirmed:
          patch.risk_follow_up_confirmed === undefined
            ? null
            : patch.risk_follow_up_confirmed,
        presentingConcernRaw: session.presenting_concern_raw ?? undefined,
      });
      session.risk_level = risk.level;
      session.risk_action = risk.action;
      session.risk_screen_at = now;
      riskNeedsFollowUp = risk.needsFollowUp;

      if (risk.action === 'stop') {
        session.status = 'crisis_stopped';
        session.current_phase = 'risk';
      } else {
        session.current_phase = 'open';
      }
      break;
    }

    case 'open': {
      const ratings = patch.passive_ratings;
      const profile = profileFromFormulationSession(session);
      const validation = validatePassiveRatingsForProfile(ratings, profile);
      if (!validation.ok) {
        throw new Error(
          `Invalid passive_ratings: expected ${validation.expectedIds.length} answers for this profile.`
        );
      }
      session.passive_ratings = ratings;
      const summary = deriveConcernSummary(ratings, session.locale);
      session.presenting_concern_user_words = summary;
      session.presenting_concern_raw = session.presenting_concern_raw || summary;
      session.reflection_llm_text = buildPassiveReflection(ratings, session.locale);
      session.rating_follow_ups = getRatingFollowUps(ratings, session.life_context_statuses);
      session.current_phase = patch.next_phase;
      break;
    }

    case 'dimensions':
      session.dimensions =
        patch.dimensions ??
        (session.passive_ratings.length > 0
          ? dimensionsFromRatings(session.passive_ratings)
          : session.dimensions);
      session.checkin_prefill = patch.checkin_prefill ?? session.checkin_prefill;
      if (patch.prior_question_answers?.length) {
        session.prior_question_answers = patch.prior_question_answers;
        session.prior_question_key = patch.prior_question_answers[0]?.key ?? null;
        session.prior_question_answer = patch.prior_question_answers[0]?.answer ?? null;
      } else {
        session.prior_question_key = patch.prior_question_key ?? null;
        session.prior_question_answer = patch.prior_question_answer ?? null;
        session.prior_question_answers =
          patch.prior_question_key && patch.prior_question_answer
            ? [{key: patch.prior_question_key, answer: patch.prior_question_answer}]
            : session.prior_question_answers;
      }
      if (patch.phases_skipped) {
        session.phases_skipped = [...new Set([...session.phases_skipped, ...patch.phases_skipped])];
      }
      if (patch.next_phase === 'exploration' && session.llm_exploration_questions.length === 0) {
        session.llm_exploration_answers = [];
      }
      if (session.prior_question_answers.length > 0) {
        syncSessionNarrativeFromInsights(session);
      }
      session.current_phase = patch.next_phase;
      break;

    case 'exploration':
      if (patch.llm_exploration_questions?.length === 15) {
        session.llm_exploration_questions = patch.llm_exploration_questions;
      }
      if (patch.llm_exploration_answers?.length) {
        if (session.llm_exploration_questions.length !== 15) {
          throw new Error('Exploration questions must be generated before saving answers.');
        }
        const expected = new Set(session.llm_exploration_questions.map((q) => q.id));
        if (
          patch.llm_exploration_answers.length !== 15 ||
          !patch.llm_exploration_answers.every((a) => expected.has(a.key))
        ) {
          throw new Error('All 15 exploration answers are required.');
        }
        session.llm_exploration_answers = patch.llm_exploration_answers;
        if (session.prior_question_answers.length > 0) {
          syncSessionNarrativeFromInsights(session);
        }
      }
      session.current_phase = patch.next_phase;
      break;

    case 'formulation':
      session.formulation_draft = (patch.formulation_draft as FormulationApproved) ?? session.formulation_draft;
      session.formulation_approved = (patch.formulation_approved as FormulationApproved) ?? session.formulation_approved;
      session.user_edited_formulation = patch.user_edited_formulation;
      session.formulation_approved_at = now;
      session.presenting_concern_user_words = patch.formulation_approved.presenting_concern_user_words;
      session.current_phase = patch.next_phase;
      break;

    case 'goal':
      session.coach_handoff = (patch.coach_handoff as CoachHandoff) ?? session.coach_handoff;
      session.current_phase = patch.next_phase ?? 'complete';
      break;

    case 'navigate': {
      if (session.status === 'completed') {
        throw new Error('Cannot navigate a completed session.');
      }
      if (patch.action === 'restart') {
        resetFormulationSessionWizardData(session);
      } else {
        const prev = previousWizardPhase(session.current_phase);
        if (!prev) {
          throw new Error('Already at first step.');
        }
        session.current_phase = prev;
        if (session.status === 'crisis_stopped' && prev !== 'risk') {
          session.status = 'draft';
        }
      }
      break;
    }
  }

  session.updated_at = now;
  updateFormulationSession(session);
  return {session, risk_needs_follow_up: riskNeedsFollowUp};
}

export async function completeFormulationSession(
  userId: string,
  id: string
): Promise<FormulationSession> {
  const session = await getFormulationSession(userId, id);
  if (!session) {
    throw new Error('Session not found.');
  }

  const now = new Date().toISOString();
  const started = new Date(session.started_at).getTime();
  session.status = 'completed';
  session.current_phase = 'complete';
  session.completed_at = now;
  session.updated_at = now;
  session.duration_sec = Math.max(0, Math.round((Date.now() - started) / 1000));

  updateFormulationSession(session);

  if (session.life_context_statuses.length > 0) {
    dbRun(
      `UPDATE users SET life_context_status = ?, last_completed_formulation_at = ?, updated_at = ? WHERE id = ?`,
      [serializeLifeContextStatuses(session.life_context_statuses), now, now, userId]
    );
  } else if (session.life_context_status) {
    dbRun(
      `UPDATE users SET life_context_status = ?, last_completed_formulation_at = ?, updated_at = ? WHERE id = ?`,
      [session.life_context_status, now, now, userId]
    );
  } else {
    dbRun(
      `UPDATE users SET last_completed_formulation_at = ?, updated_at = ? WHERE id = ?`,
      [now, now, userId]
    );
  }

  return session;
}

export async function updateUserLifeContexts(
  userId: string,
  statuses: LifeContextStatus[]
): Promise<void> {
  const now = new Date().toISOString();
  const normalized = normalizeLifeContextSelection(statuses);
  const stored =
    normalized.length > 0 ? serializeLifeContextStatuses(normalized) : null;
  dbRun(
    `UPDATE users SET life_context_status = ?, updated_at = ? WHERE id = ?`,
    [stored, now, userId]
  );
}

export async function updateFormulationSessionAiMetrics(
  userId: string,
  id: string,
  metrics: {
    action: string;
    tokens_used?: number;
    model_used?: string;
    generation_duration_ms?: number;
  }
): Promise<void> {
  const now = new Date().toISOString();
  dbRun(
    `UPDATE formulation_sessions SET
      last_ai_action = ?, last_ai_tokens = ?, last_ai_model = ?, last_ai_duration_ms = ?, updated_at = ?
     WHERE id = ? AND user_id = ?`,
    [
      metrics.action,
      metrics.tokens_used ?? null,
      metrics.model_used ?? null,
      metrics.generation_duration_ms ?? null,
      now,
      id,
      userId,
    ]
  );
}

export async function saveFormulationDraft(
  userId: string,
  id: string,
  draft: FormulationApproved
): Promise<FormulationSession> {
  const session = await getFormulationSession(userId, id);
  if (!session) throw new Error('Session not found.');
  session.formulation_draft = draft;
  session.updated_at = new Date().toISOString();
  updateFormulationSession(session);
  return session;
}

export async function saveFormulationExplorationQuestions(
  userId: string,
  id: string,
  questions: FormulationSession['llm_exploration_questions']
): Promise<FormulationSession> {
  const session = await getFormulationSession(userId, id);
  if (!session) throw new Error('Session not found.');
  session.llm_exploration_questions = questions;
  session.updated_at = new Date().toISOString();
  updateFormulationSession(session);
  return session;
}

// ---------------------------------------------------------------------------
// Internal
// ---------------------------------------------------------------------------

function buildDomainCardSummaries(
  states: LifeDomainState[],
  goals: Goal[],
  steps: DailyBabyStep[]
): DomainCardSummary[] {
  const byState = new Map(states.map((item) => [item.domain, item]));

  return ([
    'health', 'time', 'wealth', 'career',
    'relationships', 'mind', 'spirit', 'house_family',
  ] as const).map((domain) => {
    const domainGoals = goals.filter((goal) => goal.domain === domain);
    const domainSteps = steps.filter((step) => step.domain === domain);
    const completed = domainSteps.filter((step) => step.status === 'completed').length;
    const pending = domainSteps.filter((step) => step.status === 'pending').length;
    const mixed = domainSteps.some((step) => step.status === 'partial' || step.status === 'skipped');
    const state = byState.get(domain) ?? null;

    const todayStatus: DomainCardSummary['today_baby_step_status'] =
      domainSteps.length === 0 ? 'none'
      : pending === domainSteps.length ? 'pending'
      : completed === domainSteps.length ? 'completed'
      : mixed ? 'mixed'
      : 'pending';

    const progressPercent = state
      ? Math.round(((state.current_score - 1) / 9) * 100)
      : 0;

    return {
      domain,
      current_score: state?.current_score ?? null,
      active_goals_count: domainGoals.length,
      today_baby_step_status: todayStatus,
      progress_percent: progressPercent,
    } satisfies DomainCardSummary;
  });
}
