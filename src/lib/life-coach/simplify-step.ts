import type {AppLocale} from '@/i18n/config';
import type {DailyBabyStepResponse} from './response-dtos';
import {getPlanBContent, hasStoredPlanB} from './plan-b';

export type SimplifiedStepContent = {
  title: string;
  description: string;
  estimated_minutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
};

const SKIP_RECOVERY_MINUTES = 3;

/** Apply stored Plan B or generate a 2-minute fallback — no AI round-trip. */
export function buildSimplifiedStep(
  step: DailyBabyStepResponse,
  locale: AppLocale = 'he'
): SimplifiedStepContent {
  return getPlanBContent(step, locale);
}

/** 3-minute easy version to bring a skipped step back on track — same row, new content. */
export function buildSkipRecoveryStep(
  step: DailyBabyStepResponse,
  locale: AppLocale = 'he'
): SimplifiedStepContent {
  const planB = getPlanBContent(step, locale);
  const he = locale === 'he';
  const shortTitle =
    step.title.length > 50 ? `${step.title.slice(0, 47).trim()}…` : step.title.trim();

  if (hasStoredPlanB(step) && planB.estimated_minutes <= SKIP_RECOVERY_MINUTES) {
    return {
      title: planB.title,
      description: planB.description,
      estimated_minutes: Math.min(SKIP_RECOVERY_MINUTES, planB.estimated_minutes),
      difficulty: 'easy',
    };
  }

  return {
    title: he ? `3 דק׳: ${shortTitle}` : `3 min: ${shortTitle}`,
    description:
      planB.description ||
      (he
        ? 'גרסה קלה — רק ההתחלה, עם תוצר ברור שאפשר לסיים תוך 3 דקות.'
        : 'Light version — just the start, with a clear deliverable you can finish in 3 minutes.'),
    estimated_minutes: SKIP_RECOVERY_MINUTES,
    difficulty: 'easy',
  };
}
