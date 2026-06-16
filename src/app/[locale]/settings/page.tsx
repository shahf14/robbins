import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {SettingsPanel} from '@/components/settings-panel';
import {isLocale} from '@/i18n/config';

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
    title: t('settings.title')
  };
}

export default async function SettingsPage({params}: Props) {
  const {locale: rawLocale} = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  setRequestLocale(rawLocale);

  return (
    <main className="section-block border-t-0">
      <div className="page-shell">
        <SettingsPanel />
      </div>
    </main>
  );
}
