'use client';

import {useTranslations} from 'next-intl';
import {ApiAccessPanel} from '@/components/feedback/api-access-panel';

type Props = {
  checking: boolean;
  onRetry: () => void;
};

export function LocalAuthGate({checking, onRetry}: Props) {
  const t = useTranslations('errors.apiAccess');

  return (
    <div
      className="fixed inset-0 z-[120] flex items-center justify-center bg-[rgba(0,0,0,0.58)] p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="local-auth-gate-title"
    >
      <div className="w-full max-w-xl">
        {checking ? (
          <section className="panel-surface-strong p-8 text-center shadow-2xl" aria-busy="true">
            <span
              className="inline-block h-8 w-8 animate-spin rounded-full border-2 border-[color:var(--color-border)] border-t-[color:var(--color-border-strong)]"
              aria-hidden
            />
            <p id="local-auth-gate-title" className="mt-4 text-sm leading-7 txt-muted">
              {t('checking')}
            </p>
          </section>
        ) : (
          <ApiAccessPanel
            failure="auth"
            onRetry={onRetry}
            className="panel-surface-strong p-6 shadow-2xl sm:p-8"
          />
        )}
      </div>
    </div>
  );
}
