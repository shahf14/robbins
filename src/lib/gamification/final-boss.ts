import {parseTimeToMinutes} from '@/lib/schedule-content';
import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';

function isLateDay(sleepTime: string, now = new Date()): boolean {
  const current = now.getHours() * 60 + now.getMinutes();
  const windDown = parseTimeToMinutes(sleepTime) - 90;
  return current >= windDown;
}

export function getFinalBossStep(
  steps: DailyBabyStepResponse[],
  sleepTime: string,
  now = new Date()
): DailyBabyStepResponse | null {
  if (!isLateDay(sleepTime, now)) return null;
  const pending = steps.filter((s) => s.status === 'pending');
  if (pending.length !== 1) return null;
  return pending[0];
}
