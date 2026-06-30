import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';

export type BehaviorScore = {
  showUps: number;
  opportunities: number;
  percent: number;
};

export function computeWeeklyBehaviorScore(weekSteps: DailyBabyStepResponse[]): BehaviorScore {
  const daysWithSteps = new Set(weekSteps.map((s) => s.scheduled_date));
  let showUps = 0;
  let opportunities = 0;

  for (const date of daysWithSteps) {
    const daySteps = weekSteps.filter((s) => s.scheduled_date === date);
    if (daySteps.length === 0) continue;
    opportunities += 1;
    const showed = daySteps.some(
      (s) => s.status === 'completed' || s.status === 'partial'
    );
    if (showed) showUps += 1;
  }

  const percent = opportunities > 0 ? Math.round((showUps / opportunities) * 100) : 0;
  return {showUps, opportunities, percent};
}
