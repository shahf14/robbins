import {isLocale, type AppLocale} from '@/i18n/config';

export const LOCALIZED_AUTH_PATH = /^\/(en|he)\/(sign-in|sign-up)(\/.*)?$/;

export function isLegacyAuthPath(pathname: string): boolean {
  return (
    pathname === '/sign-in' ||
    pathname.startsWith('/sign-in/') ||
    pathname === '/sign-up' ||
    pathname.startsWith('/sign-up/')
  );
}

export function localizedAuthRewriteTarget(pathname: string): string | null {
  const match = pathname.match(LOCALIZED_AUTH_PATH);
  if (!match) return null;
  return `/${match[2]}${match[3] ?? ''}`;
}

export function localizedAuthLocale(pathname: string): AppLocale | null {
  const match = pathname.match(LOCALIZED_AUTH_PATH);
  if (!match || !isLocale(match[1])) return null;
  return match[1];
}
