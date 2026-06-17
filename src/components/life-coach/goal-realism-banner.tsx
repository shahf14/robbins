'use client';

import {useTranslations} from 'next-intl';
import type {GoalRealismCheck} from '@/lib/life-coach/types';

type Props = {
  realismCheck: GoalRealismCheck | null | undefined;
};

export function GoalRealismBanner({realismCheck}: Props) {
  const t = useTranslations('lifeCoach');

  if (!realismCheck?.adjusted && realismCheck?.risk_level !== 'high') {
    return null;
  }

  return (
    <div className="rounded-[18px] border border-amber-400/25 bg-amber-400/8 p-4 space-y-2">
      <p className="text-sm font-semibold text-amber-200">
        {t('realismAdjustedTitle')}
      </p>
      {realismCheck.first_week_adjustment ? (
        <p className="text-sm leading-6 txt-soft">{realismCheck.first_week_adjustment}</p>
      ) : null}
      <p className="text-xs leading-5 txt-muted">{realismCheck.risk_reason}</p>
    </div>
  );
}
