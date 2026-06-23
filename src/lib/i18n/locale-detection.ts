import {defaultLocale, isLocale, type AppLocale} from '@/i18n/config';

export function detectLocaleFromAcceptLanguage(acceptLanguage: string | null | undefined): AppLocale {
  const languageHeader = acceptLanguage?.toLowerCase() ?? '';
  const languageRanges = languageHeader
    .split(',')
    .map((item) => item.trim().split(';')[0])
    .filter(Boolean);

  return languageRanges.some((range) => range === 'he' || range.startsWith('he-'))
    ? 'he'
    : defaultLocale;
}

export function resolveLocalePreference(input: {
  headerLocale?: string | null;
  cookieLocale?: string | null;
  acceptLanguage?: string | null;
}): AppLocale {
  if (input.headerLocale && isLocale(input.headerLocale)) {
    return input.headerLocale;
  }

  if (input.cookieLocale && isLocale(input.cookieLocale)) {
    return input.cookieLocale;
  }

  return detectLocaleFromAcceptLanguage(input.acceptLanguage);
}
