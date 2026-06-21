'use client';

import {NavArrow} from '@/components/directional-arrow';
import {useTranslations} from 'next-intl';
import type {LifeDomain} from '@/lib/life-coach/types';
import {AiActionHelpMicrocopy} from '@/components/feedback/ai-action-help-microcopy';
import {DOMAIN_ICONS} from '@/lib/onboarding-domain-icons';
import {
  GOAL_TITLE_MAX,
  type WizardState,
} from '@/lib/onboarding-wizard-state';

export function Step4GoalProposal({
  s, set, onBack, onNext,
}: {
  s: WizardState;
  set: (p: Partial<WizardState>) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const t    = useTranslations();
  const busy = s.saving || s.stepLoading;

  const titleLen = s.editedTitle.length;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="eyebrow text-[var(--blue)]">{t('onboarding.step4Eyebrow')}</p>
        <h1 className="mt-3 text-[clamp(1.8rem,5vw,3rem)] font-black leading-tight txt-strong">
          {t('onboarding.step4Title')}
        </h1>
        <p className="mt-3 text-base leading-7 text-[var(--muted)]">
          {t('onboarding.step4Body')}
        </p>
      </div>

      {s.proposedGoal && (
        <div className="rounded-[20px] border border-[var(--blue)]/30 bg-[var(--blue)]/6 p-6">
          <p className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]">
            {t('onboarding.goalProposedLabel')}
          </p>
          <p className="mt-3 text-sm leading-6 txt-soft">{s.proposedGoal.description}</p>

          <textarea
            className="focus-ring mt-3 w-full resize-none rounded-2xl border border-[color:var(--color-border-strong)] fill-1 p-4 text-xl font-black leading-snug txt-strong placeholder:txt-faint outline-none"
            value={s.editedTitle}
            aria-label={t('onboarding.goalProposedLabel')}
            onChange={(e) => set({editedTitle: e.target.value})}
            rows={3}
            maxLength={GOAL_TITLE_MAX}
          />
          <div className="mt-1 flex items-center justify-between">
            <p className="text-xs txt-faint">{t('onboarding.goalEditHint')}</p>
            <span className={`text-xs tabular-nums ${titleLen > GOAL_TITLE_MAX - 15 ? 'text-amber-400' : 'txt-faint'}`}>
              {titleLen}/{GOAL_TITLE_MAX}
            </span>
          </div>

          <div className="mt-5 grid gap-2">
            <span className="text-xs font-bold uppercase tracking-widest txt-muted">
              {t('onboarding.goalMetricLabel')}
            </span>
            <textarea
              className="focus-ring w-full resize-none rounded-xl border border-[color:var(--color-border)] fill-1 p-3 text-sm leading-6 txt-strong placeholder:txt-faint outline-none"
              value={s.editedSuccessMetric}
              aria-label={t('onboarding.goalMetricLabel')}
              onChange={(e) => set({editedSuccessMetric: e.target.value})}
              rows={2}
              maxLength={200}
              placeholder={s.proposedGoal.success_metric}
            />
          </div>
        </div>
      )}

      {s.error && (
        <div role="alert" className="rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">
          {s.error}
        </div>
      )}

      <div className="flex gap-3">
        <button type="button" className="focus-ring btn-ghost" onClick={onBack} disabled={busy} aria-busy={busy}>
          {t('onboarding.back')}
        </button>
        <button
          type="button"
          className="focus-ring btn-primary flex-1 justify-center disabled:opacity-50"
          disabled={!s.editedTitle.trim() || busy}
          aria-busy={busy}
          onClick={onNext}
        >
          {busy ? (
            <span className="flex items-center justify-center gap-2">
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden="true" />
              {t('onboarding.savingGoal')}
            </span>
          ) : (
            <>
              {t('onboarding.confirmGoal')} <NavArrow />
            </>
          )}
        </button>
      </div>
      <AiActionHelpMicrocopy kind="onboardingFirstStep" className="mt-3" />
    </div>
  );
}

