import {ResetUserDataSection} from '@/components/help/reset-user-data-section';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {isLocale} from '@/i18n/config';

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props) {
  const {locale: rawLocale} = await params;
  if (!isLocale(rawLocale)) notFound();
  setRequestLocale(rawLocale);
  const t = await getTranslations();
  return {title: t('help.pageTitle')};
}

export default async function HelpPage({params}: Props) {
  const {locale: rawLocale} = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  setRequestLocale(rawLocale);
  const t = await getTranslations();
  const faq = t.raw('help.faq') as Array<{q: string; a: string}>;

  return (
    <main className="section-block border-t-0">
      <div className="page-shell grid gap-6">

        {/* Header */}
        <section className="panel-surface-strong px-6 py-8 sm:px-8 sm:py-10">
          <p className="eyebrow">{t('help.eyebrow')}</p>
          <h1 className="mt-4 text-3xl font-black sm:text-4xl">{t('help.pageTitle')}</h1>
          <p className="mt-4 max-w-3xl leading-8 text-[var(--muted)]">{t('help.intro')}</p>
        </section>

        {/* How it works */}
        <section className="panel-surface p-6 sm:p-8">
          <p className="field-label mb-0 text-[var(--blue)]">{t('nav.help')}</p>
          <h2 className="mt-4 text-2xl font-black txt-strong">{t('help.pageTitle')}</h2>
          <ol className="mt-6 grid gap-4 sm:grid-cols-2">
            {([1, 2, 3, 4] as const).map((n) => (
              <li key={n} className="flex gap-4 rounded-[20px] border border-[color:var(--color-border)] fill-1 p-5">
                <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--blue)]/15 text-sm font-black text-[var(--blue)]">
                  {n}
                </span>
                <p className="text-sm leading-7 txt-strong">{t(`help.step${n}`)}</p>
              </li>
            ))}
          </ol>
        </section>

        {/* FAQ */}
        <section className="panel-surface p-6 sm:p-8">
          <p className="field-label mb-0 txt-muted">FAQ</p>
          <h2 className="mt-4 text-2xl font-black txt-strong">{t('help.faqTitle')}</h2>
          <div className="mt-6 grid gap-4">
            {faq.map((item, i) => (
              <details
                key={item.q}
                className="group rounded-[20px] border border-[color:var(--color-border)] fill-1 p-5 open:border-[var(--blue)]/25 open:bg-[rgba(26,109,255,0.04)]"
              >
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 text-base font-bold txt-strong marker:hidden">
                  <span>{item.q}</span>
                  <span className="shrink-0 text-[var(--blue)] transition-transform group-open:rotate-45" aria-hidden>+</span>
                </summary>
                <p className="mt-4 text-sm leading-7 text-[var(--muted)]">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Contact */}
        <section className="panel-surface p-6 sm:p-8">
          <p className="field-label mb-0 txt-muted">{t('help.contactTitle')}</p>
          <p className="mt-3 max-w-2xl leading-7 text-[var(--muted)]">{t('help.contactBody')}</p>
        </section>

        <ResetUserDataSection />

      </div>
    </main>
  );
}
