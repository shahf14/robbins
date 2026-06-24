'use client';

import {useEffect, useRef, useState, type ReactNode} from 'react';
import {Link} from '@/i18n/navigation';
import type {useTranslations} from 'next-intl';
import type {LifeDomain} from '@/lib/life-coach/types';
import {AiActionHelpMicrocopy} from '@/components/feedback/ai-action-help-microcopy';
import type {HomeNowAction} from '@/lib/home/resolve-home-now-action';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import {loadUserPreferences} from '@/lib/user-preferences';
import {DomainStepBadge} from '@/components/life-coach/shared/domain-step-badge';

type CoachMessageView = {
  sentence: string;
  action_framing: string;
};

type CardPreset = {
  titleKey: string;
  statusKey?: string;
  metaKey?: string;
};

const CARD_PRESETS: Partial<Record<HomeNowAction['kind'], CardPreset>> = {
  morning_ritual: {
    titleKey: 'home.nowAction.cards.morningRitual.title',
    statusKey: 'home.nowAction.cards.morningRitual.status',
    metaKey: 'home.nowAction.cards.morningRitual.meta',
  },
  evening_reset: {
    titleKey: 'home.nowAction.cards.eveningReset.title',
    metaKey: 'home.nowAction.cards.eveningReset.meta',
  },
  generate_steps: {
    titleKey: 'home.nowAction.cards.generateSteps.title',
    metaKey: 'home.nowAction.cards.generateSteps.meta',
  },
  set_goal: {
    titleKey: 'home.nowAction.cards.setGoal.title',
    metaKey: 'home.nowAction.cards.setGoal.meta',
  },
};

type Props = {
  action: HomeNowAction;
  recommendedToolLabelKey: string;
  coachMessage?: CoachMessageView | null;
  generating?: boolean;
  tiredDayAction?: ReactNode;
  onDailyStep: (stepId: string) => Promise<void>;
  onDailyFocusStep?: () => Promise<void>;
  onGenerateSteps: () => Promise<void>;
  t: ReturnType<typeof useTranslations>;
};

