'use client';

import {useTranslations} from 'next-intl';

export default function LocaleError({reset}: {error: Error; reset: () => void}) {
  const t = useTranslations();

  return (
    <main className="page-shell grid min-h-[70vh] place-items-center py-10">
      <section className="panel-surface max-w-xl p-6 sm:p-8">
        <p className="eyebrow">{t('errors.runtimeEyebrow')}</p>
        <h1 className="mt-2 text-3xl font-black">{t('errors.runtimeTitle')}</h1>
        <p className="mt-3 leading-8 text-[var(--muted)]">{t('errors.runtimeBody')}</p>
        <button
          className="focus-ring btn-primary mt-5"
          type="button"
          onClick={reset}
        >
          {t('errors.tryAgain')}
        </button>
      </section>
    </main>
  );
}
