import {dateToYMD} from '@/lib/date-utils';
import {randomUUID} from 'crypto';
import {dbAll, dbGet, dbRun} from '@/lib/db/sqlite';
import {parseJsonOr} from '@/lib/safe-json';
import type {ReflectionBlockerReason} from '@/lib/life-coach/types';
import type {
  SkipCoachAction,
  SkipCoachAdjustment,
  SkipCoachAdjustmentPayload,
} from './types';

function previousDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() - 1);
  return dateToYMD(d);
}

function rowToAdjustment(row: Record<string, unknown>): SkipCoachAdjustment {
  const adjustment = parseJsonOr<SkipCoachAdjustmentPayload>(row.adjustment_json, {
    max_tasks: 1,
    max_minutes_per_task: 5,
    easy_only: true,
    prefer_plan_b: false,
    summary: '',
  });

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    skip_date: row.skip_date as string,
    step_id: (row.step_id as string) ?? null,
    goal_id: (row.goal_id as string) ?? null,
    blocker_reason: (row.blocker_reason as ReflectionBlockerReason) ?? null,
    coach_action: row.coach_action as SkipCoachAction,
    adjustment,
    applied_at: (row.applied_at as string) ?? null,
    created_at: row.created_at as string,
  };
}

export function saveSkipCoachAdjustment(
  userId: string,
  input: {
    skip_date: string;
    step_id?: string | null;
    goal_id?: string | null;
    blocker_reason?: ReflectionBlockerReason | null;
    coach_action: SkipCoachAction;
    adjustment: SkipCoachAdjustmentPayload;
  }
): SkipCoachAdjustment {
  const id = randomUUID();
  const now = new Date().toISOString();

  dbRun(
    `INSERT INTO skip_coach_adjustments
      (id, user_id, skip_date, step_id, goal_id, blocker_reason,
       coach_action, adjustment_json, applied_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      id,
      userId,
      input.skip_date,
      input.step_id ?? null,
      input.goal_id ?? null,
      input.blocker_reason ?? null,
      input.coach_action,
      JSON.stringify(input.adjustment),
      null,
      now,
    ]
  );

  const row = dbGet<Record<string, unknown>>(
    `SELECT * FROM skip_coach_adjustments WHERE id = ?`,
    [id]
  );
  return rowToAdjustment(row!);
}

export function getActiveSkipCoachAdjustment(
  userId: string,
  targetDate: string
): SkipCoachAdjustment | null {
  const skipDate = previousDate(targetDate);
  const row = dbGet<Record<string, unknown>>(
    `SELECT * FROM skip_coach_adjustments
     WHERE user_id = ? AND skip_date = ? AND applied_at IS NULL
     ORDER BY created_at DESC
     LIMIT 1`,
    [userId, skipDate]
  );
  return row ? rowToAdjustment(row) : null;
}

export function markSkipCoachAdjustmentApplied(
  userId: string,
  skipDate: string
): void {
  dbRun(
    `UPDATE skip_coach_adjustments SET applied_at = ? WHERE user_id = ? AND skip_date = ?`,
    [new Date().toISOString(), userId, skipDate]
  );
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}

export function listSkipCoachAdjustmentsSince(
  userId: string,
  since: string
): SkipCoachAdjustment[] {
  const rows = dbAll<Record<string, unknown>>(
    `SELECT * FROM skip_coach_adjustments
     WHERE user_id = ? AND skip_date >= ?
     ORDER BY skip_date DESC`,
    [userId, since]
  );
  return rows.map(rowToAdjustment);
}
