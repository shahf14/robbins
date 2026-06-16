import {NextRequest, NextResponse} from 'next/server';
import {defaultLocale, isLocale, type AppLocale} from './i18n/config';

export default function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const pathnameLocale = getPathnameLocale(pathname);
  const locale = pathnameLocale ?? detectLocale(request);

  if (!pathnameLocale) {
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname === '/' ? '' : pathname}`;
    return NextResponse.redirect(url);
  }

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-robbins-locale', locale);

  return NextResponse.next({
    request: {
      headers: requestHeaders
    }
  });
}

export const config = {
  matcher: ['/((?!api|_next|_vercel|.*\\..*).*)']
};

function getPathnameLocale(pathname: string): AppLocale | undefined {
  const segment = pathname.split('/')[1];
  return isLocale(segment) ? segment : undefined;
}

function detectLocale(request: NextRequest): AppLocale {
  const cookieLocale = request.cookies.get('NEXT_LOCALE')?.value;
  if (cookieLocale && isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const languageHeader = request.headers.get('accept-language')?.toLowerCase() ?? '';
  const languageRanges = languageHeader
    .split(',')
    .map((item) => item.trim().split(';')[0])
    .filter(Boolean);

  return languageRanges.some((range) => range === 'he' || range.startsWith('he-'))
    ? 'he'
    : defaultLocale;
}
