'use client';

import {useTranslations} from 'next-intl';

type Props = {
  className?: string;
  compact?: boolean;
};

export function WeeklyReviewExplainer({className = '', compact = false}: Props) {
  const t = useTranslations();

  if (compact) {
    return (
      <p className={`text-xs leading-5 txt-soft ${className}`.trim()}>
        <span className="font-semibold txt-soft">{t('lifeCoach.weeklyReviewWhenWhyTitle')}: </span>
        {t('lifeCoach.weeklyReviewWhenWhyExplainer')}
      </p>
    );
  }

  return (
    <div
      className={`rounded-xl border border-[var(--blue)]/25 bg-[rgba(26,109,255,0.08)] px-4 py-3 ${className}`.trim()}
      role="note"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">
        {t('lifeCoach.weeklyReviewWhenWhyTitle')}
      </p>
      <p className="mt-1.5 text-sm leading-6 txt-strong">{t('lifeCoach.weeklyReviewWhenWhyExplainer')}</p>
    </div>
  );
}
