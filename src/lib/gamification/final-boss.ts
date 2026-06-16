import {parseTimeToMinutes} from '@/lib/schedule-content';
import type {DailyBabyStep} from '@/lib/life-coach/types';

function isLateDay(sleepTime: string, now = new Date()): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const windDown = parseTimeToMinutes(sleepTime) - 90;
  return current >= windDown;
}

export function getFinalBossStep(
  steps: DailyBabyStep[],
  sleepTime: string,
  now = new Date()
): DailyBabyStep | null {
  if (!isLateDay(sleepTime, now)) return null;
  const pending = steps.filter((s) => s.status === 'pending');
  if (pending.length !== 1) return null;
  return pending[0];
}
