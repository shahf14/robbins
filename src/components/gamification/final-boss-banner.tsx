'use client';

import {useTranslations} from 'next-intl';
import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';

export function FinalBossBanner({step}: {step: DailyBabyStepResponse}) {
  const t = useTranslations('gamification.finalBoss');

  return (
    <div className="mb-4 rounded-[18px] border border-amber-400/35 bg-gradient-to-r from-amber-500/14 to-rose-500/8 px-4 py-4" role="region" aria-label={t('eyebrow')}>
      <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-amber-300/90" aria-hidden="true">
        {t('eyebrow')}
      </p>
      <p className="mt-1 text-base font-black txt-strong">
        {t('title', {minutes: step.estimated_minutes})}
      </p>
      <p className="mt-1 text-xs leading-5 txt-soft">{step.title}</p>
    </div>
  );
}
