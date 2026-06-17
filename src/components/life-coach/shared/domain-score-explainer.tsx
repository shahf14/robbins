'use client';

import {useTranslations} from 'next-intl';

type Props = {
  className?: string;
  compact?: boolean;
};

export function DomainScoreExplainer({className = '', compact = false}: Props) {
  const t = useTranslations();

  if (compact) {
    return (
      <p className={`text-xs leading-5 txt-muted ${className}`}>
        <span className="font-semibold txt-soft">{t('lifeCoach.domainScoreLabel')}: </span>
        {t('lifeCoach.domainScoreExplainer')}
      </p>
    );
  }

  return (
    <p
      role="note"
      className={`rounded-xl border border-[color:var(--color-border)] fill-1 px-4 py-3 text-sm leading-6 txt-soft ${className}`}
    >
      <span className="font-semibold txt-soft">{t('lifeCoach.domainScoreLabel')}: </span>
      {t('lifeCoach.domainScoreExplainer')}
    </p>
  );
}
