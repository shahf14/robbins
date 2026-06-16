import type {DailyBabyStep} from '@/lib/life-coach/types';
import {pickStartHereStep} from '@/lib/life-coach/step-priority';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import {dateToYMD} from '@/lib/date-utils';

function yesterdayDate(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - 1);
  return dateToYMD(d);
}

export function hadMissedYesterday(
  weekSteps: DailyBabyStep[],
  today: string
): boolean {
  const yday = yesterdayDate(new Date(today));
  const daySteps = weekSteps.filter((s) => s.scheduled_date === yday);
  if (daySteps.length === 0) return false;
  const completed = daySteps.filter((s) => s.status === 'completed').length;
  const struggled = daySteps.filter(
    (s) => s.status === 'skipped' || s.status === 'partial'
  ).length;
  return completed === 0 && struggled > 0;
}

/** Single recovery quest — easiest pending step only. */
type SchedulePrefs = {
  wake_time: string;
  sleep_time: string;
  preferred_action_window: PreferredActionWindow;
};

export function pickRecoveryQuest(
  todaySteps: DailyBabyStep[],
  energy?: number | null,
  prefs?: SchedulePrefs,
  weekSteps: DailyBabyStep[] = []
): DailyBabyStep | null {
  const pending = todaySteps.filter((s) => s.status === 'pending');
  if (pending.length === 0) return null;
  return pickStartHereStep(pending, energy, prefs, weekSteps);
}
