import type {DailyBabyStep} from '@/lib/life-coach/types';

export const WEEKLY_REVIEW_MIN_STEPS = 5;
export const WEEKLY_REVIEW_MIN_ACTIVE_DAYS = 3;

export type WeeklyReviewReadiness = {
  loggedSteps: number;
  activeDays: number;
  isReady: boolean;
  stepsRemaining: number;
  daysRemaining: number;
};

function isLoggedActivity(step: DailyBabyStep): boolean {
  return step.status === 'completed' || step.status === 'partial' || step.status === 'skipped';
}

/** Review is meaningful once the user logged enough steps or active days in the window. */
export function computeWeeklyReviewReadiness(steps: DailyBabyStep[]): WeeklyReviewReadiness {
  const logged = steps.filter(isLoggedActivity);
  const activeDays = new Set(logged.map((step) => step.scheduled_date)).size;
  const isReady =
    logged.length >= WEEKLY_REVIEW_MIN_STEPS || activeDays >= WEEKLY_REVIEW_MIN_ACTIVE_DAYS;

  return {
    loggedSteps: logged.length,
    activeDays,
    isReady,
    stepsRemaining: Math.max(0, WEEKLY_REVIEW_MIN_STEPS - logged.length),
    daysRemaining: Math.max(0, WEEKLY_REVIEW_MIN_ACTIVE_DAYS - activeDays),
  };
}
