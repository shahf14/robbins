import {setRequestLocale} from 'next-intl/server';
import {FirstVisitWelcome} from '@/components/first-visit-welcome';
import {HomeDashboard} from '@/components/home/home-dashboard';
import {isLocale, type AppLocale} from '@/i18n/config';

type Props = {
  params: Promise<{locale: string}>;
};

export default async function DashboardPage({params}: Props) {
  const {locale: rawLocale} = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : 'en';
  setRequestLocale(locale);

  return (
    <main className="pb-16">
      <FirstVisitWelcome />
      <HomeDashboard />
    </main>
  );
}
