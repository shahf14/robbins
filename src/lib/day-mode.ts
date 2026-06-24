import {parseTimeToMinutes} from '@/lib/schedule-content';

function isLateDay(sleepTime: string, now: Date): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const windDown = parseTimeToMinutes(sleepTime) - 90;
  return current >= windDown;
}

export function shouldShowEveningMomentumMessage(
  sleepTime: string,
  pendingCount: number,
  now = new Date()
): boolean {
  return pendingCount >= 2 && isLateDay(sleepTime, now);
}
