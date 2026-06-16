'use client';

import {useTranslations} from 'next-intl';

type Props = {
  className?: string;
};

export function AiInsightsVsWeeklyReviewExplainer({className = ''}: Props) {
  const t = useTranslations();

  return (
    <div
      className={`rounded-xl border border-white/10 bg-white/3 px-4 py-3 ${className}`.trim()}
      role="note"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-white/50">
        {t('lifeCoach.aiInsightsVsReviewTitle')}
      </p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2 sm:gap-4">
        <p className="text-sm leading-6 text-white/75 sm:border-e sm:border-white/10 sm:pe-4">
          <span className="font-bold text-white">{t('lifeCoach.aiInsightsWeeklyReviewLabel')}</span>
          <span className="font-semibold text-white/45"> = </span>
          <span className="font-semibold text-white/80">{t('lifeCoach.aiInsightsWeeklyReviewRole')}</span>
        </p>
        <p className="text-sm leading-6 text-white/75">
          <span className="font-bold text-white">{t('lifeCoach.aiInsightsInsightsLabel')}</span>
          <span className="font-semibold text-white/45"> = </span>
          <span className="font-semibold text-white/80">{t('lifeCoach.aiInsightsInsightsRole')}</span>
        </p>
      </div>
    </div>
  );
}
