import type {
  DailyBabyStep,
  DailyReflection,
  LifeDomain,
  ReflectionBlockerReason,
} from '@/lib/life-coach/types';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import {
  computeFailedActionPatterns,
  failedActionPatternsForPrompt,
} from './failed-action-patterns';
import {computeSkipWindowPatterns, hourToActionWindow} from './skip-windows';
import type {UserBehaviorProfile, WeekdaySkipPattern} from './types';
import {dateToYMD} from '@/lib/date-utils';

type ComputeInput = {
  userId: string;
  steps: DailyBabyStep[];
  reflections: DailyReflection[];
  energyScores: number[];
  fallbackWindow?: PreferredActionWindow;
};

function dateDaysAgo(days: number, from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}

function topBlockers(
  steps: DailyBabyStep[],
  reflections: DailyReflection[],
  limit = 3
): ReflectionBlockerReason[] {
  const counts = new Map<string, number>();
  for (const s of steps) {
    if (s.blocker_reason) counts.set(s.blocker_reason, (counts.get(s.blocker_reason) ?? 0) + 1);
  }
  for (const r of reflections) {
    if (r.blocker_reason) counts.set(r.blocker_reason, (counts.get(r.blocker_reason) ?? 0) + 1);
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([key]) => key as ReflectionBlockerReason);
}

function preferredDomains(steps: DailyBabyStep[], limit = 3): LifeDomain[] {
  const counts = new Map<LifeDomain, number>();
  for (const s of steps) {
    if (s.status === 'completed' || s.status === 'partial') {
      counts.set(s.domain, (counts.get(s.domain) ?? 0) + 1);
    }
  }
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([domain]) => domain);
}

function bestActionWindow(
  steps: DailyBabyStep[],
  fallback: PreferredActionWindow
): PreferredActionWindow {
  const windowCounts = new Map<PreferredActionWindow, number>();
  for (const s of steps) {
    if (s.status !== 'completed' && s.status !== 'partial') continue;
    const ts = s.completed_at ?? s.updated_at;
    if (!ts) continue;
    const hour = new Date(ts).getHours();
    const window = hourToActionWindow(hour);
    windowCounts.set(window, (windowCounts.get(window) ?? 0) + 1);
  }
  if (windowCounts.size === 0) return fallback;
  return [...windowCounts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function completionRate(steps: DailyBabyStep[]): number {
  const actionable = steps.filter((s) => s.status !== 'pending');
  if (actionable.length === 0) return 0;
  const showUps = actionable.filter((s) => s.status === 'completed' || s.status === 'partial').length;
  return Math.round((showUps / actionable.length) * 100) / 100;
}

function avgActualMinutes(steps: DailyBabyStep[]): number | null {
  const completed = steps.filter((s) => s.status === 'completed' && s.actual_minutes != null);
  if (completed.length === 0) return null;
  const sum = completed.reduce((acc, s) => acc + (s.actual_minutes ?? 0), 0);
  return Math.round((sum / completed.length) * 10) / 10;
}

function lowEnergyFrequency(energyScores: number[]): number {
  if (energyScores.length === 0) return 0;
  const low = energyScores.filter((e) => e <= 4).length;
  return Math.round((low / energyScores.length) * 100) / 100;
}

/** Comeback after skip — same-day reattempt + next-day show-up after a missed day. */
export function computeRecoveryRate(steps: DailyBabyStep[]): number {
  const sameDayComebacks = steps.filter(
    (s) => s.reattempt_same_day && (s.status === 'completed' || s.status === 'partial')
  ).length;
  const skipEvents = steps.filter((s) => s.status === 'skipped').length;

  const dates = [...new Set(steps.map((s) => s.scheduled_date))].sort();
  let nextDayRecoveries = 0;
  let missedDays = 0;

  for (let i = 0; i < dates.length - 1; i++) {
    const daySteps = steps.filter((s) => s.scheduled_date === dates[i]);
    const hadSkip = daySteps.some((s) => s.status === 'skipped');
    const hadShowUp = daySteps.some((s) => s.status === 'completed' || s.status === 'partial');
    if (hadSkip && !hadShowUp) {
      missedDays++;
      const nextSteps = steps.filter((s) => s.scheduled_date === dates[i + 1]);
      if (nextSteps.some((s) => s.status === 'completed' || s.status === 'partial')) {
        nextDayRecoveries++;
      }
    }
  }

  const numerator = sameDayComebacks + nextDayRecoveries;
  const denominator = skipEvents + missedDays;
  return denominator > 0 ? Math.round((numerator / denominator) * 100) / 100 : 0;
}

export function computeUserBehaviorProfile(input: ComputeInput): Omit<UserBehaviorProfile, 'updated_at'> {
  const since = dateDaysAgo(6);
  const steps = input.steps.filter((s) => s.scheduled_date >= since);
  const reflections = input.reflections.filter((r) => r.date >= since);
  const skipPatterns = computeSkipWindowPatterns(steps);
  const bestAction =
    skipPatterns.best_windows[0] ??
    bestActionWindow(steps, input.fallbackWindow ?? 'flexible');

  return {
    user_id: input.userId,
    best_action_window: bestAction,
    avoid_windows: skipPatterns.avoid_windows,
    best_windows: skipPatterns.best_windows,
    weekday_skip_patterns: skipPatterns.weekday_patterns,
    avg_completion_rate_7d: completionRate(steps),
    avg_actual_minutes: avgActualMinutes(steps),
    common_blockers: topBlockers(steps, reflections),
    preferred_domains: preferredDomains(steps),
    low_energy_frequency: lowEnergyFrequency(input.energyScores),
    recovery_rate: computeRecoveryRate(steps),
    failed_action_patterns: computeFailedActionPatterns(steps, reflections),
    sample_size_7d: steps.length,
  };
}

const WEEKDAY_LABELS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const;

function weekdayPatternsForPrompt(
  patterns: WeekdaySkipPattern[]
): Array<Record<string, unknown>> {
  return patterns.map((p) => ({
    weekday: p.weekday,
    weekday_label: WEEKDAY_LABELS[p.weekday] ?? String(p.weekday),
    skip_rate: p.skip_rate,
    completion_rate: p.completion_rate,
    sample_size: p.sample_size,
  }));
}

export function behaviorProfileForPrompt(
  profile: UserBehaviorProfile | null
): Record<string, unknown> | null {
  if (!profile || profile.sample_size_7d === 0) return null;
  return {
    best_action_window: profile.best_action_window,
    avoid_windows: profile.avoid_windows,
    best_windows: profile.best_windows,
    weekday_patterns: weekdayPatternsForPrompt(profile.weekday_skip_patterns),
    avg_completion_rate_7d: profile.avg_completion_rate_7d,
    avg_actual_minutes: profile.avg_actual_minutes,
    common_blockers: profile.common_blockers,
    preferred_domains: profile.preferred_domains,
    low_energy_frequency: profile.low_energy_frequency,
    recovery_rate: profile.recovery_rate,
    failed_action_patterns: failedActionPatternsForPrompt(profile.failed_action_patterns),
    sample_size_7d: profile.sample_size_7d,
  };
}
