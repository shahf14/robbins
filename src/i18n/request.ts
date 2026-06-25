import {getRequestConfig} from 'next-intl/server';
import {hasLocale} from 'next-intl';
import {resolveGenderedMessages} from '@/lib/gendered-copy';
import {defaultLocale, routing} from './config';

export default getRequestConfig(async ({requestLocale}) => {
  const requested = await requestLocale;
  const locale = hasLocale(routing.locales, requested) ? requested : defaultLocale;
  const rawMessages = (await import(`../../messages/${locale}.json`)).default;

  return {
    locale,
    messages:
      locale === 'he' ? resolveGenderedMessages(rawMessages, 'male') : rawMessages,
  };
});
