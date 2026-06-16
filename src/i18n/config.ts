import {defineRouting} from 'next-intl/routing';

export const locales = ['en', 'he'] as const;

export type AppLocale = (typeof locales)[number];

export const defaultLocale: AppLocale = 'en';

export const localeNames: Record<AppLocale, string> = {
  en: 'English',
  he: 'עברית'
};

export const localeDirections: Record<AppLocale, 'ltr' | 'rtl'> = {
  en: 'ltr',
  he: 'rtl'
};

export function isLocale(value: string): value is AppLocale {
  return locales.includes(value as AppLocale);
}

export const routing = defineRouting({
  locales,
  defaultLocale,
  localePrefix: 'always',
  localeDetection: true
});
