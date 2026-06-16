import type {ReflectionBlockerReason} from '@/lib/life-coach/types';

const LOOT_TYPES = ['pattern', 'tomorrowAdvantage', 'energyClue'] as const;
export type LootType = (typeof LOOT_TYPES)[number];

export function generateReflectionLoot(input: {
  blocker_reason?: ReflectionBlockerReason | null;
  reflection_text?: string;
  energy?: number | null;
  completedToday: number;
}): LootType {
  const text = (input.reflection_text ?? '').toLowerCase();

  if (
    input.blocker_reason === 'low_energy' ||
    input.blocker_reason === 'no_time' ||
    (input.energy != null && input.energy <= 4)
  ) {
    return 'energyClue';
  }

  if (
    input.completedToday > 0 ||
    text.includes('tomorrow') ||
    text.includes('next') ||
    input.blocker_reason === 'forgot'
  ) {
    return 'tomorrowAdvantage';
  }

  return 'pattern';
}
