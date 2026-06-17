'use client';

import {useTranslations} from 'next-intl';

type Props = {
  className?: string;
};

export function AiInsightsVsWeeklyReviewExplainer({className = ''}: Props) {
  const t = useTranslations();

  return (
    <div
      className={`rounded-xl border border-[color:var(--color-border)] fill-1 px-4 py-3 ${className}`.trim()}
      role="note"
    >
      <p className="text-xs font-bold uppercase tracking-wide txt-muted">
        {t('lifeCoach.aiInsightsVsReviewTitle')}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-4">
        <p className="text-sm leading-6 txt-soft sm:border-e sm:border-[color:var(--color-border)] sm:pe-4">
          <span className="font-bold txt-strong">{t('lifeCoach.aiInsightsWeeklyReviewLabel')}</span>
          <span className="font-semibold txt-muted"> = </span>
          <span className="font-semibold txt-strong">{t('lifeCoach.aiInsightsWeeklyReviewRole')}</span>
        </p>
        <p className="text-sm leading-6 txt-soft">
          <span className="font-bold txt-strong">{t('lifeCoach.aiInsightsInsightsLabel')}</span>
          <span className="font-semibold txt-muted"> = </span>
          <span className="font-semibold txt-strong">{t('lifeCoach.aiInsightsInsightsRole')}</span>
        </p>
      </div>
    </div>
  );
}
