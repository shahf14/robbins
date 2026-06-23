import {cookies, headers} from 'next/headers';
import type {AppLocale} from '@/i18n/config';
import {resolveLocalePreference} from '@/lib/i18n/locale-detection';

export async function resolveAuthPageLocale(): Promise<AppLocale> {
  const requestHeaders = await headers();

  return resolveLocalePreference({
    headerLocale: requestHeaders.get('x-robbins-locale'),
    cookieLocale: (await cookies()).get('NEXT_LOCALE')?.value,
    acceptLanguage: requestHeaders.get('accept-language'),
  });
}
