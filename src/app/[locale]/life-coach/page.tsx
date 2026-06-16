import {setRequestLocale} from 'next-intl/server';
import {LifeCoachHome} from '@/components/life-coach/life-coach-home';
import {isLocale, type AppLocale} from '@/i18n/config';

type Props = {
  params: Promise<{locale: string}>;
};

export default async function LifeCoachPage({params}: Props) {
  const {locale: rawLocale} = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : 'en';

  setRequestLocale(locale);

  return <LifeCoachHome />;
}
