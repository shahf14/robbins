import {NextIntlClientProvider} from 'next-intl';
import {localeDirections, type AppLocale} from '@/i18n/config';
import {AuthDisabledClerkPanel} from '@/components/auth/auth-disabled-clerk-panel';

type Props = {
  locale: AppLocale;
  variant: 'sign-in' | 'sign-up';
};

export async function AuthDisabledFallback({locale, variant}: Props) {
  const messages = (await import(`../../../messages/${locale}.json`)).default;
  const dir = localeDirections[locale];

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <main className="flex min-h-screen items-center justify-center p-6" dir={dir} lang={locale}>
        <AuthDisabledClerkPanel locale={locale} variant={variant} />
      </main>
    </NextIntlClientProvider>
  );
}
