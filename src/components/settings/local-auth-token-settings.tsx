'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {
  getStoredLocalAuthToken,
  setStoredLocalAuthToken,
} from '@/lib/auth/client-headers';
import {verifyLocalAuthToken, type LocalAuthVerifyResult} from '@/lib/auth/verify-local-token';

type VerifyFailReason = Extract<LocalAuthVerifyResult, {ok: false}>['reason'];

export function LocalAuthTokenSettings() {
  const t = useTranslations('settings.localAuth');
  const [token, setToken] = useState(() => getStoredLocalAuthToken());
  const [saved, setSaved] = useState(false);
  const [cleared, setCleared] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [errorKey, setErrorKey] = useState<VerifyFailReason | null>(null);

  async function saveToken() {
    setVerifying(true);
    setErrorKey(null);
    setSaved(false);
    setCleared(false);

    const trimmed = token.trim();
    if (!trimmed) {
      setStoredLocalAuthToken('');
      setVerifying(false);
      setCleared(true);
      window.setTimeout(() => setCleared(false), 4000);
      return;
    }

    const result = await verifyLocalAuthToken(trimmed, {notifyOnUnauthorized: false});
    setVerifying(false);

    if (!result.ok) {
      setErrorKey(result.reason);
      return;
    }

    setStoredLocalAuthToken(token);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  function errorMessage(reason: VerifyFailReason) {
    if (reason === 'missing' || reason === 'unauthorized') return t('invalidToken');
    if (reason === 'offline') return t('offlineError');
    return t('serverError');
  }

  return (
    <section className="panel-surface p-6 sm:p-8" aria-labelledby="settings-local-auth-heading">
      <h2 id="settings-local-auth-heading" className="text-lg font-black txt-strong">
        {t('title')}
      </h2>
      <p className="mt-2 text-sm leading-6 txt-muted">{t('body')}</p>
      <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          className="focus-ring input-base text-sm"
          type="password"
          value={token}
          placeholder={t('placeholder')}
          autoComplete="off"
          onChange={(event) => {
            setToken(event.target.value);
            setErrorKey(null);
            setCleared(false);
          }}
        />
        <button
          type="button"
          className="focus-ring btn-secondary text-sm"
          disabled={verifying}
          onClick={() => void saveToken()}
        >
          {verifying ? t('verifying') : cleared ? t('cleared') : saved ? t('saved') : t('save')}
        </button>
      </div>
      {cleared ? (
        <p className="mt-3 text-sm leading-6 text-amber-300/90" role="status">
          {t('clearedBody')}
        </p>
      ) : null}
      {errorKey ? (
        <p className="mt-3 text-sm text-[color:var(--color-danger,#f87171)]" role="alert">
          {errorMessage(errorKey)}
        </p>
      ) : null}
    </section>
  );
}
