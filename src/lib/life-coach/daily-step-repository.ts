import {randomUUID} from 'crypto';
import {getDb, dbAll, dbGet, dbRun} from '@/lib/db/sqlite';
import {refreshUserBehaviorProfile} from '@/lib/behavior-profile/repository';
import {ensurePlanBFields} from '@/lib/life-coach/plan-b';
import {clampStepReasoning} from '@/lib/life-coach/step-reasoning';
import {dateToYMD} from '@/lib/date-utils';
import {rowToStep} from './repository-mappers';
import type {DailyBabyStep, StructuredDailyBabyStep} from './types';

export class DailyStepRelationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DailyStepRelationError';
  }
}

function validateDailyStepRelation(
  userId: string,
  input: {goal_id?: string | null; domain: DailyBabyStep['domain']; is_general?: boolean | null}
): boolean {
  const isGeneral = input.is_general ?? !input.goal_id;

  if (isGeneral && input.goal_id) {
    throw new DailyStepRelationError('General daily steps cannot be linked to a goal.');
  }

  if (!isGeneral && !input.goal_id) {
    throw new DailyStepRelationError('Goal-linked daily steps must include goal_id.');
  }

  if (!input.goal_id) return isGeneral;

  const goal = dbGet<{domain: DailyBabyStep['domain']}>(
    `SELECT domain FROM goals WHERE id = ? AND user_id = ?`,
    [input.goal_id, userId]
  );
  if (!goal) {
    throw new DailyStepRelationError('daily_steps.goal_id must reference a goal owned by user_id.');
  }
  if (goal.domain !== input.domain) {
    throw new DailyStepRelationError('daily_steps.domain must match the linked goal domain.');
  }

  return false;
}

export async function listDailyBabyStepsForDate(date: string, userId?: string): Promise<DailyBabyStep[]> {
  const rows = dbAll<Record<string, unknown>>(
    userId
      ? `SELECT * FROM daily_steps WHERE scheduled_date = ? AND user_id = ? ORDER BY created_at ASC`
      : `SELECT * FROM daily_steps WHERE scheduled_date = ? ORDER BY created_at ASC`,
    userId ? [date, userId] : [date]
  );
  return rows.map(rowToStep);
}

export async function listDailyBabyStepsForRange(
  startDate: string,
  endDate: string,
  userId?: string
): Promise<DailyBabyStep[]> {
  const rows = dbAll<Record<string, unknown>>(
    userId
      ? `SELECT * FROM daily_steps WHERE scheduled_date >= ? AND scheduled_date <= ? AND user_id = ? ORDER BY scheduled_date ASC, created_at ASC`
      : `SELECT * FROM daily_steps WHERE scheduled_date >= ? AND scheduled_date <= ? ORDER BY scheduled_date ASC, created_at ASC`,
    userId ? [startDate, endDate, userId] : [startDate, endDate]
  );
  return rows.map(rowToStep);
}

export async function listRecentDailyBabySteps(limit = 21, userId?: string): Promise<DailyBabyStep[]> {
  const rows = dbAll<Record<string, unknown>>(
    userId
      ? `SELECT * FROM daily_steps WHERE user_id = ? ORDER BY scheduled_date DESC LIMIT ?`
      : `SELECT * FROM daily_steps ORDER BY scheduled_date DESC LIMIT ?`,
    userId ? [userId, limit] : [limit]
  );
  return rows.map(rowToStep);
}

