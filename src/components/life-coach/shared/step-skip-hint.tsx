'use client';

import {useTranslations} from 'next-intl';

type Props = {
  className?: string;
};

export function StepSkipHint({className = ''}: Props) {
  const t = useTranslations();

  return (
    <p className={`max-w-[14rem] text-[11px] leading-4 text-white/42 ${className}`.trim()}>
      {t('lifeCoach.stepSkipCoachHint')}
    </p>
  );
}
