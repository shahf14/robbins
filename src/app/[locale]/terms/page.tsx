import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {isLocale} from '@/i18n/config';

type Props = {
  params: Promise<{locale: string}>;
};

export default async function TermsPage({params}: Props) {
  const {locale: rawLocale} = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  setRequestLocale(rawLocale);
  const t = await getTranslations();

  return (
    <main className="section-block border-t-0">
      <div className="page-shell">
        <section className="panel-surface p-6 sm:p-8">
          <p className="eyebrow">Terms</p>
          <h1 className="text-3xl font-black">{t('terms.pageTitle')}</h1>
          <div className="mt-5 grid gap-4 leading-8 text-[var(--muted)]">
            <p>{t('terms.intro')}</p>
            <p>{t('terms.use')}</p>
            <p>{t('terms.limits')}</p>
            <p>{t('terms.data')}</p>
          </div>
        </section>
      </div>
    </main>
  );
}
