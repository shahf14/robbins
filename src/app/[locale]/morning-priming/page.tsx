import {getTranslations, setRequestLocale} from 'next-intl/server';
import {MorningRitual} from '@/components/morning-ritual';
import {isLocale, type AppLocale} from '@/i18n/config';

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props) {
  const {locale: rawLocale} = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : 'en';
  setRequestLocale(locale);
  const t = await getTranslations('morningRitual');

  return {
    title: t('pageTitle'),
  };
}

export default async function MorningPrimingPage({params}: Props) {
  const {locale: rawLocale} = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : 'en';
  setRequestLocale(locale);

  return (
    <main className="section-block border-t-0">
      <div className="page-shell">
        <MorningRitual />
      </div>
    </main>
  );
}