export function Step5FirstWin({
  s, onDone, onSkip,
}: {
  s: WizardState;
  onDone: () => void;
  onSkip: () => void;
}) {
  const t    = useTranslations();
  const busy = s.saving;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <p className="eyebrow text-[var(--blue)]">{t('onboarding.step5Eyebrow')}</p>
        <h1 className="mt-3 text-[clamp(1.8rem,5vw,3rem)] font-black leading-tight txt-strong">
          {t('onboarding.step5Title', {name: s.name.trim() || t('dashboard.personalFallbackName')})}
        </h1>
        <p className="mt-3 text-base leading-7 text-[var(--muted)]">
          {t('onboarding.step5Body')}
        </p>
      </div>

      {s.firstStep && (
        <div className="rounded-[24px] border border-white/12 bg-[linear-gradient(135deg,rgba(26,109,255,0.1),rgba(9,9,11,0.7))] p-6 sm:p-8">
          <p className="text-xs font-bold uppercase tracking-widest text-white/40">
            {t('onboarding.firstTaskLabel')}
          </p>
          <p className="mt-4 text-2xl font-black leading-snug text-white">
            {s.firstStep.title}
          </p>
          {s.firstStep.description && (
            <p className="mt-3 text-sm leading-6 text-white/55">{s.firstStep.description}</p>
          )}
          <div className="mt-4 flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/12 bg-white/5 px-3 py-1 text-xs font-semibold text-white/50">
              ⏱ ~{s.firstStep.estimated_minutes} min
            </span>
            {s.selectedDomain && (
              <span className="text-xs font-semibold text-white/35">
                {DOMAIN_ICONS[s.selectedDomain]}{' '}
                {t(`lifeCoach.domains.${s.selectedDomain}.label`)}
              </span>
            )}
          </div>
        </div>
      )}

      <div className="rounded-[20px] border border-emerald-400/20 bg-emerald-500/6 p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
          {t('onboarding.tomorrowReasonMini.eyebrow')}
        </p>
        <p className="mt-2 text-sm font-semibold leading-6 txt-soft">
          {t('onboarding.tomorrowReasonMini.body')}
        </p>
      </div>

      <button
        type="button"
        className="focus-ring btn-primary w-full justify-center text-lg disabled:opacity-50"
        onClick={onDone}
        disabled={busy}
        aria-busy={busy}
      >
        {busy ? (
          <span className="flex items-center justify-center gap-2">
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" aria-hidden="true" />
            {t('onboarding.saving')}
          </span>
        ) : t('onboarding.firstTaskDone')}
      </button>

      <button
        type="button"
        className="focus-ring w-full rounded-2xl border border-[color:var(--color-border)] py-3 text-sm font-semibold txt-muted transition hover:border-[color:var(--color-border-strong)] hover:txt-soft disabled:opacity-30"
        onClick={onSkip}
        disabled={busy}
        aria-busy={busy}
      >
        {t('onboarding.firstTaskTomorrow')}
      </button>
    </div>
  );
}

