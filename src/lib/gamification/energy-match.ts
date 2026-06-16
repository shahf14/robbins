import {deriveEnergyBand} from '@/lib/life-coach/step-priority';
import type {DailyBabyStep} from '@/lib/life-coach/types';
import {classifyQuestType} from './quest-types';

export type EnergyMatchBonus = 'smartRecovery' | 'powerMove';

export function detectEnergyMatchBonus(
  energy: number | null | undefined,
  step: DailyBabyStep
): EnergyMatchBonus | null {
  const band = deriveEnergyBand(energy);
  const quest = classifyQuestType(step);

  if (
    band === 'low' &&
    (quest === 'recovery' || step.difficulty === 'easy' || step.estimated_minutes <= 5)
  ) {
    return 'smartRecovery';
  }

  if (
    band === 'high' &&
    (step.difficulty === 'hard' || step.estimated_minutes >= 12 || quest === 'courage')
  ) {
    return 'powerMove';
  }

  return null;
}
