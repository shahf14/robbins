import {dateToYMD} from '@/lib/date-utils';
import type {DailyBabyStepResponse} from './response-dtos';
import type {StreakInfo} from './types';

/**
 * Compute streak information from a list of daily baby steps.
 * Steps must be sorted by scheduled_date descending (most recent first).
 */
export function computeStreak(steps: DailyBabyStepResponse[], domain?: string): StreakInfo {
  const filtered = domain ? steps.filter((s) => s.domain === domain) : steps;

  if (filtered.length === 0) {
    return {
      current_streak: 0,
      longest_streak: 0,
      total_completed: 0,
      total_steps: 0,
      consistency_rate: 0,
      grace_days_used: 0,
    };
  }

  // Group by date
  const byDate = new Map<string, DailyBabyStepResponse[]>();
  for (const step of filtered) {
    const existing = byDate.get(step.scheduled_date) ?? [];
    existing.push(step);
    byDate.set(step.scheduled_date, existing);
  }

  const completedDates = new Set(
    [...byDate.entries()]
      .filter(([, daySteps]) => daySteps.some((s) => s.status === 'completed' || s.status === 'partial'))
      .map(([date]) => date)
  );
  const graceDates = new Set(
    [...byDate.entries()]
      .filter(([, daySteps]) => isGraceDay(daySteps))
      .map(([date]) => date)
  );

  // Today may still be unfinished. One low-energy / life-happened day can
  // preserve the streak without increasing it, so the mechanic encourages
  // honest recovery instead of hiding skipped days.
  let currentStreak = 0;
  let graceDaysUsed = 0;
  const today = startOfLocalDay(new Date());
  for (let offset = 0; offset <= 365; offset++) {
    const date = formatLocalDate(addDays(today, -offset));
    const completed = completedDates.has(date);
    if (completed) {
      currentStreak++;
    } else if (offset > 0 && graceDates.has(date) && graceDaysUsed === 0) {
      graceDaysUsed++;
    } else if (offset > 0) {
      break;
    }
  }

  // Missing calendar days also break historical streaks.
  let longestStreak = 0;
  let runningStreak = 0;
  let previous: Date | null = null;
  for (const dateStr of [...completedDates].sort()) {
    const date = new Date(`${dateStr}T00:00:00`);
    if (Number.isNaN(date.getTime())) continue;
    if (previous && differenceInDays(previous, date) !== 1) {
      runningStreak = 0;
    }
    runningStreak++;
    longestStreak = Math.max(longestStreak, runningStreak);
    previous = date;
  }

  const totalCompleted = filtered.filter((s) => s.status === 'completed').length;
  const totalSteps = filtered.length;

  // Consistency rate is reported as "the last 30 days" in the UI, so it must be
  // windowed regardless of how much history the caller passes in. A "partial"
  // day counts as showing up, matching how the streak mechanic treats it.
  const windowStart = formatLocalDate(addDays(today, -29));
  const windowSteps = filtered.filter((s) => s.scheduled_date >= windowStart);
  const windowShowUps = windowSteps.filter(
    (s) => s.status === 'completed' || s.status === 'partial'
  ).length;
  const consistencyRate =
    windowSteps.length > 0 ? Math.round((windowShowUps / windowSteps.length) * 100) : 0;

  return {
    current_streak: currentStreak,
    longest_streak: longestStreak,
    total_completed: totalCompleted,
    total_steps: totalSteps,
    consistency_rate: consistencyRate,
    grace_days_used: graceDaysUsed,
  };
}

function isGraceDay(daySteps: DailyBabyStepResponse[]) {
  return (
    daySteps.length > 0 &&
    daySteps.every((step) => step.status === 'skipped') &&
    daySteps.some((step) =>
      step.blocker_reason === 'low_energy' ||
      step.blocker_reason === 'family_chaos' ||
      step.blocker_reason === 'no_time'
    )
  );
}

function startOfLocalDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function addDays(date: Date, days: number) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + days);
  return copy;
}

function formatLocalDate(date: Date) {
  return dateToYMD(date);
}

function differenceInDays(left: Date, right: Date) {
  return Math.round((right.getTime() - left.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Build a simple heat-map data structure for the last N days.
 * Returns an array of {date, level} where level is 0-4.
 */
export function buildHeatMap(steps: DailyBabyStepResponse[], days = 90, domain?: string): Array<{date: string; level: 0 | 1 | 2 | 3 | 4}> {
  const filtered = domain ? steps.filter((s) => s.domain === domain) : steps;
  const byDate = new Map<string, DailyBabyStepResponse[]>();

  for (const step of filtered) {
    const existing = byDate.get(step.scheduled_date) ?? [];
    existing.push(step);
    byDate.set(step.scheduled_date, existing);
  }

  const result: Array<{date: string; level: 0 | 1 | 2 | 3 | 4}> = [];
  const today = new Date();

  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(d.getDate() - i);
    const dateStr = dateToYMD(d);
    const daySteps = byDate.get(dateStr) ?? [];

    if (daySteps.length === 0) {
      result.push({date: dateStr, level: 0});
      continue;
    }

    const completed = daySteps.filter((s) => s.status === 'completed').length;
    const ratio = completed / daySteps.length;

    if (ratio >= 1) result.push({date: dateStr, level: 4});
    else if (ratio >= 0.66) result.push({date: dateStr, level: 3});
    else if (ratio >= 0.33) result.push({date: dateStr, level: 2});
    else if (ratio > 0) result.push({date: dateStr, level: 1});
    else result.push({date: dateStr, level: 0});
  }

  return result;
}
