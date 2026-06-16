'use client';

import type {ReactNode} from 'react';
import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {DomainRivalrySnapshot} from '@/lib/gamification/domain-rivalry';
import type {IdentityTitle} from '@/lib/gamification/identity-titles';
import type {MysteryUnlock} from '@/lib/gamification/mystery-unlocks';
import type {StreakHealth} from '@/lib/gamification/streak-health';
import {DOMAIN_ICONS} from '@/lib/life-coach/domain-icons';

const HEALTH_STYLES: Record<StreakHealth, string> = {
  fresh: 'text-sky-300',
  stable: 'text-emerald-300',
  atRisk: 'text-amber-300',
  protected: 'text-violet-300',
};

type Props = {
  streakHealth: StreakHealth;
  streak: number;
  comebackChain: number;
  identityTitle: IdentityTitle | null;
  domainRivalry: DomainRivalrySnapshot | null;
  mysteryUnlock: MysteryUnlock | null;
};

export function HomeGamificationStrip({
  streakHealth,
  streak,
  comebackChain,
  identityTitle,
  domainRivalry,
  mysteryUnlock,
}: Props) {
  const t = useTranslations('gamification');

  const chips: {key: string; node: ReactNode}[] = [];

  chips.push({
    key: 'streak',
    node: (
      <span className={`text-xs font-bold ${HEALTH_STYLES[streakHealth]}`}>
        {t(`streakHealth.${streakHealth}`)} · {t('streakDays', {count: streak})}
      </span>
    ),
  });

  if (identityTitle) {
    chips.push({
      key: 'title',
      node: (
        <span className="text-xs font-black text-amber-200/90">
          {t(`identityTitles.${identityTitle}`)}
        </span>
      ),
    });
  }

  if (comebackChain >= 2) {
    chips.push({
      key: 'comeback',
      node: (
        <span className="text-xs font-bold text-sky-200/85">
          {t('comebackChain', {count: comebackChain})}
        </span>
      ),
    });
  }

  if (domainRivalry) {
    chips.push({
      key: 'rivalry',
      node: (
        <span className="text-xs leading-5 text-white/55">
          <span aria-hidden="true">{DOMAIN_ICONS[domainRivalry.leader]}</span>{' '}
          {t('domainRivalry.leads', {
            domain: t(`lifeCoach.domains.${domainRivalry.leader}.short`),
          })}
          {domainRivalry.gap <= 1 && (
            <>
              {' · '}
              {t('domainRivalry.catchUp', {
                domain: t(`lifeCoach.domains.${domainRivalry.challenger}.short`),
                gap: domainRivalry.gap === 0 ? 1 : domainRivalry.gap,
              })}
            </>
          )}
        </span>
      ),
    });
  }

  if (mysteryUnlock) {
    chips.push({
      key: 'mystery',
      node: (
        <span className="text-xs font-semibold text-violet-200/80">
          {t(`mysteryUnlock.${mysteryUnlock.rewardKey}`, {remaining: mysteryUnlock.remaining})}
        </span>
      ),
    });
  }

  if (chips.length === 0) return null;

  return (
    <div className="flex flex-col gap-2 rounded-[18px] border border-white/8 bg-white/3 px-4 py-3">
      {chips.map(({key, node}) => (
        <div key={key}>{node}</div>
      ))}
      <Link href="/progress" className="focus-ring text-xs font-semibold text-white/45 underline">
        {t('progress.viewLink')}
      </Link>
    </div>
  );
}
