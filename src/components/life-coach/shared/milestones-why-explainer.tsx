'use client';

import {useTranslations} from 'next-intl';

type Props = {
  className?: string;
};

export function MilestonesWhyExplainer({className = ''}: Props) {
  const t = useTranslations();

  return (
    <p
      className={`rounded-xl border border-[color:var(--color-border)] fill-1 px-4 py-3 text-sm leading-6 text-[var(--muted)] ${className}`}
      role="note"
    >
      <span className="font-semibold txt-soft">{t('goalWizard.milestonesWhyLabel')}: </span>
      {t('goalWizard.milestonesWhyExplainer')}
    </p>
  );
}
