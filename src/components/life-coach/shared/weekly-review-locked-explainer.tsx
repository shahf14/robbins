'use client';

import {useTranslations} from 'next-intl';
import {
  WEEKLY_REVIEW_MIN_ACTIVE_DAYS,
  WEEKLY_REVIEW_MIN_STEPS,
  type WeeklyReviewReadiness,
} from '@/lib/life-coach/weekly-review-readiness';

type Props = {
  readiness: WeeklyReviewReadiness;
  className?: string;
};

export function WeeklyReviewLockedExplainer({readiness, className = ''}: Props) {
  const t = useTranslations();

  if (readiness.isReady) return null;

  return (
    <div
      id="weekly-review-locked-hint"
      className={`rounded-xl border border-amber-400/25 bg-amber-500/8 px-4 py-3 ${className}`.trim()}
      role="note"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-amber-200/90">
        {t('lifeCoach.weeklyReviewLockedWhyTitle')}
      </p>
      <p className="mt-1.5 text-sm leading-6 text-amber-50/85">
        {t('lifeCoach.weeklyReviewLockedExplainer', {
          minSteps: WEEKLY_REVIEW_MIN_STEPS,
          minDays: WEEKLY_REVIEW_MIN_ACTIVE_DAYS,
        })}
      </p>
      <p className="mt-2 text-xs leading-5 text-amber-100/60">
        {t('lifeCoach.weeklyReviewLockedProgress', {
          steps: readiness.loggedSteps,
          minSteps: WEEKLY_REVIEW_MIN_STEPS,
          days: readiness.activeDays,
          minDays: WEEKLY_REVIEW_MIN_ACTIVE_DAYS,
        })}
      </p>
    </div>
  );
}
