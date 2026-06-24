'use client';

import {useCallback, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {formulationApi} from '@/lib/life-coach/api-client';
import type {FormulationGateResponse} from '@/lib/life-coach/types';

type Props = {
  children: React.ReactNode;
};

export function LifeCoachFormulationGate({children}: Props) {
  const t = useTranslations('formulation.gate');
  const [gate, setGate] = useState<FormulationGateResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const loadGate = useCallback(() => {
    setLoading(true);
    setLoadError(false);
    formulationApi
      .getGate()
      .then(({gate: g}) => setGate(g))
      .catch(() => setLoadError(true))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(loadGate, 0);
    return () => window.clearTimeout(timeout);
  }, [loadGate]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm txt-muted" aria-live="polite" aria-busy="true">
        <span
          className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--color-border)] border-t-[color:var(--color-border-strong)]"
          aria-hidden
        />
        <span>{t('loading')}</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <section className="panel-surface max-w-lg p-6" role="alert">
        <h3 className="text-lg font-black txt-strong">{t('errorTitle')}</h3>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t('errorBody')}</p>
        <button type="button" className="focus-ring btn-primary mt-5 text-sm" onClick={loadGate}>
          {t('retry')}
        </button>
      </section>
    );
  }

  if (!gate?.required) {
    return <>{children}</>;
  }

  return (
    <div className="grid gap-4">
      <div className="panel-surface max-w-lg p-5">
        <h3 className="text-lg font-black txt-strong">{t('title')}</h3>
        <p className="mt-2 text-sm leading-7 text-[var(--muted)]">{t('body')}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link
            className="focus-ring btn-secondary"
            href={
              gate.draft_id
                ? `/clarification?resume=${gate.draft_id}`
                : '/clarification'
            }
          >
            {gate.draft_id ? t('resume') : t('cta')}
          </Link>
        </div>
      </div>
      {children}
    </div>
  );
}
