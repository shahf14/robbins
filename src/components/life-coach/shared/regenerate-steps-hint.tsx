'use client';

import {useTranslations} from 'next-intl';

type Props = {
  className?: string;
};

export function RegenerateStepsHint({className = ''}: Props) {
  const t = useTranslations();

  return (
    <div
      className={`rounded-xl border border-[var(--blue)]/30 bg-[linear-gradient(135deg,rgba(26,109,255,0.12),rgba(26,109,255,0.04))] px-4 py-3 ${className}`.trim()}
      role="note"
    >
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]">
        {t('lifeCoach.regenerateSafeHintTitle')}
      </p>
      <p className="mt-1.5 text-sm leading-6 txt-strong">{t('lifeCoach.regenerateSafeHint')}</p>
      <p className="mt-1 text-xs leading-5 txt-muted">{t('lifeCoach.regenerateSafeHintDetail')}</p>
    </div>
  );
}
