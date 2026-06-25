import {localeDirections, type AppLocale} from '@/i18n/config';
import {AuthDisabledClerkPanel} from '@/components/auth/auth-disabled-clerk-panel';
import {GenderedIntlProvider} from '@/components/i18n/gendered-intl-provider';

type Props = {
  locale: AppLocale;
  variant: 'sign-in' | 'sign-up';
};

export async function AuthDisabledFallback({locale, variant}: Props) {
  const messages = (await import(`../../../messages/${locale}.json`)).default;
  const dir = localeDirections[locale];

  return (
    <GenderedIntlProvider locale={locale} messages={messages}>
      <main className="flex min-h-screen items-center justify-center p-6" dir={dir} lang={locale}>
        <AuthDisabledClerkPanel locale={locale} variant={variant} />
      </main>
    </GenderedIntlProvider>
  );
}