export function Step6Celebration({
  s, domain, firstStepCompleted, onEnter,
}: {
  s: WizardState;
  domain: LifeDomain;
  firstStepCompleted: boolean;
  onEnter: () => void;
}) {
  const t = useTranslations();
  const name = s.name.trim() || t('dashboard.personalFallbackName');
  const domainLabel = t(`lifeCoach.domains.${domain}.label`);
  const dailyLoopSteps = ['checkin', 'steps', 'learn'] as const;

  return (
    <div className="flex flex-1 flex-col gap-8">
      <div className="text-center">
        <div className="text-6xl" aria-hidden="true">🎉</div>
        <h1 className="mt-4 text-[clamp(2rem,6vw,3.5rem)] font-black leading-tight txt-strong">
          {t('onboarding.celebrateTitle')}
        </h1>
        <p className="mt-4 text-lg leading-8 text-[var(--muted)]">
          {firstStepCompleted
            ? t('onboarding.celebrateBody', {name, domain: domainLabel})
            : t('onboarding.celebrateBodyDeferred', {name, domain: domainLabel})}
        </p>
      </div>

      <div className="w-full rounded-[22px] border border-[var(--blue)]/25 bg-[var(--blue)]/6 p-5 sm:p-6">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]">
          {t('onboarding.completionSummary.accomplishmentsTitle')}
        </p>
        <ul className="mt-4 space-y-2.5">
          <li className="flex items-start gap-2.5 text-sm leading-6 txt-strong">
            <span className="mt-0.5 shrink-0 text-emerald-400" aria-hidden>✓</span>
            <span>{t('onboarding.completionSummary.goalSet', {domain: domainLabel})}</span>
          </li>
          <li className="flex items-start gap-2.5 text-sm leading-6 txt-strong">
            <span className="mt-0.5 shrink-0 text-emerald-400" aria-hidden>✓</span>
            <span>
              {firstStepCompleted
                ? t('onboarding.completionSummary.firstStepCompleted')
                : t('onboarding.completionSummary.firstStepCreated')}
            </span>
          </li>
        </ul>

        <p className="mt-5 text-sm leading-7 txt-soft">{t('onboarding.completionSummary.intro')}</p>

        <p className="mt-4 text-xs font-bold uppercase tracking-widest txt-muted">
          {t('onboarding.completionSummary.title')}
        </p>
        <ol className="mt-3 space-y-3">
          {dailyLoopSteps.map((key, index) => (
            <li key={key} className="flex gap-3">
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--blue)]/15 text-xs font-black text-[var(--blue)]">
                {index + 1}
              </span>
              <div className="min-w-0 text-start">
                <p className="text-sm font-bold txt-strong">{t(`home.howItWorks.steps.${key}.title`)}</p>
                <p className="mt-0.5 text-xs leading-5 txt-soft">
                  {t(`home.howItWorks.steps.${key}.body`)}
                </p>
              </div>
            </li>
          ))}
        </ol>
      </div>

      <div className="w-full rounded-[22px] border border-[color:var(--color-border)] fill-1 p-5 text-start">
        <p className="text-xs font-bold uppercase tracking-widest txt-muted">
          {t('onboarding.tomorrowHomePreview.eyebrow')}
        </p>
        <p className="mt-2 text-lg font-black leading-snug txt-strong">
          {t('onboarding.tomorrowHomePreview.title')}
        </p>
        <div className="mt-4 grid gap-2">
          <div className="rounded-2xl border border-[color:var(--color-border)] fill-1 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-widest text-[var(--blue)]/75">
              {t('onboarding.tomorrowHomePreview.focusLabel')}
            </p>
            <p className="mt-1 text-sm font-semibold leading-6 txt-strong">
              {s.firstStep?.title || t('onboarding.tomorrowHomePreview.fallbackStep', {domain: domainLabel})}
            </p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {(['focus', 'streak', 'progress'] as const).map((key) => (
              <div key={key} className="rounded-2xl border border-[color:var(--color-border)] fill-1 px-3 py-3 text-center">
                <p className="text-lg font-black txt-strong">{t(`onboarding.tomorrowHomePreview.metrics.${key}.value`)}</p>
                <p className="mt-1 text-[10px] font-bold uppercase tracking-widest txt-faint">
                  {t(`onboarding.tomorrowHomePreview.metrics.${key}.label`)}
                </p>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-4 text-sm font-semibold leading-7 txt-soft">
          {t('onboarding.identityClose')}
        </p>
      </div>

      <div className="w-full rounded-[20px] border border-emerald-400/25 bg-emerald-500/7 p-5 text-start">
        <p className="text-xs font-bold uppercase tracking-widest text-emerald-300">
          {t('onboarding.returnTomorrow.eyebrow')}
        </p>
        <p className="mt-2 text-lg font-black leading-snug txt-strong">
          {t('onboarding.returnTomorrow.title')}
        </p>
        <p className="mt-2 text-sm leading-7 txt-soft">
          {firstStepCompleted
            ? t('onboarding.returnTomorrow.completedBody')
            : t('onboarding.returnTomorrow.deferredBody')}
        </p>
      </div>

      {s.firstStep && firstStepCompleted && (
        <div className="w-full rounded-[20px] border border-emerald-500/25 bg-emerald-500/7 p-5 text-start">
          <p className="text-xs font-bold uppercase tracking-widest text-emerald-400">
            {t('onboarding.celebrateFirstStep')}
          </p>
          <p className="mt-2 text-base font-bold txt-strong">{s.firstStep.title}</p>
          <p className="mt-1 text-xs text-emerald-400/70">✓ {t('onboarding.celebrateDone')}</p>
        </div>
      )}

      {s.firstStep && !firstStepCompleted && (
        <div className="w-full rounded-[20px] border border-[color:var(--color-border)] fill-1 p-5 text-start">
          <p className="text-xs font-bold uppercase tracking-widest txt-muted">
            {t('onboarding.firstTaskLabel')}
          </p>
          <p className="mt-2 text-base font-bold txt-strong">{s.firstStep.title}</p>
          <p className="mt-1 text-xs txt-muted">{t('onboarding.celebrateScheduled')}</p>
        </div>
      )}

      <button
        type="button"
        className="focus-ring btn-primary w-full justify-center text-lg"
        onClick={onEnter}
      >
        {t('onboarding.enterApp')} <NavArrow />
      </button>
    </div>
  );
}
