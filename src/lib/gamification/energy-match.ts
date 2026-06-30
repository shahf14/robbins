import {deriveEnergyBand} from '@/lib/life-coach/step-priority';
import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';
import {classifyQuestType} from './quest-types';

export type EnergyMatchBonus = 'smartRecovery' | 'powerMove';

export function detectEnergyMatchBonus(
  energy: number | null | undefined,
  step: DailyBabyStepResponse
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
