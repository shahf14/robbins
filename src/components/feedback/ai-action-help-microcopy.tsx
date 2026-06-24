'use client';

import {useTranslations} from 'next-intl';

type AiActionHelpKind =
  | 'dailySteps'
  | 'goalStructure'
  | 'insight'
  | 'weeklyReview'
  | 'formulationQuestions'
  | 'lifeContextRegenerate'
  | 'skipRecovery';

type Props = {
  kind: AiActionHelpKind;
  className?: string;
};

export function AiActionHelpMicrocopy({kind, className = ''}: Props) {
  const t = useTranslations();

  return (
    <p
      className={`max-w-md text-xs leading-5 txt-muted ${className}`.trim()}
      role="note"
    >
      <span className="block font-semibold txt-soft">{t('aiActionHelp.question')}</span>
      <span className="mt-0.5 block">{t(`aiActionHelp.${kind}`)}</span>
    </p>
  );
}
