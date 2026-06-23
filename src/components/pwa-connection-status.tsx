'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';

export function PwaConnectionStatus() {
  const t = useTranslations('errors.apiAccess');
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    function sync() {
      setOffline(!window.navigator.onLine);
    }

    sync();
    window.addEventListener('online', sync);
    window.addEventListener('offline', sync);
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', sync);
    };
  }, []);

  if (!offline) {
    return null;
  }

  return (
    <div
      className="border-b border-amber-400/30 bg-amber-500/10 px-4 py-2 text-center text-sm font-semibold txt-strong"
      role="status"
      aria-live="polite"
    >
      {t('offlineShell')}
    </div>
  );
}
