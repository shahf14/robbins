import {parseTimeToMinutes} from '@/lib/schedule-content';

const STREAK_HEALTH_STATES = ['fresh', 'stable', 'atRisk', 'protected'] as const;
export type StreakHealth = (typeof STREAK_HEALTH_STATES)[number];

export function deriveStreakHealth(
  streak: number,
  pendingEvening: number,
  sleepTime: string,
  hasTodayRitual: boolean,
  now = new Date(),
  checkinEnergy: number | null = null
): StreakHealth {
  const current = now.getHours() * 60 + now.getMinutes();
  const windDown = parseTimeToMinutes(sleepTime) - 90;
  const isEvening = current >= windDown;

  // When energy is critically low, protect the streak to reduce psychological pressure
  if (checkinEnergy != null && checkinEnergy <= 3 && streak >= 2) return 'protected';

  if (hasTodayRitual && streak >= 3) return 'protected';
  if (streak <= 1) return 'fresh';
  if (isEvening && pendingEvening >= 2) return 'atRisk';
  return 'stable';
}
