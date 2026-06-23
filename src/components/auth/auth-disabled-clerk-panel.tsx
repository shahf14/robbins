'use client';

import Link from 'next/link';
import {useRouter} from 'next/navigation';
import {useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {ApiAccessPanel} from '@/components/feedback/api-access-panel';

type Props = {
  locale: AppLocale;
  variant: 'sign-in' | 'sign-up';
};

export function AuthDisabledClerkPanel({locale, variant}: Props) {
  const t = useTranslations('auth.clerkDisabled');
  const router = useRouter();
  const title = variant === 'sign-in' ? t('signInTitle') : t('signUpTitle');
  const body = variant === 'sign-in' ? t('signInBody') : t('signUpBody');

  return (
    <div className="w-full max-w-xl space-y-6">
      <section className="panel-surface-strong p-6 sm:p-8">
        <h1 className="text-xl font-bold">{title}</h1>
        <p className="mt-2 text-sm leading-7 txt-muted">{body}</p>
        <div className="mt-5 flex flex-wrap gap-3">
          <Link href={`/${locale}/settings`} className="btn-primary px-4 py-2 text-sm font-semibold">
            {t('settingsCta')}
          </Link>
          <Link href={`/${locale}`} className="btn-secondary px-4 py-2 text-sm font-semibold">
            {t('homeCta')}
          </Link>
        </div>
      </section>
      <ApiAccessPanel failure="auth" onRetry={() => router.push(`/${locale}`)} />
    </div>
  );
}
