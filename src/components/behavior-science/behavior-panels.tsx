'use client';

import {useTranslations} from 'next-intl';
import type {DailyBabyStep, Goal} from '@/lib/life-coach/types';
import type {BehaviorScore} from '@/lib/behavior-science/behavior-score';
import type {EndOfDayClosure} from '@/lib/behavior-science/end-of-day-closure';
import type {LifeContextMode} from '@/lib/behavior-science/life-context-mode';
import type {FrictionDiagnosis} from '@/lib/behavior-science/friction-audit';
import type {GoalSelfContract} from '@/lib/behavior-science/self-contract';
import {BusyButton} from '@/components/feedback/busy-button';

export function NeverMissTwiceBanner() {
  const t = useTranslations('behaviorScience.neverMissTwice');
  return (
    <div className="rounded-xl border border-sky-400/25 bg-sky-500/8 px-4 py-3">
      <p className="text-sm font-black text-sky-100">{t('rule')}</p>
      <p className="mt-1 text-xs leading-5 text-white/55">{t('recoveryHint')}</p>
    </div>
  );
}

export function EarlyWarningBanner({onTwoMinuteStep}: {onTwoMinuteStep?: () => void}) {
  const t = useTranslations('behaviorScience.earlyWarning');
  return (
    <div className="rounded-xl border border-amber-400/30 bg-amber-500/8 px-4 py-3">
      <p className="text-sm font-black text-amber-100">{t('title')}</p>
      <p className="mt-1 text-xs leading-5 text-white/55">{t('body')}</p>
      {onTwoMinuteStep && (
        <BusyButton type="button" className="focus-ring btn-small mt-3" onClick={onTwoMinuteStep}>
          {t('cta')}
        </BusyButton>
      )}
    </div>
  );
}

export function BehaviorScoreChip({score}: {score: BehaviorScore}) {
  const t = useTranslations('behaviorScience.behaviorScore');
  return (
    <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3" aria-label={`${t('label')}: ${score.percent}%`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-white/35" aria-hidden="true">{t('label')}</p>
      <p className="mt-1 text-lg font-black text-white">
        {score.showUps}/{score.opportunities}
        <span className="ms-2 text-sm font-semibold text-[var(--blue)]">{score.percent}%</span>
      </p>
      <p className="mt-1 text-xs text-white/45">{t('hint')}</p>
    </div>
  );
}

export function EndOfDayClosureCard({closure}: {closure: EndOfDayClosure}) {
  const t = useTranslations('behaviorScience.closure');
  return (
    <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-4" aria-label={t('title')}>
      <p className="text-xs font-bold uppercase tracking-wide text-white/40">{t('title')}</p>
      {closure.closedTitles.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-emerald-300/80">{t('closed')}</p>
          <ul className="mt-1 list-inside list-disc text-sm text-white/65">
            {closure.closedTitles.slice(0, 4).map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </div>
      )}
      {closure.openTitles.length > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-amber-200/80">{t('open')}</p>
          <ul className="mt-1 list-inside list-disc text-sm text-white/55">
            {closure.openTitles.slice(0, 3).map((title) => (
              <li key={title}>{title}</li>
            ))}
          </ul>
        </div>
      )}
      {closure.firstTomorrowTitle && (
        <p className="mt-3 text-sm text-[var(--blue)]/85">
          {t('firstTomorrow', {step: closure.firstTomorrowTitle})}
        </p>
      )}
    </div>
  );
}

export function LifeContextModeBanner({mode}: {mode: LifeContextMode}) {
  const t = useTranslations('behaviorScience.lifeContextMode');
  if (!mode.active) return null;
  return (
    <div className="rounded-xl bg-[var(--blue)]/8 px-4 py-3">
      <p className="text-sm font-semibold text-white/90">{t('title')}</p>
      <p className="mt-1 text-sm leading-6 text-white/62">{t('body')}</p>
    </div>
  );
}

export function FrictionAuditBanner({
  diagnosis,
  onShrink,
  shrinking,
}: {
  diagnosis: FrictionDiagnosis;
  onShrink: () => void;
  shrinking?: boolean;
}) {
  const t = useTranslations('behaviorScience.frictionAudit');
  return (
    <div className="mb-3 rounded-xl border border-amber-400/25 bg-amber-500/6 px-4 py-3">
      <p className="text-xs font-semibold text-amber-100/90">{t(`diagnosis.${diagnosis}`)}</p>
      <BusyButton
        type="button"
        className="focus-ring btn-small mt-2"
        busy={shrinking}
        onClick={onShrink}
      >
        {t('shrinkBtn')}
      </BusyButton>
    </div>
  );
}

export function SelfContractReminder({
  contract,
  goalTitle,
}: {
  contract: GoalSelfContract;
  goalTitle?: string;
}) {
  const t = useTranslations('behaviorScience.selfContract');
  return (
    <p className="text-xs leading-5 text-white/50">
      {t('reminder', {days: contract.commitmentDays, goal: goalTitle ?? t('defaultGoal')})}
    </p>
  );
}

export function CommitmentLadderCard({
  stageKey,
  progress,
  target,
}: {
  stageKey: string;
  progress: number;
  target: number;
}) {
  const t = useTranslations('behaviorScience');
  return (
    <div className="rounded-xl border border-white/10 bg-white/3 px-4 py-3" aria-label={t('commitmentLadder.title')}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-white/35">
        {t('commitmentLadder.title')}
      </p>
      <p className="mt-1 text-sm font-semibold text-white">{t(stageKey)}</p>
      <p className="mt-1 text-xs text-white/45">
        {t('commitmentLadder.progress', {done: progress, target})}
      </p>
    </div>
  );
}

export function SocialAccountabilityActions({
  onShare,
  busy,
}: {
  onShare: () => void;
  busy?: boolean;
}) {
  const t = useTranslations('behaviorScience.social');
  return (
    <div className="flex flex-wrap gap-2">
      <BusyButton type="button" className="focus-ring btn-ghost text-xs" busy={busy} onClick={onShare}>
        {t('shareWeekly')}
      </BusyButton>
    </div>
  );
}

export function RecoveryQuestCard({step}: {step: DailyBabyStep}) {
  const t = useTranslations('behaviorScience.neverMissTwice');
  return (
    <div className="rounded-xl border border-emerald-400/30 bg-emerald-500/8 px-4 py-3" aria-label={`${t('recoveryQuest')}: ${step.title}`}>
      <p className="text-[10px] font-bold uppercase tracking-wide text-emerald-300/80">
        {t('recoveryQuest')}
      </p>
      <p className="mt-1 text-sm font-black text-white">{step.title}</p>
      <p className="mt-1 text-xs text-white/50">
        {step.estimated_minutes} {t('minutes')}
      </p>
    </div>
  );
}
