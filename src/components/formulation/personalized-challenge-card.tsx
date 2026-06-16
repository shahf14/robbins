'use client';

import {useTranslations} from 'next-intl';
import type {PersonalizedChallenge} from '@/lib/formulation/personalized-challenge';

type Props = {
  challenge: PersonalizedChallenge;
  variant?: 'complete' | 'handoff' | 'home';
};

export function PersonalizedChallengeCard({challenge, variant = 'complete'}: Props) {
  const t = useTranslations('formulation.challenge');

  const borderClass =
    variant === 'home'
      ? 'border-[var(--blue)]/25 bg-[var(--blue)]/6'
      : 'border-emerald-500/20 bg-emerald-500/6';

  return (
    <div className={`rounded-[20px] border p-5 ${borderClass}`} role="region" aria-labelledby="personalized-challenge-title">
      <p id="personalized-challenge-title" className="field-label mb-0 text-[var(--blue)]">{t('title')}</p>
      <p className="mt-2 text-base font-bold leading-7 text-white">{challenge.title}</p>
      <p className="mt-1 text-xs font-semibold uppercase tracking-wide text-white/40">
        {t(`types.${challenge.challenge_type}`)} · {challenge.weekly_target_label}
      </p>

      <dl className="mt-4 grid gap-3 text-sm">
        <div>
          <dt className="text-white/45">{t('dailyMinimum')}</dt>
          <dd className="text-white/85">{challenge.daily_minimum}</dd>
        </div>
        <div>
          <dt className="text-white/45">{t('fallbackPlan')}</dt>
          <dd className="text-white/85">{challenge.fallback_plan}</dd>
        </div>
        <div>
          <dt className="text-white/45">{t('successDefinition')}</dt>
          <dd className="text-white/85">{challenge.success_definition}</dd>
        </div>
      </dl>
    </div>
  );
}
