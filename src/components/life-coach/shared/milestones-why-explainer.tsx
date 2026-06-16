'use client';

import {useTranslations} from 'next-intl';

type Props = {
  className?: string;
};

export function MilestonesWhyExplainer({className = ''}: Props) {
  const t = useTranslations();

  return (
    <p
      className={`rounded-xl border border-white/10 bg-white/3 px-4 py-3 text-sm leading-6 text-[var(--muted)] ${className}`}
      role="note"
    >
      <span className="font-semibold text-white/70">{t('goalWizard.milestonesWhyLabel')}: </span>
      {t('goalWizard.milestonesWhyExplainer')}
    </p>
  );
}
