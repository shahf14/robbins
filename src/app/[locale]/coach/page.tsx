import {getTranslations, setRequestLocale} from 'next-intl/server';
import {VirtualCoachPanel} from '@/components/coach/virtual-coach-panel';
import {isLocale, type AppLocale} from '@/i18n/config';

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props) {
  const {locale: rawLocale} = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : 'en';
  setRequestLocale(locale);
  const t = await getTranslations('coach');

  return {
    title: t('page.title'),
  };
}

export default async function VirtualCoachPage({params}: Props) {
  const {locale: rawLocale} = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : 'en';
  setRequestLocale(locale);

  return (
    <main className="section-block border-t-0">
      <div className="page-shell py-8 sm:py-10">
        <VirtualCoachPanel />
      </div>
    </main>
  );
}
