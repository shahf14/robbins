'use client';

import {useTranslations} from 'next-intl';
import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';
import {buildImplementationIntention} from '@/lib/behavior-science/implementation-intentions';
import {planBPreviewLine} from '@/lib/life-coach/plan-b';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import {useLocale} from 'next-intl';
import type {AppLocale} from '@/i18n/config';

type Props = {
  step: DailyBabyStepResponse;
  stepIndex: number;
  stepCount: number;
  wakeTime: string;
  sleepTime: string;
  preferredActionWindow: PreferredActionWindow;
};

export function StepBehaviorHints({
  step,
  stepIndex,
  stepCount,
  wakeTime,
  sleepTime,
  preferredActionWindow,
}: Props) {
  const t = useTranslations('behaviorScience');
  const locale = useLocale() as AppLocale;

  if (step.status !== 'pending') return null;
  const planBLine = planBPreviewLine(step, locale);

  const intention = buildImplementationIntention(
    step,
    {wake_time: wakeTime, sleep_time: sleepTime, preferred_action_window: preferredActionWindow},
    stepIndex,
    stepCount
  );

  const afterLabel =
    intention.anchorKey === 'afterTime' && intention.anchorValue
      ? t('implementation.afterTime', {time: intention.anchorValue})
      : intention.anchorKey === 'morningRoutine' && intention.anchorValue
        ? t('implementation.afterWake', {time: intention.anchorValue})
        : t(`implementation.${intention.anchorKey}`);

  return (
    <div className="mt-3 space-y-2 rounded-xl border border-[color:var(--color-border)] fill-1 px-4 py-3">
      <p className="text-xs leading-6 text-[var(--blue)]/90">
        {t('implementation.sentence', {
          after: afterLabel,
          action: intention.action,
          minutes: intention.minutes,
        })}
      </p>
      <p className="text-xs leading-5 txt-muted">
        {t('planB.lineWithAction', {action: planBLine, minutes: step.fallback_estimated_minutes ?? 2})}
      </p>
    </div>
  );
}
