import type {DailyBabyStepResponse} from './response-dtos';

export function sumWeeklyInvestedMinutes(steps: DailyBabyStepResponse[]): number {
  return steps
    .filter((step) => step.status === 'completed')
    .reduce((sum, step) => sum + (step.actual_minutes ?? step.estimated_minutes), 0);
}
