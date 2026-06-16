'use client';

import {useTranslations} from 'next-intl';
import type {DailyRollUp} from '@/lib/gamification/daily-roll-up';
import {DOMAIN_ICONS} from '@/lib/life-coach/domain-icons';

export function DailyRollUpCard({rollUp}: {rollUp: DailyRollUp}) {
  const t = useTranslations('gamification.dailyRollUp');
  const tRoot = useTranslations();

  return (
    <div className="mb-3 animate-fade-in rounded-[20px] border border-emerald-400/30 bg-gradient-to-br from-emerald-500/12 to-[var(--blue)]/8 px-5 py-4" aria-label={t('eyebrow')}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-300/90">
        {t('eyebrow')}
      </p>
      <p className="mt-2 text-lg font-black text-white">
        {t('summary', {count: rollUp.completedCount, minutes: rollUp.totalMinutes})}
      </p>
      {rollUp.topDomain && (
        <p className="mt-2 text-sm text-white/65">
          {DOMAIN_ICONS[rollUp.topDomain]}{' '}
          {t('topDomain', {
            domain: tRoot(`lifeCoach.domains.${rollUp.topDomain}.short`),
            count: rollUp.topDomainCount,
          })}
        </p>
      )}
      {rollUp.identityTitle && (
        <p className="mt-2 text-xs font-bold text-amber-200/90">
          {t('titleUnlocked', {title: tRoot(`gamification.identityTitles.${rollUp.identityTitle}`)})}
        </p>
      )}
      {rollUp.comebackChain >= 2 && (
        <p className="mt-1 text-xs font-semibold text-sky-200/80">
          {t('comebackChain', {count: rollUp.comebackChain})}
        </p>
      )}
    </div>
  );
}
