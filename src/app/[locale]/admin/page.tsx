import {getTranslations, setRequestLocale} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {AdminPanel} from '@/components/admin-panel';
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
    title: t('admin.pageTitle'),
  };
}

export default async function AdminPage({params}: Props) {
  const {locale: rawLocale} = await params;

  if (!isLocale(rawLocale)) {
    notFound();
  }

  setRequestLocale(rawLocale);

  return (
    <main className="section-block border-t-0">
      <div className="page-shell">
        <AdminPanel />
      </div>
    </main>
  );
}
