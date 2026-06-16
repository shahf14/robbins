import {headers} from 'next/headers';
import {cookies} from 'next/headers';
import {redirect} from 'next/navigation';
import {defaultLocale, isLocale, locales, type AppLocale} from '@/i18n/config';

export default async function RootPage() {
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value;
  if (cookieLocale && isLocale(cookieLocale)) {
    redirect(`/${cookieLocale}`);
  }
  const acceptLanguage = (await headers()).get('accept-language') ?? '';
  const locale = detectLocale(acceptLanguage);

  redirect(`/${locale}`);
}

function detectLocale(acceptLanguage: string): AppLocale {
  const requested = acceptLanguage
    .split(',')
    .map((part) => part.trim().split(';')[0]?.toLowerCase())
    .filter(Boolean);

  if (requested.some((locale) => locale === 'he' || locale.startsWith('he-'))) {
    return 'he';
  }

  if (requested.some((locale) => locale === 'en' || locale.startsWith('en-'))) {
    return 'en';
  }

  return locales.includes(defaultLocale) ? defaultLocale : 'en';
}
