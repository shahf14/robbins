import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {isLocale} from '@/i18n/config';
import {ProgressPanel} from '@/components/gamification/progress-panel';

type Props = {
  params: Promise<{locale: string}>;
};

export async function generateMetadata({params}: Props) {
  const {locale: rawLocale} = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  setRequestLocale(rawLocale);
  const t = await getTranslations();

  return {
    title: t('gamification.progress.title'),
  };
}

export default async function ProgressPage({params}: Props) {
  const {locale: rawLocale} = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  setRequestLocale(rawLocale);

  return (
    <main className="section-block border-t-0">
      <div className="page-shell">
        <ProgressPanel />
      </div>
    </main>
  );
}
