'use client';

import {useTranslations} from 'next-intl';

type Props = {
  className?: string;
};

const ITEM_KEYS = [
  'goalWizard.aiBuildPreviewGoal',
  'goalWizard.aiBuildPreviewMilestones',
  'goalWizard.aiBuildPreviewSteps',
] as const;

export function GoalWizardAiBuildPreview({className = ''}: Props) {
  const t = useTranslations();

  return (
    <div
      className={`rounded-2xl border border-[var(--blue)]/20 bg-[rgba(26,109,255,0.06)] p-4 sm:p-5 ${className}`}
      role="note"
      aria-label={t('goalWizard.aiBuildPreviewTitle')}
    >
      <p className="text-sm font-bold text-white" aria-hidden="true">{t('goalWizard.aiBuildPreviewTitle')}</p>
      <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{t('goalWizard.aiBuildPreviewSummary')}</p>
      <ul className="mt-4 grid gap-2.5">
        {ITEM_KEYS.map((key) => (
          <li key={key} className="flex items-start gap-2.5 text-sm leading-6 text-white/75">
            <span className="mt-0.5 shrink-0 font-bold text-[var(--blue)]" aria-hidden>
              →
            </span>
            <span>{t(key)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
