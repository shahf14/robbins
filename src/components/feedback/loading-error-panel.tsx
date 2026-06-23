'use client';

import {useTranslations} from 'next-intl';
import type {ApiLoadFailureKind} from '@/lib/life-coach/api-error';
import {ApiAccessPanel} from '@/components/feedback/api-access-panel';

type Props = {
  loading?: boolean;
  error?: string | null;
  failure?: ApiLoadFailureKind | null;
  onRetry?: () => void;
  loadingLabel?: string;
  className?: string;
};

export function LoadingErrorPanel({
  loading,
  error,
  failure,
  onRetry,
  loadingLabel,
  className = 'panel-surface p-6 sm:p-8',
}: Props) {
  const t = useTranslations();

  if (loading) {
    return (
      <section className={className} aria-live="polite" aria-busy="true">
        <div className="flex items-center gap-3">
          <span
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white/80"
            aria-hidden
          />
          <p className="text-sm font-semibold text-[var(--muted)]">
            {loadingLabel ?? t('lifeCoach.loading')}
          </p>
        </div>
      </section>
    );
  }

  if (failure) {
    return (
      <ApiAccessPanel
        failure={failure}
        onRetry={onRetry ?? (() => {})}
        className={className}
      />
    );
  }

  if (error) {
    return (
      <section className={className} role="alert">
        <p className="text-sm font-semibold text-red-300">{error}</p>
        {onRetry && (
          <button className="focus-ring btn-small mt-4" type="button" onClick={onRetry}>
            {t('errors.tryAgain')}
          </button>
        )}
      </section>
    );
  }

  return null;
}