export function HomeNowActionCard({
  action,
  recommendedToolLabelKey: _recommendedToolLabelKey,
  coachMessage,
  generating = false,
  tiredDayAction,
  onDailyStep,
  onDailyFocusStep,
  onGenerateSteps,
  t,
}: Props) {
  const [busy, setBusy] = useState(false);
  const impressionReportedRef = useRef(false);

  useEffect(() => {
    if (!coachMessage || !action.step) return;
    const prefs = loadUserPreferences();
    if (!prefs.behavioral_analytics_enabled) return;
    if (action.step.coach_message_impression_at || impressionReportedRef.current) return;
    impressionReportedRef.current = true;
    void lifeCoachApi
      .updateDailyStepStatus(action.step.id, {
        status: action.step.status,
        coach_message_impression_at: new Date().toISOString(),
      })
      .catch(() => {/* best-effort */});
  }, [action.step, coachMessage]);

  async function handlePrimaryClick() {
    if (action.kind === 'daily_step' && action.step) {
      setBusy(true);
      try {
        await onDailyStep(action.step.id);
      } finally {
        setBusy(false);
      }
      return;
    }
    if (action.kind === 'generate_steps') {
      await onGenerateSteps();
      return;
    }
    if (action.kind === 'daily_focus' && onDailyFocusStep) {
      setBusy(true);
      try {
        await onDailyFocusStep();
      } finally {
        setBusy(false);
      }
    }
  }

  const isLinkAction =
    action.kind === 'morning_ritual' ||
    action.kind === 'evening_reset' ||
    action.kind === 'set_goal' ||
    action.kind === 'day_complete';

  const href =
    action.kind === 'morning_ritual'
      ? '/morning-priming'
      : action.kind === 'evening_reset'
        ? '/evening-reset'
        : action.kind === 'set_goal' || action.kind === 'day_complete'
          ? '/life-coach'
          : null;

  const preset = CARD_PRESETS[action.kind];
  const showStructuredCard =
    preset != null || action.kind === 'daily_step' || action.kind === 'daily_focus';

  return (
    <section
      id="home-primary-action"
      className="scroll-mt-24 rounded-[24px] bg-[linear-gradient(160deg,rgba(26,109,255,0.10),rgba(15,20,28,0.95))] px-6 py-7 sm:px-8"
      aria-label={t('home.recommendedPath.title')}
    >
      <p className="text-xs font-bold uppercase tracking-[0.18em] text-[var(--blue)]" aria-hidden="true">
        {t('home.nowAction.eyebrow')}
      </p>

      {showStructuredCard ? (
        <div className="mt-4">
          {preset ? (
            <>
              <h2 className="text-[clamp(1.4rem,4vw,1.9rem)] font-black leading-snug text-white">
                {t(preset.titleKey as Parameters<typeof t>[0])}
              </h2>
              {preset.statusKey ? (
                <p className="mt-2 text-base font-medium leading-7 text-white/88">
                  {t(preset.statusKey as Parameters<typeof t>[0])}
                </p>
              ) : null}
              {preset.metaKey ? (
                <p className="mt-2 text-sm font-medium leading-6 text-white/62">
                  {t(preset.metaKey as Parameters<typeof t>[0])}
                </p>
              ) : null}
            </>
          ) : null}

          {action.kind === 'daily_step' && action.step ? (
            <div className={preset ? 'mt-5 border-t border-white/8 pt-5' : ''}>
              {coachMessage ? (
                <p className="mb-3 text-sm font-medium leading-6 text-white/78">{coachMessage.sentence}</p>
              ) : null}
              <h2 className="text-[clamp(1.35rem,4vw,1.85rem)] font-black leading-snug text-white">
                {action.step.title}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <DomainStepBadge domain={action.step.domain as LifeDomain} />
                {action.estimatedMinutes ? (
                  <span className="text-sm font-semibold text-white/58">
                    ~{action.estimatedMinutes} {t('lifeCoach.minutes')}
                  </span>
                ) : null}
                {action.stepIndex != null && action.stepCount ? (
                  <span className="rounded-full bg-white/6 px-2.5 py-1 text-xs font-bold text-white/58">
                    {t('home.dailyStepsProgress', {
                      current: action.stepIndex + 1,
                      total: action.stepCount,
                    })}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}

          {action.kind === 'daily_focus' && action.dailyFocusSuggestion ? (
            <div className={preset ? 'mt-5 border-t border-white/8 pt-5' : ''}>
              <p className="mb-3 text-sm font-medium leading-6 text-white/78">
                {t('home.nowAction.dailyFocusEyebrow')}
              </p>
              <h2 className="text-[clamp(1.35rem,4vw,1.85rem)] font-black leading-snug text-white">
                {action.dailyFocusSuggestion.title}
              </h2>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <DomainStepBadge domain={action.dailyFocusSuggestion.domainId as LifeDomain} />
                {action.estimatedMinutes ? (
                  <span className="text-sm font-semibold text-white/58">
                    ~{action.estimatedMinutes} {t('lifeCoach.minutes')}
                  </span>
                ) : null}
              </div>
              {action.dailyFocusSuggestion.description ? (
                <p className="mt-3 text-sm leading-7 text-white/68">
                  {action.dailyFocusSuggestion.description}
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="mt-5 rounded-2xl bg-white/[0.04] px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-[0.12em] text-white/48">
              {t('home.nowAction.whyLabel')}
            </p>
            <p className="mt-1.5 text-sm leading-7 text-white/76">{t(action.reasonKey)}</p>
          </div>
        </div>
      ) : (
        <p className="mt-3 text-base leading-7 text-white/80">{t(action.reasonKey)}</p>
      )}

      <div className="mt-6 flex flex-row-reverse flex-wrap items-center gap-3 rtl:flex-row sm:gap-4">
        {isLinkAction && href ? (
          href.startsWith('#') ? (
            <a href={href} className="focus-ring btn-primary">
              {t(action.ctaKey)}
            </a>
          ) : (
            <Link href={href} className="focus-ring btn-primary">
              {t(action.ctaKey)}
            </Link>
          )
        ) : (
          <div className="flex flex-col items-start gap-2">
            <button
              type="button"
              className="focus-ring btn-primary disabled:opacity-60"
              disabled={busy || generating}
              aria-busy={busy || generating}
              onClick={() => void handlePrimaryClick()}
            >
              {busy || generating ? '…' : t(action.ctaKey)}
            </button>
            {action.kind === 'generate_steps' ? <AiActionHelpMicrocopy kind="dailySteps" /> : null}
          </div>
        )}

        {action.kind === 'daily_step' || action.kind === 'daily_focus' ? (
          <Link href="/life-coach" className="focus-ring btn-ghost">
            {t('home.nowAction.cta.viewSteps')}
          </Link>
        ) : null}

        {tiredDayAction}
      </div>
    </section>
  );
}
