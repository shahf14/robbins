import type {DailyBabyStep} from './types';

export function sumWeeklyInvestedMinutes(steps: DailyBabyStep[]): number {
  return steps
    .filter((step) => step.status === 'completed')
    .reduce((sum, step) => sum + (step.actual_minutes ?? step.estimated_minutes), 0);
}
