import {ClerkProvider} from '@clerk/nextjs';
import {headers} from 'next/headers';
import type {CSSProperties, ReactNode} from 'react';
import {isClerkConfigured} from '@/lib/auth/clerk-config';
import {defaultLocale, isLocale, localeDirections, type AppLocale} from '@/i18n/config';
import {themeBootstrapScript} from '@/lib/theme';
import './globals.css';
import {ErrorLogBootstrap} from '@/components/error-log-bootstrap';

type Props = {
  children: ReactNode;
};

const FONT_STACK_HE =
  "'Heebo Variable', 'Inter Variable', system-ui, -apple-system, Segoe UI, Arial, sans-serif";
const FONT_STACK_EN =
  "'Inter Variable', 'Heebo Variable', system-ui, -apple-system, Segoe UI, Arial, sans-serif";

export default async function RootLayout({children}: Props) {
  const requestHeaders = await headers();
  const rawLocale =
    requestHeaders.get('x-robbins-locale') ?? requestHeaders.get('x-next-intl-locale') ?? defaultLocale;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : defaultLocale;
  const dir = localeDirections[locale];
  const clerkEnabled = isClerkConfigured();
  const fontStack = locale === 'he' ? FONT_STACK_HE : FONT_STACK_EN;

  return (
    <html lang={locale} dir={dir} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{__html: themeBootstrapScript}} />
      </head>
      <body
        style={
          {
            '--font-body': fontStack,
            '--font-display': fontStack,
          } as CSSProperties
        }
      >
        {clerkEnabled ? (
          <ClerkProvider>
            <ErrorLogBootstrap />
            {children}
          </ClerkProvider>
        ) : (
          <>
            <ErrorLogBootstrap />
            {children}
          </>
        )}
      </body>
    </html>
  );
}
