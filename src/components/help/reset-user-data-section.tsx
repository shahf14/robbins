'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import {useConfirm} from '@/components/feedback/confirm-provider';
import {resetAllUserData} from '@/lib/user-reset';

export function ResetUserDataSection() {
  const t = useTranslations('help.resetData');
  const router = useRouter();
  const {confirm} = useConfirm();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleReset() {
    setError(null);
    const ok = await confirm({
      title: t('confirmTitle'),
      message: t('confirmMessage'),
      confirmLabel: t('confirmButton'),
      destructive: true,
    });
    if (!ok) return;

    setBusy(true);
    try {
      await resetAllUserData();
      router.replace('/onboarding');
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : t('error'));
      setBusy(false);
    }
  }

  return (
    <section className="panel-surface border border-red-500/20 p-6 sm:p-8">
      <p className="field-label mb-0 text-red-300/80">{t('eyebrow')}</p>
      <h2 className="mt-4 text-2xl font-black txt-strong">{t('title')}</h2>
      <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">{t('body')}</p>
      {error && (
        <p className="mt-4 rounded-[16px] border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      )}
      <button
        type="button"
        className="focus-ring mt-6 rounded-2xl border border-red-500/40 bg-red-500/15 px-5 py-2.5 text-sm font-bold text-red-200 disabled:opacity-60"
        disabled={busy}
        onClick={() => void handleReset()}
      >
        {busy ? t('resetting') : t('button')}
      </button>
    </section>
  );
}