export async function createDailyBabyStep(
  userId: string,
  input: Pick<
    DailyBabyStep,
    | 'goal_id'
    | 'domain'
    | 'title'
    | 'description'
    | 'estimated_minutes'
    | 'difficulty'
    | 'scheduled_date'
    | 'status'
    | 'generated_by_ai'
  > &
    Partial<
      Pick<
        DailyBabyStep,
        | 'is_general'
        | 'reasoning'
        | 'expected_resistance'
        | 'pain_addressed'
        | 'success_signal'
        | 'fallback_title'
        | 'fallback_description'
        | 'fallback_estimated_minutes'
        | 'validation_fallback_applied'
      >
    >
): Promise<DailyBabyStep> {
  const now = new Date().toISOString();
  const completedAt = input.status === 'completed' ? now : null;
  const id = randomUUID();
  const isGeneral = validateDailyStepRelation(userId, input);

  dbRun(
    `INSERT INTO daily_steps
      (id, user_id, goal_id, domain, title, description, estimated_minutes,
       difficulty, scheduled_date, status, generated_by_ai, is_general, completed_at,
       fallback_title, fallback_description, fallback_estimated_minutes,
       reasoning, expected_resistance, pain_addressed, success_signal,
       validation_fallback_applied, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      userId,
      input.goal_id ?? null,
      input.domain,
      input.title,
      input.description ?? '',
      input.estimated_minutes,
      input.difficulty,
      input.scheduled_date,
      input.status,
      input.generated_by_ai ? 1 : 0,
      isGeneral ? 1 : 0,
      completedAt,
      input.fallback_title ?? null,
      input.fallback_description ?? null,
      input.fallback_estimated_minutes ?? null,
      clampStepReasoning(input.reasoning),
      input.expected_resistance ?? null,
      input.pain_addressed ?? null,
      input.success_signal ?? null,
      input.validation_fallback_applied ? 1 : 0,
      now,
      now,
    ]
  );

  const row = dbGet<Record<string, unknown>>(`SELECT * FROM daily_steps WHERE id = ?`, [id]);
  if (!row) throw new Error(`Daily step ${id} was not created`);
  return rowToStep(row);
}

export async function insertDailyBabySteps(
  userId: string,
  date: string,
  steps: StructuredDailyBabyStep[],
  locale: import('@/i18n/config').AppLocale = 'he',
  coachTone: import('@/lib/user-preferences').CoachingStyle | null = null,
  options?: {domainScope?: import('@/lib/life-coach/types').LifeDomain}
): Promise<DailyBabyStep[]> {
  if (steps.length === 0) return [];
  const now = new Date().toISOString();
  const db = getDb();
  const stmt = db.prepare(
    `INSERT OR REPLACE INTO daily_steps
      (id, user_id, goal_id, domain, title, description, estimated_minutes,
       difficulty, scheduled_date, status, generated_by_ai, is_general,
       fallback_title, fallback_description, fallback_estimated_minutes,
       reasoning, expected_resistance, pain_addressed, success_signal, validation_fallback_applied,
       coach_tone, weekly_focus_id, created_at, updated_at)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`
  );
  const clearStmt = options?.domainScope
    ? db.prepare(
        `DELETE FROM daily_steps
         WHERE user_id = ? AND scheduled_date = ? AND generated_by_ai = 1 AND status = 'pending'
           AND domain = ?`
      )
    : db.prepare(
        `DELETE FROM daily_steps
         WHERE user_id = ? AND scheduled_date = ? AND generated_by_ai = 1 AND status = 'pending'`
      );

  const inserted: DailyBabyStep[] = [];
  db.transaction((items: StructuredDailyBabyStep[]) => {
    if (options?.domainScope) {
      clearStmt.run(userId, date, options.domainScope);
    } else {
      clearStmt.run(userId, date);
    }
    for (const raw of items) {
      const s = ensurePlanBFields(raw, locale);
      const isGeneral = validateDailyStepRelation(userId, s);
      const id = randomUUID();
      stmt.run(
        id, userId, s.goal_id ?? null, s.domain,
        s.title, s.description ?? '', s.estimated_minutes,
        s.difficulty, date, 'pending', 1, isGeneral ? 1 : 0,
        s.fallback_title ?? null,
        s.fallback_description ?? null,
        s.fallback_estimated_minutes ?? 2,
        clampStepReasoning(s.reasoning),
        s.expected_resistance ?? null,
        s.pain_addressed ?? null,
        s.success_signal ?? null,
        s.validation_fallback_applied ? 1 : 0,
        coachTone,
        s.weekly_focus_id ?? null,
        now, now
      );
      inserted.push({
        id, user_id: userId, goal_id: s.goal_id ?? null,
        is_general: isGeneral,
        domain: s.domain, title: s.title, description: s.description ?? '',
        estimated_minutes: s.estimated_minutes, difficulty: s.difficulty,
        scheduled_date: date, status: 'pending', generated_by_ai: true,
        fallback_title: s.fallback_title ?? null,
        fallback_description: s.fallback_description ?? null,
        fallback_estimated_minutes: s.fallback_estimated_minutes ?? 2,
        reasoning: s.reasoning ?? null,
        expected_resistance: s.expected_resistance ?? null,
        pain_addressed: s.pain_addressed ?? null,
        success_signal: s.success_signal ?? null,
        user_edited: false,
        validation_fallback_applied: !!s.validation_fallback_applied,
        coach_tone: coachTone,
        weekly_focus_id: s.weekly_focus_id ?? null,
        created_at: now, updated_at: now,
      });
    }
  })(steps);

  return inserted;
}

export async function updateDailyBabyStepStatus(
  id: string,
  input: Pick<DailyBabyStep, 'status'> & {
    actual_minutes?: number | null;
    blocker_category?: DailyBabyStep['blocker_category'];
    first_viewed_at?: string;
    coach_message_impression_at?: string;
    primary_cta_clicked_at?: string;
    read_description?: boolean;
    reflection_text?: string | null;
    blocker_reason?: DailyBabyStep['blocker_reason'];
    value_feedback?: DailyBabyStep['value_feedback'];
  },
  userId?: string
): Promise<DailyBabyStep> {
  const now = new Date().toISOString();
  // Detect reattempt: was the step previously skipped/partial today?
  const current = dbGet<{status: string; scheduled_date: string; completed_at: string | null}>(
    userId
      ? `SELECT status, scheduled_date, completed_at FROM daily_steps WHERE id = ? AND user_id = ?`
      : `SELECT status, scheduled_date, completed_at FROM daily_steps WHERE id = ?`,
    userId ? [id, userId] : [id]
  );
  const completedAt =
    input.status === 'completed'
      ? current?.completed_at ?? now
      : null;
  const today = dateToYMD(new Date());
  const isReattempt =
    current &&
    (current.status === 'skipped' || current.status === 'partial') &&
    current.scheduled_date === today
      ? 1 : 0;

  dbRun(
    `UPDATE daily_steps
     SET status = ?, updated_at = ?, completed_at = ?,
         actual_minutes = COALESCE(?, actual_minutes),
         blocker_category = COALESCE(?, blocker_category),
         reflection_text = COALESCE(?, reflection_text),
         blocker_reason = COALESCE(?, blocker_reason),
         value_feedback = COALESCE(?, value_feedback),
         reattempt_same_day = CASE WHEN ? = 1 THEN 1 ELSE reattempt_same_day END,
         first_viewed_at = COALESCE(first_viewed_at, ?),
         coach_message_impression_at = COALESCE(coach_message_impression_at, ?),
         primary_cta_clicked_at = COALESCE(primary_cta_clicked_at, ?),
         read_description = CASE WHEN ? = 1 THEN 1 ELSE read_description END
     WHERE id = ?${userId ? ' AND user_id = ?' : ''}`,
    [
      input.status, now, completedAt,
      input.actual_minutes ?? null,
      input.blocker_category ?? null,
      input.reflection_text ?? null,
      input.blocker_reason ?? null,
      input.value_feedback ?? null,
      isReattempt,
      input.first_viewed_at ?? null,
      input.coach_message_impression_at ?? null,
      input.primary_cta_clicked_at ?? null,
      input.read_description ? 1 : 0,
      id,
      ...(userId ? [userId] : []),
    ]
  );
  const row = dbGet<Record<string, unknown>>(
    userId ? `SELECT * FROM daily_steps WHERE id = ? AND user_id = ?` : `SELECT * FROM daily_steps WHERE id = ?`,
    userId ? [id, userId] : [id]
  );
  if (!row) throw new Error(`Step ${id} not found`);
  const updated = rowToStep(row);
  if (userId) {
    try {
      refreshUserBehaviorProfile(userId);
    } catch {
      /* best-effort */
    }
  }
  return updated;
}

export function getDailyBabyStepById(id: string, userId?: string): DailyBabyStep | null {
  const row = dbGet<Record<string, unknown>>(
    userId
      ? `SELECT * FROM daily_steps WHERE id = ? AND user_id = ?`
      : `SELECT * FROM daily_steps WHERE id = ?`,
    userId ? [id, userId] : [id]
  );
  return row ? rowToStep(row) : null;
}

export async function updateDailyBabyStepContent(
  id: string,
  input: Pick<DailyBabyStep, 'title' | 'description' | 'estimated_minutes' | 'difficulty'>,
  userId?: string
): Promise<DailyBabyStep> {
  const now = new Date().toISOString();

  dbRun(
    `UPDATE daily_steps
     SET title = ?, description = ?, estimated_minutes = ?, difficulty = ?,
         user_edited = 1, updated_at = ?
     WHERE id = ?${userId ? ' AND user_id = ?' : ''}`,
    [
      input.title,
      input.description ?? '',
      input.estimated_minutes,
      input.difficulty,
      now,
      id,
      ...(userId ? [userId] : []),
    ]
  );

  const row = dbGet<Record<string, unknown>>(
    userId ? `SELECT * FROM daily_steps WHERE id = ? AND user_id = ?` : `SELECT * FROM daily_steps WHERE id = ?`,
    userId ? [id, userId] : [id]
  );
  if (!row) throw new Error(`Step ${id} not found`);
  return rowToStep(row);
}

export async function updateDailyBabyStep(
  id: string,
  input: Partial<
    Pick<
      DailyBabyStep,
      | 'goal_id'
      | 'domain'
      | 'title'
      | 'description'
      | 'estimated_minutes'
      | 'difficulty'
      | 'scheduled_date'
      | 'status'
      | 'is_general'
    >
  > & {rescheduled_from?: string | null},
  userId?: string
): Promise<DailyBabyStep> {
  const existing = getDailyBabyStepById(id, userId);
  if (!existing) throw new Error(`Step ${id} not found`);

  const next: DailyBabyStep = {
    ...existing,
    ...input,
    goal_id: input.goal_id !== undefined ? input.goal_id : existing.goal_id,
    description: input.description !== undefined ? input.description : existing.description,
  };
  const isGeneral = validateDailyStepRelation(next.user_id, {
    goal_id: next.goal_id,
    domain: next.domain,
    is_general: next.is_general,
  });
  const now = new Date().toISOString();
  const dateChanged =
    input.scheduled_date !== undefined && input.scheduled_date !== existing.scheduled_date;
  const completedAt =
    next.status === 'completed'
      ? existing.completed_at ?? now
      : next.status === existing.status
        ? existing.completed_at ?? null
        : null;

  dbRun(
    `UPDATE daily_steps
     SET goal_id = ?, domain = ?, title = ?, description = ?,
         estimated_minutes = ?, difficulty = ?, scheduled_date = ?, status = ?,
         is_general = ?, completed_at = ?, user_edited = 1, updated_at = ?,
         rescheduled_from = CASE WHEN ? = 1 THEN COALESCE(rescheduled_from, ?) ELSE rescheduled_from END,
         reschedule_count = CASE WHEN ? = 1 THEN reschedule_count + 1 ELSE reschedule_count END
     WHERE id = ?${userId ? ' AND user_id = ?' : ''}`,
    [
      next.goal_id ?? null,
      next.domain,
      next.title,
      next.description ?? '',
      next.estimated_minutes,
      next.difficulty,
      next.scheduled_date,
      next.status,
      isGeneral ? 1 : 0,
      completedAt,
      now,
      dateChanged ? 1 : 0,
      input.rescheduled_from ?? existing.scheduled_date,
      dateChanged ? 1 : 0,
      id,
      ...(userId ? [userId] : []),
    ]
  );

  const row = dbGet<Record<string, unknown>>(
    userId ? `SELECT * FROM daily_steps WHERE id = ? AND user_id = ?` : `SELECT * FROM daily_steps WHERE id = ?`,
    userId ? [id, userId] : [id]
  );
  if (!row) throw new Error(`Step ${id} not found`);
  return rowToStep(row);
}

export async function replaceDailyBabyStepWithCuratedContent(
  id: string,
  input: Pick<
    DailyBabyStep,
    'title' | 'description' | 'estimated_minutes' | 'difficulty'
  > &
    Pick<DailyBabyStep, 'reasoning' | 'pain_addressed' | 'success_signal'>,
  userId?: string
): Promise<DailyBabyStep> {
  const now = new Date().toISOString();

  dbRun(
    `UPDATE daily_steps
     SET title = ?, description = ?, estimated_minutes = ?, difficulty = ?,
         reasoning = ?, pain_addressed = ?, success_signal = ?,
         expected_resistance = NULL,
         fallback_title = NULL,
         fallback_description = NULL,
         fallback_estimated_minutes = NULL,
         validation_fallback_applied = 0,
         user_edited = 0,
         updated_at = ?
     WHERE id = ?${userId ? ' AND user_id = ?' : ''}`,
    [
      input.title,
      input.description ?? '',
      input.estimated_minutes,
      input.difficulty,
      clampStepReasoning(input.reasoning),
      input.pain_addressed ?? null,
      input.success_signal ?? null,
      now,
      id,
      ...(userId ? [userId] : []),
    ]
  );

  const row = dbGet<Record<string, unknown>>(
    userId ? `SELECT * FROM daily_steps WHERE id = ? AND user_id = ?` : `SELECT * FROM daily_steps WHERE id = ?`,
    userId ? [id, userId] : [id]
  );
  if (!row) throw new Error(`Step ${id} not found`);
  return rowToStep(row);
}

export async function rescheduleDailyBabyStep(
  id: string,
  newDate: string,
  rescheduledFrom?: string,
  userId?: string
): Promise<DailyBabyStep> {
  const now = new Date().toISOString();
  // Capture original date on first reschedule; increment reschedule_count each time
  dbRun(
    `UPDATE daily_steps
     SET scheduled_date = ?, status = 'pending', updated_at = ?,
         rescheduled_from = COALESCE(rescheduled_from, ?),
         reschedule_count = reschedule_count + 1
     WHERE id = ?${userId ? ' AND user_id = ?' : ''}`,
    [newDate, now, rescheduledFrom ?? null, id, ...(userId ? [userId] : [])]
  );
  const row = dbGet<Record<string, unknown>>(
    userId ? `SELECT * FROM daily_steps WHERE id = ? AND user_id = ?` : `SELECT * FROM daily_steps WHERE id = ?`,
    userId ? [id, userId] : [id]
  );
  if (!row) throw new Error(`Step ${id} not found`);
  return rowToStep(row);
}

export async function deleteDailyBabyStep(id: string, userId?: string): Promise<void> {
  const result = dbRun(
    userId ? `DELETE FROM daily_steps WHERE id = ? AND user_id = ?` : `DELETE FROM daily_steps WHERE id = ?`,
    userId ? [id, userId] : [id]
  );
  if (result.changes === 0) throw new Error(`Step ${id} not found`);
}
