'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {ApiLoadFailureKind} from '@/lib/life-coach/api-error';
import {
  getStoredLocalAuthToken,
  setStoredLocalAuthToken,
} from '@/lib/auth/client-headers';
import {verifyLocalAuthToken, type LocalAuthVerifyResult} from '@/lib/auth/verify-local-token';

type VerifyFailReason = Extract<LocalAuthVerifyResult, {ok: false}>['reason'];

type Props = {
  failure: ApiLoadFailureKind;
  onRetry: () => void;
  className?: string;
};

export function ApiAccessPanel({failure, onRetry, className = 'panel-surface p-6 sm:p-8'}: Props) {
  const t = useTranslations('errors.apiAccess');
  const [token, setToken] = useState(() => getStoredLocalAuthToken());
  const [tokenSaved, setTokenSaved] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [tokenError, setTokenError] = useState<VerifyFailReason | null>(null);

  async function saveTokenAndRetry() {
    setVerifying(true);
    setTokenError(null);
    setTokenSaved(false);

    const trimmed = token.trim();
    if (!trimmed) {
      setStoredLocalAuthToken('');
      setVerifying(false);
      onRetry();
      return;
    }

    const result = await verifyLocalAuthToken(trimmed, {notifyOnUnauthorized: false});
    setVerifying(false);

    if (!result.ok) {
      setTokenError(result.reason);
      return;
    }

    setStoredLocalAuthToken(token);
    setTokenSaved(true);
    window.setTimeout(() => setTokenSaved(false), 2000);
    onRetry();
  }

  function tokenErrorMessage(reason: VerifyFailReason) {
    if (reason === 'missing' || reason === 'unauthorized') return t('authInvalidToken');
    if (reason === 'offline') return t('authOffline');
    return t('authServerError');
  }

  if (failure === 'auth') {
    return (
      <section className={className} role="alert">
        <p className="eyebrow">{t('authEyebrow')}</p>
        <h2 className="mt-3 text-xl font-black txt-strong">{t('authTitle')}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 txt-muted">{t('authBody')}</p>
        <div className="mt-5 grid gap-3 sm:grid-cols-[1fr_auto]">
          <input
            className="focus-ring input-base text-sm"
            type="password"
            value={token}
            placeholder={t('authTokenPlaceholder')}
            autoComplete="off"
            onChange={(event) => {
              setToken(event.target.value);
              setTokenError(null);
            }}
          />
          <button
            type="button"
            className="focus-ring btn-primary text-sm"
            disabled={verifying}
            onClick={() => void saveTokenAndRetry()}
          >
            {verifying ? t('authVerifying') : tokenSaved ? t('authSaved') : t('authSaveAndRetry')}
          </button>
        </div>
        {tokenError ? (
          <p className="mt-3 text-sm text-[color:var(--color-danger,#f87171)]" role="alert">
            {tokenErrorMessage(tokenError)}
          </p>
        ) : null}
        <p className="mt-3 text-xs txt-faint">
          <Link href="/settings" className="underline underline-offset-2 hover:txt-soft">
            {t('authSettingsLink')}
          </Link>
        </p>
      </section>
    );
  }

  if (failure === 'onboarding') {
    return (
      <section className={className} role="alert">
        <p className="eyebrow">{t('onboardingEyebrow')}</p>
        <h2 className="mt-3 text-xl font-black txt-strong">{t('onboardingTitle')}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 txt-muted">{t('onboardingBody')}</p>
        <Link href="/onboarding" className="focus-ring btn-primary mt-5 inline-flex">
          {t('onboardingCta')}
        </Link>
      </section>
    );
  }

  if (failure === 'offline') {
    return (
      <section className={className} role="alert">
        <p className="eyebrow">{t('offlineEyebrow')}</p>
        <h2 className="mt-3 text-xl font-black txt-strong">{t('offlineTitle')}</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 txt-muted">{t('offlineBody')}</p>
        <button className="focus-ring btn-small mt-5" type="button" onClick={onRetry}>
          {t('retry')}
        </button>
      </section>
    );
  }

  return (
    <section className={className} role="alert">
      <p className="eyebrow">{t('transientEyebrow')}</p>
      <h2 className="mt-3 text-xl font-black txt-strong">{t('transientTitle')}</h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 txt-muted">{t('transientBody')}</p>
      <button className="focus-ring btn-small mt-5" type="button" onClick={onRetry}>
        {t('retry')}
      </button>
    </section>
  );
}
