import type {DailyBabyStep} from '@/lib/life-coach/types';
import type {MorningRitualSession} from '@/lib/morning-ritual-types';
import {dateToYMD} from '@/lib/date-utils';

function ritualEnergy(session: MorningRitualSession | undefined): number | null {
  if (!session) return null;
  const score = session.energyScore ?? (session.moodBefore ? Number(session.moodBefore) : null);
  if (score == null || !Number.isFinite(score) || score < 1 || score > 10) return null;
  return Math.round(score);
}

function datesWithAction(steps: DailyBabyStep[]): Set<string> {
  const dates = new Set<string>();
  for (const step of steps) {
    if (step.status === 'completed' || step.status === 'partial') {
      dates.add(step.scheduled_date);
    }
  }
  return dates;
}

function consecutiveInactiveDays(weekSteps: DailyBabyStep[], today: string): number {
  const active = datesWithAction(weekSteps);
  let count = 0;
  const d = new Date(today);
  for (let i = 1; i <= 7; i++) {
    d.setDate(d.getDate() - 1);
    const key = dateToYMD(d);
    const hadSteps = weekSteps.some((s) => s.scheduled_date === key);
    if (!hadSteps) continue;
    if (active.has(key)) break;
    count += 1;
  }
  return count;
}

export function detectEarlyWarning(input: {
  weekSteps: DailyBabyStep[];
  today: string;
  pendingToday: number;
  ritualSessions: MorningRitualSession[];
}): boolean {
  const inactiveDays = consecutiveInactiveDays(input.weekSteps, input.today);
  const latestRitual = input.ritualSessions.find((session) => session.completed);
  const lowEnergy = (ritualEnergy(latestRitual) ?? 6) <= 4;
  return inactiveDays >= 2 || (input.pendingToday >= 3 && lowEnergy);
}
