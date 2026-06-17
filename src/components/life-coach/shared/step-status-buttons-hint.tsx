'use client';

import {useTranslations} from 'next-intl';

type Props = {
  className?: string;
};

export function StepStatusButtonsHint({className = ''}: Props) {
  const t = useTranslations();

  return (
    <p className={`text-xs leading-5 txt-muted ${className}`.trim()}>
      {t('lifeCoach.stepStatusCoachHint')}
    </p>
  );
}
