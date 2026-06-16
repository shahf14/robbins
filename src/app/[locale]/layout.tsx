import type {Metadata} from 'next';
import {NextIntlClientProvider} from 'next-intl';
import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import type {ReactNode} from 'react';
import {AppHeader} from '@/components/app-header';
import {AppProviders} from '@/components/feedback/app-providers';
import {PwaRegister} from '@/components/pwa-register';
import {ScheduleReminderPoller} from '@/components/schedule-reminder-poller';
import {isLocale, locales, type AppLocale} from '@/i18n/config';

export function generateStaticParams() {
  return locales.map((locale) => ({locale}));
}

export async function generateMetadata({params}: {params: Promise<{locale: string}>}): Promise<Metadata> {
  const {locale: rawLocale} = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : 'en';

  setRequestLocale(locale);
  const t = await getTranslations();

  return {
    title: t('meta.title'),
    description: t('meta.description'),
    icons: {
      icon: '/icon.svg'
    }
  };
}

type Props = {
  children: ReactNode;
  params: Promise<{locale: string}>;
};

export default async function LocaleLayout({children, params}: Props) {
  const {locale: rawLocale} = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  const locale: AppLocale = rawLocale;
  setRequestLocale(locale);
  const messages = (await import(`../../../messages/${locale}.json`)).default;

  const skipLabel = locale === 'he' ? 'דלג לתוכן הראשי' : 'Skip to main content';

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <AppProviders>
      {/* Skip-to-content — keyboard accessibility (#30) */}
      <a
        href="#main-content"
        className="focus-ring sr-only focus:not-sr-only focus:fixed focus:start-4 focus:top-4 focus:z-[100] focus:rounded-xl focus:bg-[var(--blue)] focus:px-4 focus:py-2 focus:text-sm focus:font-bold focus:text-white"
      >
        {skipLabel}
      </a>
      <AppHeader />
      <div id="main-content" tabIndex={-1}>
        {children}
      </div>
      <PwaRegister />
      <ScheduleReminderPoller />
      </AppProviders>
    </NextIntlClientProvider>
  );
}
