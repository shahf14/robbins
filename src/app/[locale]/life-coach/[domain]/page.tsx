import {notFound} from 'next/navigation';
import {setRequestLocale} from 'next-intl/server';
import {DomainDetailPage} from '@/components/life-coach/domain-detail-page';
import {HealthDomainDetailPage} from '@/components/life-coach/health/health-domain-detail';
import {isLocale, type AppLocale} from '@/i18n/config';
import {LIFE_DOMAINS, type LifeDomain} from '@/lib/life-coach/types';

type Props = {
  params: Promise<{locale: string; domain: string}>;
};

export default async function LifeCoachDomainPage({params}: Props) {
  const {locale: rawLocale, domain: rawDomain} = await params;
  const locale: AppLocale = isLocale(rawLocale) ? rawLocale : 'en';
  const domain = LIFE_DOMAINS.find((item) => item === rawDomain) as LifeDomain | undefined;

  if (!domain) {
    notFound();
  }

  setRequestLocale(locale);

  // Health domain gets an enhanced experience with wizard, pulse, dashboard, and deep-dive
  if (domain === 'health') {
    return <HealthDomainDetailPage />;
  }

  return <DomainDetailPage domain={domain} />;
}
