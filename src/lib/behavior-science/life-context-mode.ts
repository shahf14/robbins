import type {LifeContextStatus} from '@/lib/life-coach/types';
import {activeLifeContexts} from '@/lib/life-context-content';

export type LifeContextMode = {
  active: boolean;
  compassion: boolean;
  recoveryFirst: boolean;
  fewerSteps: boolean;
  gentleGoals: boolean;
};

const HIGH_LOAD: LifeContextStatus[] = [
  'new_parent',
  'caregiver',
  'between_jobs',
  'student',
];

export function resolveLifeContextMode(
  statuses: LifeContextStatus[] | null | undefined
): LifeContextMode {
  const active = activeLifeContexts(statuses);
  if (active.length === 0) {
    return {
      active: false,
      compassion: false,
      recoveryFirst: false,
      fewerSteps: false,
      gentleGoals: false,
    };
  }

  const highLoad = active.some((s) => HIGH_LOAD.includes(s));

  return {
    active: true,
    compassion: true,
    recoveryFirst: highLoad,
    fewerSteps: highLoad,
    gentleGoals: highLoad,
  };
}
