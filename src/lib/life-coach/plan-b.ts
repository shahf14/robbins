import type {AppLocale} from '@/i18n/config';
import type {DailyBabyStep, StructuredDailyBabyStep} from './types';

export type PlanBFields = {
  fallback_title: string;
  fallback_description: string;
  fallback_estimated_minutes: number;
};

export function buildDefaultPlanB(
  step: Pick<DailyBabyStep, 'title' | 'description'>,
  locale: AppLocale = 'he'
): PlanBFields {
  const he = locale === 'he';
  const shortTitle =
    step.title.length > 56 ? `${step.title.slice(0, 53).trim()}…` : step.title.trim();

  return {
    fallback_title: he ? `2 דק׳: ${shortTitle}` : `2 min: ${shortTitle}`,
    fallback_description: he
      ? 'גרסת Plan B — רק הצעד הראשון, בלי שלמות.'
      : 'Plan B — just the first move, not perfection.',
    fallback_estimated_minutes: 2,
  };
}

export function ensurePlanBFields(
  step: StructuredDailyBabyStep,
  locale: AppLocale = 'he'
): StructuredDailyBabyStep {
  if (step.fallback_title?.trim()) return step;
  const planB = buildDefaultPlanB(step, locale);
  return {...step, ...planB};
}

export function hasStoredPlanB(step: Pick<DailyBabyStep, 'fallback_title'>): boolean {
  return !!step.fallback_title?.trim();
}

export function isPlanBActive(step: DailyBabyStep): boolean {
  if (!hasStoredPlanB(step)) return step.estimated_minutes <= 2 && step.difficulty === 'easy';
  return step.title.trim() === (step.fallback_title ?? '').trim();
}

/** Content to apply when user taps “easier version”. */
export function getPlanBContent(
  step: DailyBabyStep,
  locale: AppLocale = 'he'
): {
  title: string;
  description: string;
  estimated_minutes: number;
  difficulty: 'easy';
} {
  if (hasStoredPlanB(step)) {
    return {
      title: (step.fallback_title ?? '').trim(),
      description: step.fallback_description?.trim() ?? '',
      estimated_minutes: step.fallback_estimated_minutes ?? 2,
      difficulty: 'easy',
    };
  }

  const generated = buildDefaultPlanB(step, locale);
  return {
    title: generated.fallback_title,
    description: generated.fallback_description,
    estimated_minutes: generated.fallback_estimated_minutes,
    difficulty: 'easy',
  };
}

export function planBPreviewLine(step: DailyBabyStep, locale: AppLocale = 'he'): string {
  const planB = hasStoredPlanB(step)
    ? {
        fallback_title: step.fallback_title!,
        fallback_estimated_minutes: step.fallback_estimated_minutes ?? 2,
      }
    : buildDefaultPlanB(step, locale);
  return planB.fallback_title;
}
