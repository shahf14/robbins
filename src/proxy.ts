import {clerkMiddleware, createRouteMatcher} from '@clerk/nextjs/server';
import createIntlMiddleware from 'next-intl/middleware';
import {NextRequest, NextResponse} from 'next/server';
import {jsonError} from '@/lib/api-response';
import {isClerkConfigured} from '@/lib/auth/clerk-config';
import {
  isLegacyAuthPath,
  localizedAuthLocale,
  localizedAuthRewriteTarget,
} from '@/lib/i18n/auth-route';
import {defaultLocale, isLocale, routing, type AppLocale} from './i18n/config';
import {resolveLocalePreference} from './lib/i18n/locale-detection';

const handleI18nRouting = createIntlMiddleware(routing);

const isPublicRoute = createRouteMatcher([
  '/sign-in(.*)',
  '/sign-up(.*)',
  '/:locale/sign-in(.*)',
  '/:locale/sign-up(.*)',
  '/api/cron(.*)',
  '/api/webhooks/clerk(.*)',
  '/:locale/privacy',
  '/:locale/terms',
  '/:locale/help',
]);

const clerkEnabled = isClerkConfigured();

function detectLocale(request: NextRequest): AppLocale {
  return resolveLocalePreference({
    cookieLocale: request.cookies.get('NEXT_LOCALE')?.value,
    acceptLanguage: request.headers.get('accept-language'),
  });
}

function composeLocaleResponse(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  if (pathname.startsWith('/api')) {
    return NextResponse.next();
  }

  const rewriteTarget = localizedAuthRewriteTarget(pathname);
  if (rewriteTarget) {
    const locale = localizedAuthLocale(pathname) ?? defaultLocale;
    const requestHeaders = new Headers(request.headers);
    requestHeaders.set('x-robbins-locale', locale);

    const url = request.nextUrl.clone();
    url.pathname = rewriteTarget;

    return NextResponse.rewrite(url, {
      request: {
        headers: requestHeaders,
      },
    });
  }

  if (isLegacyAuthPath(pathname)) {
    const locale = detectLocale(request);
    const url = request.nextUrl.clone();
    url.pathname = `/${locale}${pathname}`;
    return NextResponse.redirect(url);
  }

  return handleI18nRouting(request);
}

function redirectToLocalizedSignIn(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  const locale = getPathnameLocale(pathname) ?? detectLocale(request);
  const signInUrl = new URL(`/${locale}/sign-in`, request.url);
  signInUrl.searchParams.set('redirect_url', request.url);
  return NextResponse.redirect(signInUrl);
}

const proxy = clerkEnabled
  ? clerkMiddleware(async (auth, request) => {
      if (!isPublicRoute(request)) {
        const {userId} = await auth();
    if (!userId) {
      if (request.nextUrl.pathname.startsWith('/api/')) {
        return jsonError('Unauthorized', 401);
      }
      return redirectToLocalizedSignIn(request);
    }
      }
      return composeLocaleResponse(request);
    })
  : composeLocaleResponse;

export default proxy;

export const config = {
  matcher: [
    '/((?!api|trpc|_next|_vercel|.*\\..*).*)',
    '/(api|trpc)(.*)',
    '/__clerk/(.*)',
  ],
};

function getPathnameLocale(pathname: string): AppLocale | undefined {
  const segment = pathname.split('/')[1];
  return isLocale(segment) ? segment : undefined;
}
