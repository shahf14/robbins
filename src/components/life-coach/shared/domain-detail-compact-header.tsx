'use client';

import {useTranslations} from 'next-intl';
import {Breadcrumb} from '@/components/breadcrumb';
import type {LifeDomain} from '@/lib/life-coach/types';

type Props = {
  domain: LifeDomain;
  streakDays: number;
  completedToday: number;
  totalToday: number;
};

export function DomainDetailCompactHeader({
  domain,
  streakDays,
  completedToday,
  totalToday,
}: Props) {
  const t = useTranslations();
  const domainLabel = t(`lifeCoach.domains.${domain}.label`);

  return (
    <header className="grid gap-3">
      <Breadcrumb
        crumbs={[
          {label: t('nav.lifeCoach'), href: '/life-coach'},
          {label: domainLabel},
        ]}
      />
      <div>
        <h1 className="text-[clamp(1.65rem,4.5vw,2.25rem)] font-black leading-tight txt-strong">
          {domainLabel}
        </h1>
        {totalToday > 0 && (
          <p className="mt-2 text-sm font-medium txt-muted">
            {t('lifeCoach.domainTabs.todaySummary', {
              completed: completedToday,
              total: totalToday,
              streak: streakDays,
            })}
          </p>
        )}
        {totalToday === 0 && streakDays > 0 && (
          <p className="mt-2 text-sm font-medium txt-muted">
            {t('lifeCoach.domainTabs.streakOnly', {streak: streakDays})}
          </p>
        )}
      </div>
    </header>
  );
}
