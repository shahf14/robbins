import {setRequestLocale} from 'next-intl/server';
import {isLocale, type AppLocale} from '@/i18n/config';
import {OnboardingWizard} from '@/components/onboarding/onboarding-wizard';

type Props = {params: Promise<{locale: string}>};

export default async function OnboardingPage({params}: Props) {
  const {locale: raw} = await params;
  const locale: AppLocale = isLocale(raw) ? raw : 'en';
  setRequestLocale(locale);

  return <OnboardingWizard />;
}
