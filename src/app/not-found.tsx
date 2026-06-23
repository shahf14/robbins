import Link from 'next/link';
import {cookies, headers} from 'next/headers';
import {defaultLocale, isLocale, locales, type AppLocale} from '@/i18n/config';

export default async function GlobalNotFound() {
  const homeLocale = await resolveHomeLocale();

  return (
    <main className="page-shell grid min-h-[70vh] place-items-center py-10">
      <section className="panel-surface max-w-xl p-6 sm:p-8">
        <p className="eyebrow">404</p>
        <h1 className="mt-2 text-3xl font-black">Page not found</h1>
        <p className="mt-3 leading-8 text-[var(--muted)]">This route does not exist yet.</p>
        <Link href={`/${homeLocale}`} className="focus-ring btn-primary mt-5 inline-flex">
          Go home
        </Link>
      </section>
    </main>
  );
}

async function resolveHomeLocale(): Promise<AppLocale> {
  const cookieLocale = (await cookies()).get('NEXT_LOCALE')?.value;
  if (cookieLocale && isLocale(cookieLocale)) {
    return cookieLocale;
  }

  const acceptLanguage = (await headers()).get('accept-language') ?? '';
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
