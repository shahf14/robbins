import {Heebo, Inter} from 'next/font/google';
import {headers} from 'next/headers';
import type {CSSProperties, ReactNode} from 'react';
import {defaultLocale, isLocale, localeDirections, type AppLocale} from '@/i18n/config';
import {themeBootstrapScript} from '@/lib/theme';
import './globals.css';
import {ErrorLogBootstrap} from '@/components/error-log-bootstrap';

type Props = {
  children: ReactNode;
};

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-inter'
});

const heebo = Heebo({
  subsets: ['hebrew', 'latin'],
  variable: '--font-heebo'
});

export default async function RootLayout({children}: Props) {
  const requestHeaders = await headers();
  const rawLocale =
    requestHeaders.get('x-robbins-locale') ?? requestHeaders.get('x-next-intl-locale') ?? defaultLocale;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const dir = localeDirections[locale];
  const fontStack =
    locale === 'he'
      ? 'var(--font-heebo), var(--font-inter), Arial, sans-serif'
      : 'var(--font-inter), var(--font-heebo), Arial, sans-serif';

  return (
    <html lang={locale} dir={dir} className={`${inter.variable} ${heebo.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: themeBootstrapScript}} />
      </head>
      <body
        style={
          {
            '--font-body': fontStack,
            '--font-display': fontStack
          } as CSSProperties
        }
      >
        <ErrorLogBootstrap />
        {children}
      </body>
    </html>
  );
}
