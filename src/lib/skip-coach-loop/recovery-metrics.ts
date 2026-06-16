import {dateToYMD} from '@/lib/date-utils';
import type {DailyBabyStep} from '@/lib/life-coach/types';
import {listSkipCoachAdjustmentsSince} from './repository';
import type {SkipCoachRecoveryMetrics} from './types';

function nextDate(date: string): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + 1);
  return dateToYMD(d);
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}

/** Recovery = completed or partial on the day after a skip with coach adjustment. */
export function computeSkipCoachRecoveryMetrics(
  userId: string,
  steps: DailyBabyStep[],
  windowDays = 14
): SkipCoachRecoveryMetrics | null {
  const since = dateDaysAgo(Math.max(0, windowDays - 1));
  const adjustments = listSkipCoachAdjustmentsSince(userId, since);
  if (adjustments.length === 0) return null;

  const skipDates = new Set(
    steps
      .filter((s) => s.scheduled_date >= since && s.status === 'skipped')
      .map((s) => s.scheduled_date)
  );

  let recoveryNextDay = 0;
  for (const adj of adjustments) {
    const tomorrow = nextDate(adj.skip_date);
    const recovered = steps.some(
      (s) =>
        s.scheduled_date === tomorrow &&
        (s.status === 'completed' || s.status === 'partial')
    );
    if (recovered) recoveryNextDay++;
  }

  return {
    skip_events: skipDates.size,
    adjustments_saved: adjustments.length,
    recovery_next_day: recoveryNextDay,
    recovery_rate:
      adjustments.length > 0
        ? Math.round((recoveryNextDay / adjustments.length) * 100) / 100
        : 0,
  };
}
