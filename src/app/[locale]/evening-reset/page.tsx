import {getTranslations, setRequestLocale} from 'next-intl/server';
import {EveningReset} from '@/components/evening-reset';
import {isLocale, type AppLocale} from '@/i18n/config';

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props) {
  const {locale: rawLocale} = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : 'en';
  setRequestLocale(locale);
  const t = await getTranslations('eveningReset');

  return {
    title: t('pageTitle'),
  };
}

export default async function EveningResetPage({params}: Props) {
  const {locale: rawLocale} = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : 'en';
  setRequestLocale(locale);

  return (
    <main className="section-block border-t-0">
      <div className="page-shell">
        <EveningReset />
      </div>
    </main>
  );
}
