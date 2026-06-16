import type {DailyBabyStep} from '@/lib/life-coach/types';

export type EndOfDayClosure = {
  closedTitles: string[];
  openTitles: string[];
  firstTomorrowTitle: string | null;
};

export function buildEndOfDayClosure(
  todaySteps: DailyBabyStep[],
  tomorrowSteps: DailyBabyStep[] = []
): EndOfDayClosure | null {
  if (todaySteps.length === 0) return null;

  const closed = todaySteps.filter(
    (s) => s.status === 'completed' || s.status === 'partial'
  );
  const open = todaySteps.filter((s) => s.status === 'pending' || s.status === 'skipped');
  const allActioned = todaySteps.every((s) => s.status !== 'pending');

  if (!allActioned && closed.length === 0) return null;

  const firstTomorrow =
    tomorrowSteps.find((s) => s.status === 'pending') ??
    open[0] ??
    null;

  return {
    closedTitles: closed.map((s) => s.title),
    openTitles: open.map((s) => s.title),
    firstTomorrowTitle: firstTomorrow?.title ?? null,
  };
}
