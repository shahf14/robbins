import {getTranslations} from 'next-intl/server';
import {Link} from '@/i18n/navigation';

export default async function LocaleNotFound() {
  const t = await getTranslations();

  return (
    <main className="page-shell grid min-h-[70vh] place-items-center py-10">
      <section className="panel-surface max-w-xl p-6 sm:p-8">
        <p className="eyebrow">404</p>
        <h1 className="mt-2 text-3xl font-black">{t('errors.notFoundTitle')}</h1>
        <p className="mt-3 leading-8 text-[var(--muted)]">{t('errors.notFoundBody')}</p>
        <Link
          href="/"
          className="focus-ring btn-primary mt-5 inline-flex"
        >
          {t('errors.backHome')}
        </Link>
      </section>
    </main>
  );
}
