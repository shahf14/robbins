import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {isLocale, type AppLocale} from '@/i18n/config';

type Props = {
  params: Promise<{locale: string}>;
};

export default async function PrivacyPage({params}: Props) {
  const {locale: rawLocale} = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  setRequestLocale(rawLocale);
  const t = await getTranslations();

  return (
    <main className="section-block border-t-0">
      <div className="page-shell">
        <LegalSection
          title={t('privacy.pageTitle')}
          items={[
            t('privacy.intro'),
            t('privacy.local'),
            t('privacy.analyticsControl'),
            t('privacy.server'),
            t('privacy.security'),
            t('privacy.contact')
          ]}
        />
      </div>
    </main>
  );
}

function LegalSection({title, items}: {title: string; items: string[]}) {
  return (
    <section className="panel-surface p-6 sm:p-8">
      <p className="eyebrow">Privacy</p>
      <h1 className="text-3xl font-black">{title}</h1>
      <div className="mt-5 grid gap-4 leading-8 text-[var(--muted)]">
        {items.map((item) => (
          <p key={item}>{item}</p>
        ))}
      </div>
    </section>
  );
}
