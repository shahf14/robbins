import {dbAll, dbGet} from '@/lib/db/sqlite';
import {parseJsonArrayOr} from '@/lib/safe-json';
import type {DailyBabyStep, DailyReflection, LifeDomainState} from '@/lib/life-coach/types';
import {dateToYMD} from '@/lib/date-utils';

export function dateDaysAgo(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}

export function todayYmd(): string {
  return dateDaysAgo(0);
}

function mapStepRow(row: Record<string, unknown>): DailyBabyStep {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    goal_id: (row.goal_id as string) ?? null,
    domain: row.domain as DailyBabyStep['domain'],
    title: row.title as string,
    description: (row.description as string) ?? '',
    estimated_minutes: (row.estimated_minutes as number) ?? 15,
    difficulty: row.difficulty as DailyBabyStep['difficulty'],
    scheduled_date: row.scheduled_date as string,
    status: row.status as DailyBabyStep['status'],
    generated_by_ai: !!row.generated_by_ai,
    is_general: !!row.is_general,
    completed_at: (row.completed_at as string) ?? null,
    actual_minutes: (row.actual_minutes as number) ?? null,
    reattempt_same_day: !!row.reattempt_same_day,
    blocker_reason: (row.blocker_reason as DailyBabyStep['blocker_reason']) ?? null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function listStepsSince(userId: string, since: string): DailyBabyStep[] {
  const rows = dbAll<Record<string, unknown>>(
    `SELECT * FROM daily_steps WHERE user_id = ? AND scheduled_date >= ? ORDER BY scheduled_date DESC`,
    [userId, since]
  );
  return rows.map(mapStepRow);
}

export function listReflectionsSince(userId: string, since: string): DailyReflection[] {
  return dbAll<Record<string, unknown>>(
    `SELECT * FROM daily_reflections WHERE user_id = ? AND date >= ? ORDER BY date DESC`,
    [userId, since]
  ) as DailyReflection[];
}

function rowToDomainState(row: Record<string, unknown>): LifeDomainState {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    domain: row.domain as LifeDomainState['domain'],
    current_score: row.current_score as number,
    current_state: (row.current_state as string) ?? '',
    desired_state: (row.desired_state as string) ?? '',
    main_blockers: parseJsonArrayOr<string>(row.main_blockers),
    available_time_per_day: row.available_time_per_day as LifeDomainState['available_time_per_day'],
    intensity_preference: row.intensity_preference as LifeDomainState['intensity_preference'],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function listDomainStates(userId: string): LifeDomainState[] {
  const rows = dbAll<Record<string, unknown>>(
    `SELECT * FROM domain_assessments WHERE user_id = ? ORDER BY domain ASC`,
    [userId]
  );
  return rows.map(rowToDomainState);
}

export function getLatestReflection(userId: string): DailyReflection | null {
  const row = dbGet<Record<string, unknown>>(
    `SELECT * FROM daily_reflections WHERE user_id = ? ORDER BY date DESC LIMIT 1`,
    [userId]
  );
  return row ? (row as DailyReflection) : null;
}

export function countPendingToday(userId: string, date: string): number {
  const row = dbGet<{count: number}>(
    `SELECT COUNT(*) as count FROM daily_steps
     WHERE user_id = ? AND scheduled_date = ? AND status = 'pending'`,
    [userId, date]
  );
  return row?.count ?? 0;
}
