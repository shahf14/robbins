'use client';

import {useTranslations} from 'next-intl';
import type {ApiLoadFailureKind} from '@/lib/life-coach/api-error';
import {ApiAccessPanel} from '@/components/feedback/api-access-panel';
import type {HomeOptionalSection} from '@/lib/home/load-home-dashboard-data';

type Props = {
  failure: ApiLoadFailureKind | null;
  partialFailures: HomeOptionalSection[];
  stale: boolean;
  onRetry: () => void;
};

export function HomeLoadStatusBanner({failure, partialFailures, stale, onRetry}: Props) {
  const t = useTranslations('dashboard.loadStatus');

  if (failure) {
    return (
      <div className="grid gap-3">
        {stale ? (
          <section className="panel-surface border border-amber-400/30 p-4 sm:p-5" role="status">
            <p className="text-sm font-bold txt-strong">{t('staleTitle')}</p>
            <p className="mt-1 text-sm leading-6 txt-muted">{t('staleBody')}</p>
          </section>
        ) : null}
        <ApiAccessPanel failure={failure} onRetry={onRetry} className="panel-surface p-6 sm:p-8" />
      </div>
    );
  }

  if (partialFailures.length === 0) {
    return null;
  }

  return (
    <section
      className="panel-surface border border-amber-400/30 p-4 sm:p-5"
      role="status"
      aria-live="polite"
    >
      <p className="text-sm font-bold txt-strong">{t('partialTitle')}</p>
      <p className="mt-1 text-sm leading-6 txt-muted">{t('partialBody')}</p>
      <button type="button" className="focus-ring btn-small mt-4" onClick={onRetry}>
        {t('retry')}
      </button>
    </section>
  );
}
