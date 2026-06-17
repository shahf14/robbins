'use client';

import {useTranslations} from 'next-intl';

type Props = {
  loading: boolean;
  canGoBack: boolean;
  canRestart: boolean;
  onBack: () => void;
  onRestart: () => void;
};

export function WizardStepNav({loading, canGoBack, canRestart, onBack, onRestart}: Props) {
  const t = useTranslations('formulation');

  if (!canGoBack && !canRestart) return null;

  return (
    <nav
      className="mt-8 flex flex-wrap gap-2 border-t border-[color:var(--color-border)] pt-6"
      aria-label={t('nav.ariaLabel')}
    >
      {canGoBack && (
        <button
          type="button"
          className="focus-ring btn-ghost"
          disabled={loading}
          aria-busy={loading}
          onClick={onBack}
        >
          {t('nav.backOne')}
        </button>
      )}
      {canRestart && (
        <button
          type="button"
          className="focus-ring btn-ghost txt-soft"
          disabled={loading}
          aria-busy={loading}
          onClick={onRestart}
        >
          {t('nav.restart')}
        </button>
      )}
    </nav>
  );
}
