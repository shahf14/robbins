import {dbAll, dbGet, dbRun} from '@/lib/db/sqlite';
import {parseJsonArrayOr} from '@/lib/safe-json';
import {asEnum} from '@/lib/as-enum';
import {STEP_VALUE_FEEDBACK_OPTIONS, type DailyBabyStep, type DailyReflection} from '@/lib/life-coach/types';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import {computeUserBehaviorProfile} from './compute';
import {EMPTY_BEHAVIOR_PROFILE, type FailedActionPattern, type UserBehaviorProfile} from './types';
import {dateToYMD} from '@/lib/date-utils';

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}

function rowToProfile(row: Record<string, unknown>): UserBehaviorProfile {
  const commonBlockers = parseJsonArrayOr(
    row.common_blockers,
    [] as UserBehaviorProfile['common_blockers']
  );
  const preferredDomains = parseJsonArrayOr(
    row.preferred_domains,
    [] as UserBehaviorProfile['preferred_domains']
  );
  const avoidWindows = parseJsonArrayOr(
    row.avoid_windows,
    [] as UserBehaviorProfile['avoid_windows']
  );
  const bestWindows = parseJsonArrayOr(
    row.best_windows,
    [] as UserBehaviorProfile['best_windows']
  );
  const weekdaySkipPatterns = parseJsonArrayOr(
    row.weekday_skip_patterns,
    [] as UserBehaviorProfile['weekday_skip_patterns']
  );
  const failedActionPatterns = parseJsonArrayOr(
    row.failed_action_patterns,
    [] as FailedActionPattern[]
  );
  return {
    user_id: row.user_id as string,
    best_action_window: (row.best_action_window as PreferredActionWindow) ?? 'flexible',
    avoid_windows: avoidWindows,
    best_windows: bestWindows,
    weekday_skip_patterns: weekdaySkipPatterns,
    avg_completion_rate_7d: Number(row.avg_completion_rate_7d ?? 0),
    avg_actual_minutes:
      row.avg_actual_minutes == null ? null : Number(row.avg_actual_minutes),
    common_blockers: commonBlockers,
    preferred_domains: preferredDomains,
    low_energy_frequency: Number(row.low_energy_frequency ?? 0),
    recovery_rate: Number(row.recovery_rate ?? 0),
    failed_action_patterns: failedActionPatterns,
    sample_size_7d: Number(row.sample_size_7d ?? 0),
    updated_at: (row.updated_at as string) ?? new Date().toISOString(),
  };
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
    value_feedback: asEnum(row.value_feedback, STEP_VALUE_FEEDBACK_OPTIONS),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

function listStepsSince(userId: string, since: string): DailyBabyStep[] {
  const rows = dbAll<Record<string, unknown>>(
    `SELECT * FROM daily_steps WHERE user_id = ? AND scheduled_date >= ? ORDER BY scheduled_date DESC`,
    [userId, since]
  );
  return rows.map(mapStepRow);
}

function listReflectionsSince(userId: string, since: string): DailyReflection[] {
  return dbAll<Record<string, unknown>>(
    `SELECT * FROM daily_reflections WHERE user_id = ? AND date >= ? ORDER BY date DESC`,
    [userId, since]
  ) as DailyReflection[];
}

function listEnergyScoresSince(userId: string, since: string): number[] {
  const rows = dbAll<{energy_score: number | null}>(
    `SELECT energy_score FROM checkins
     WHERE user_id = ? AND date >= ? AND energy_score IS NOT NULL`,
    [userId, since]
  );
  return rows.map((r) => r.energy_score!).filter((e) => e >= 1 && e <= 10);
}

export function getUserBehaviorProfile(
  userId: string,
  fallbackWindow: PreferredActionWindow = 'flexible'
): UserBehaviorProfile {
  const row = dbGet<Record<string, unknown>>(
    `SELECT * FROM user_behavior_profile WHERE user_id = ?`,
    [userId]
  );
  if (!row) return EMPTY_BEHAVIOR_PROFILE(userId, fallbackWindow);
  return rowToProfile(row);
}

export function upsertUserBehaviorProfile(
  profile: Omit<UserBehaviorProfile, 'updated_at'> & {updated_at?: string}
): UserBehaviorProfile {
  const now = profile.updated_at ?? new Date().toISOString();
  dbRun(
    `INSERT INTO user_behavior_profile
      (user_id, best_action_window, avoid_windows, best_windows, weekday_skip_patterns,
       avg_completion_rate_7d, avg_actual_minutes,
       common_blockers, preferred_domains, low_energy_frequency, recovery_rate,
       failed_action_patterns, sample_size_7d, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(user_id) DO UPDATE SET
       best_action_window = excluded.best_action_window,
       avoid_windows = excluded.avoid_windows,
       best_windows = excluded.best_windows,
       weekday_skip_patterns = excluded.weekday_skip_patterns,
       avg_completion_rate_7d = excluded.avg_completion_rate_7d,
       avg_actual_minutes = excluded.avg_actual_minutes,
       common_blockers = excluded.common_blockers,
       preferred_domains = excluded.preferred_domains,
       low_energy_frequency = excluded.low_energy_frequency,
       recovery_rate = excluded.recovery_rate,
       failed_action_patterns = excluded.failed_action_patterns,
       sample_size_7d = excluded.sample_size_7d,
       updated_at = excluded.updated_at`,
    [
      profile.user_id,
      profile.best_action_window,
      JSON.stringify(profile.avoid_windows),
      JSON.stringify(profile.best_windows),
      JSON.stringify(profile.weekday_skip_patterns),
      profile.avg_completion_rate_7d,
      profile.avg_actual_minutes,
      JSON.stringify(profile.common_blockers),
      JSON.stringify(profile.preferred_domains),
      profile.low_energy_frequency,
      profile.recovery_rate,
      JSON.stringify(profile.failed_action_patterns),
      profile.sample_size_7d,
      now,
    ]
  );
  return getUserBehaviorProfile(profile.user_id, profile.best_action_window);
}

export function refreshUserBehaviorProfile(
  userId: string,
  fallbackWindow: PreferredActionWindow = 'flexible'
): UserBehaviorProfile {
  const since = dateDaysAgo(6);
  const computed = computeUserBehaviorProfile({
    userId,
    steps: listStepsSince(userId, since),
    reflections: listReflectionsSince(userId, since),
    energyScores: listEnergyScoresSince(userId, since),
    fallbackWindow,
  });
  return upsertUserBehaviorProfile({...computed, updated_at: new Date().toISOString()});
}
