'use client';

import {useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import {AiActionHelpMicrocopy} from '@/components/feedback/ai-action-help-microcopy';
import {BusyButton} from '@/components/feedback/busy-button';

type EmptyAction = {
  label: string;
  onClick: () => void;
  loading?: boolean;
  loadingLabel?: string;
};

type Props = {
  hasGoals?: boolean;
  emptyAction?: EmptyAction;
  onSetupGoal?: () => void;
  goalSetupHref?: string;
  className?: string;
};

export function DailyStepsEmptyState({
  hasGoals = true,
  emptyAction,
  onSetupGoal,
  goalSetupHref = '/life-coach#domains',
  className = '',
}: Props) {
  const t = useTranslations();

  return (
    <div
      className={`flex flex-col gap-4 rounded-[20px] border border-dashed border-[var(--blue)]/30 bg-[linear-gradient(135deg,rgba(26,109,255,0.08),rgba(9,9,11,0.4))] p-6 sm:p-7 ${className}`.trim()}
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--blue)]">
        {t('lifeCoach.noDailyStepsEyebrow')}
      </p>
      <h3 className="text-lg font-black leading-snug text-white sm:text-xl">
        {t('lifeCoach.noDailyStepsTitle')}
      </h3>
      <p className="text-sm leading-7 text-[var(--muted)]">{t('lifeCoach.noDailyStepsGuide')}</p>
      <ol className="grid gap-2 text-sm leading-6 text-white/70">
        <li className="flex gap-2">
          <span className="font-black text-[var(--blue)]">1.</span>
          <span>{t('lifeCoach.noDailyStepsStepGoal')}</span>
        </li>
        <li className="flex gap-2">
          <span className="font-black text-[var(--blue)]">2.</span>
          <span>{t('lifeCoach.noDailyStepsStepGenerate')}</span>
        </li>
      </ol>

      {!hasGoals ? (
        onSetupGoal ? (
          <button type="button" className="focus-ring btn-primary self-start" onClick={onSetupGoal}>
            {t('lifeCoach.noGoalsForStepsCta')}
          </button>
        ) : (
          <Link href={goalSetupHref} className="focus-ring btn-primary self-start">
            {t('lifeCoach.noGoalsForStepsCta')}
          </Link>
        )
      ) : emptyAction ? (
        <div className="flex flex-col items-start gap-2">
          <BusyButton
            type="button"
            className="focus-ring btn-primary self-start"
            busy={emptyAction.loading}
            busyLabel={emptyAction.loadingLabel}
            onClick={emptyAction.onClick}
          >
            {emptyAction.label}
          </BusyButton>
          <AiActionHelpMicrocopy kind="dailySteps" />
        </div>
      ) : null}
    </div>
  );
}
