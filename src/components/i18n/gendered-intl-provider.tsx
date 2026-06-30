'use client';

import {NextIntlClientProvider} from 'next-intl';
import {useEffect, useMemo, useState, type ReactNode} from 'react';
import type {AppLocale} from '@/i18n/config';
import {resolveGenderedMessages, resolveParticipantGender} from '@/lib/gendered-copy';
import {loadUserPreferences, subscribeUserPreferences} from '@/lib/user-preferences';

type Props = {
  locale: AppLocale;
  messages: Record<string, unknown>;
  children: ReactNode;
};

export function GenderedIntlProvider({locale, messages, children}: Props) {
  const [gender, setGender] = useState(() =>
    resolveParticipantGender(loadUserPreferences().gender)
  );

  useEffect(() => {
    const syncGender = () => {
      setGender(resolveParticipantGender(loadUserPreferences().gender));
    };

    syncGender();
    return subscribeUserPreferences(syncGender);
  }, []);

  const resolvedMessages = useMemo(() => {
    if (locale !== 'he') return messages;
    return resolveGenderedMessages(messages, gender);
  }, [locale, messages, gender]);

  return (
    <NextIntlClientProvider locale={locale} messages={resolvedMessages}>
      {children}
    </NextIntlClientProvider>
  );
}
