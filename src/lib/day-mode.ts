import {getPersonalDayPhase, parseTimeToMinutes} from '@/lib/schedule-content';
import type {PersonalDayPhase} from '@/lib/schedule-content';

export type DayMode = 'light' | 'execution' | 'recovery';

type Input = {
  energy: number | null;
  pendingCount: number;
  completedToday: number;
  skippedToday: number;
  partialToday: number;
  wakeTime: string;
  sleepTime: string;
  now?: Date;
};

function isLateDay(sleepTime: string, now: Date): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const windDown = parseTimeToMinutes(sleepTime) - 90;
  return current >= windDown;
}

/** Derive dashboard day mode from energy, activity, and time of day. */
export function deriveDayMode({
  energy,
  pendingCount,
  completedToday,
  skippedToday,
  partialToday,
  wakeTime,
  sleepTime,
  now = new Date(),
}: Input): DayMode {
  const phase = getPersonalDayPhase(wakeTime, sleepTime, now);
  const late = isLateDay(sleepTime, now);
  const struggled = skippedToday >= 2 || partialToday >= 2;
  const lowEnergy = energy !== null && energy <= 4;
  const midLowEnergy = energy !== null && energy <= 5;
  const highEnergy = energy !== null && energy >= 7;

  if (struggled || (lowEnergy && pendingCount > 0)) {
    return 'recovery';
  }

  if (late && pendingCount >= 2) {
    return 'light';
  }

  if (highEnergy && pendingCount > 0 && (phase === 'morning' || phase === 'afternoon')) {
    return 'execution';
  }

  if (pendingCount >= 2 && !midLowEnergy && phase !== 'night') {
    return 'execution';
  }

  if (lowEnergy || (late && pendingCount > 0) || phase === 'pre_wake') {
    return 'light';
  }

  if (completedToday > 0 && pendingCount === 0) {
    return 'execution';
  }

  return midLowEnergy ? 'light' : 'execution';
}

export function shouldShowEveningMomentumMessage(
  sleepTime: string,
  pendingCount: number,
  now = new Date()
): boolean {
  return pendingCount >= 2 && isLateDay(sleepTime, now);
}

export function dayModeLabelKey(mode: DayMode): string {
  return `home.dayMode.${mode}`;
}
