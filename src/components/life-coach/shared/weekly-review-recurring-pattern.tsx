'use client';

import {useTranslations} from 'next-intl';
import type {WeeklyReviewRecurringPattern} from '@/lib/life-coach/types';

type Props = {
  pattern: WeeklyReviewRecurringPattern;
};

export function WeeklyReviewRecurringPatternSection({pattern}: Props) {
  const t = useTranslations('weeklyReviewRecurringPattern');

  return (
    <section className="mt-4 rounded-xl border border-amber-500/25 bg-amber-500/7 px-4 py-3 sm:px-5 sm:py-4" aria-label={t('title')}>
      <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-amber-300/85" aria-hidden="true">
        {t('title')}
      </p>
      <p className="mt-2 text-sm leading-7 text-amber-50/95 sm:text-[15px]">
        {pattern.statement}
      </p>
    </section>
  );
}
