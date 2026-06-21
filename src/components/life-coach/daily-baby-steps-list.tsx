'use client';

import {useEffect, useMemo, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import type {DailyBabyStep, Goal} from '@/lib/life-coach/types';
import {
  curatedIdFromStepReasoning,
  isCuratedStepReasoning,
  type CuratedDailyTaskOption,
} from '@/lib/life-coach/curated-daily-tasks';
import {resolveCuratedErrorMessage} from '@/lib/life-coach/curated-api-errors';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import {isPlanBActive} from '@/lib/life-coach/plan-b';
import {buildSkipRecoveryStep, buildSimplifiedStep} from '@/lib/life-coach/simplify-step';
import {deriveFitContextFromSteps} from '@/lib/life-coach/step-fit-score';
import {pickStartHereStep, scoreStepsForDisplay, sortStepsForDisplay} from '@/lib/life-coach/step-priority';
import {shouldShowEveningMomentumMessage} from '@/lib/day-mode';
import {DailyReflectionModal} from './daily-reflection-modal';
import {LifeContextChip} from '@/components/life-context-chip';
import {useConfirm} from '@/components/feedback/confirm-provider';
import {useToast} from '@/components/feedback/toast-provider';
import {AiActionHelpMicrocopy} from '@/components/feedback/ai-action-help-microcopy';
import {BusyButton} from '@/components/feedback/busy-button';
import {DomainStepBadge} from './shared/domain-step-badge';
import {StepExplainability} from './shared/step-explainability';
import {StepStatusButtonsHint} from './shared/step-status-buttons-hint';
import {StepSkipHint} from './shared/step-skip-hint';
import {DailyStepsEmptyState} from './shared/daily-steps-empty-state';
import {parseHabitTriggerFromTitle} from '@/lib/formulation/habit-trigger-routing';
import {fetchFormulationCoachContext} from '@/lib/formulation/personalized-challenge-storage';
import {
  resolveComebackMessage,
  type ComebackMessaging,
} from '@/lib/formulation/comeback-messaging';
import type {AccountabilityContext} from '@/lib/formulation/accountability-routing';
import {loadUserPreferences} from '@/lib/user-preferences';
import {assignSuggestedStepTimes, isBeforeWakeTime} from '@/lib/schedule-content';
import {classifyQuestType} from '@/lib/gamification/quest-types';
import {detectEnergyMatchBonus} from '@/lib/gamification/energy-match';
import {computeComebackChain} from '@/lib/gamification/comeback-chain';
import {getFinalBossStep} from '@/lib/gamification/final-boss';
import {buildDailyRollUp} from '@/lib/gamification/daily-roll-up';
import {generateReflectionLoot, type LootType} from '@/lib/gamification/reflection-loot';
import type {IdentityTitle} from '@/lib/gamification/identity-titles';
import {QuestTypeBadge} from '@/components/gamification/quest-type-badge';
import {FinalBossBanner} from '@/components/gamification/final-boss-banner';
import {ReflectionLootCard} from '@/components/gamification/reflection-loot-card';
import {CoachMomentCard} from '@/components/coach/coach-moment-card';
import {buildCoachPayloadFromSkip, fetchCoachMomentSafe} from '@/lib/coach/moment';
import {DailyRollUpCard} from '@/components/gamification/daily-roll-up-card';
import {StepBehaviorHints} from '@/components/behavior-science/step-behavior-hints';
import {
  FrictionAuditBanner,
  NeverMissTwiceBanner,
  RecoveryQuestCard,
} from '@/components/behavior-science/behavior-panels';
import {hadMissedYesterday, pickRecoveryQuest} from '@/lib/behavior-science/never-miss-twice';
import {diagnoseFriction, recordStepSkip} from '@/lib/behavior-science/friction-audit';
import {getGoalContract} from '@/lib/behavior-science/self-contract';
import {identityMessageKey, pickIdentityMoment} from '@/lib/behavior-science/identity-reinforcement';
import type {ReflectionBlockerReason, StepValueFeedback} from '@/lib/life-coach/types';
import {StepValueFeedbackPrompt} from '@/components/life-coach/shared/step-value-feedback-prompt';
import {
  countRecentNegativeValueFeedback,
  shouldPromptStepValueFeedback,
} from '@/lib/step-value-feedback/should-prompt';
import {dateToYMD} from '@/lib/date-utils';
import {commitmentBadgeForStep, CommitmentTodayPanel} from './shared/commitment-today-panel';

type Props = {
  steps: DailyBabyStep[];
  onUpdateStatus: (
    id: string,
    status: 'completed' | 'skipped' | 'partial',
    detail?: {
      reflection_text?: string;
      blocker_reason?: string | null;
      blocker_category?: 'external' | 'internal' | 'unclear' | null;
      actual_minutes?: number | null;
      writing_duration_sec?: number | null;
      reflection_word_count?: number | null;
      self_blame_language?: boolean;
      reattempt_same_day?: boolean;
    }
  ) => Promise<void>;
  onRefresh?: () => Promise<void>;
  emptyAction?: {
    label: string;
    onClick: () => void;
    loading?: boolean;
    loadingLabel?: string;
  };
  /** When false, empty state steers user to create a goal first. */
  hasGoals?: boolean;
  onSetupGoal?: () => void;
  goalSetupHref?: string;
  /** Latest check-in energy (1–10) for smart ordering. */
  energy?: number | null;
  weekSteps?: DailyBabyStep[];
  identityTitle?: IdentityTitle | null;
  goals?: Goal[];
  /** When true, render nothing instead of the empty-state panel (e.g. curated picker shown above). */
  hideEmptyState?: boolean;
};


const localDateStr = dateToYMD;
const QUICK_TIME_RATIO = 0.6;

function curatedIdFromReasoning(reasoning?: string | null): string | null {
  return curatedIdFromStepReasoning(reasoning);
}

function getTomorrow(): string {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  return localDateStr(d);
}

export function DailyBabyStepsList({
  steps,
  onUpdateStatus,
  onRefresh,
  emptyAction,
  hasGoals = true,
  onSetupGoal,
  goalSetupHref,
  energy = null,
  weekSteps = [],
  identityTitle = null,
  goals = [],
  hideEmptyState = false,
}: Props) {
  const t = useTranslations();
  const tCommitment = useTranslations('behaviorScience.commitmentToday');
  const goalsById = useMemo(() => new Map(goals.map((goal) => [goal.id, goal])), [goals]);
  const locale = useLocale() as AppLocale;
  const toast = useToast();
  const {confirm} = useConfirm();
  const [activeStep, setActiveStep] = useState<DailyBabyStep | null>(null);
  const [activeAction, setActiveAction] = useState<'skipped' | 'partial'>('partial');
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [microCreatingId, setMicroCreatingId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [minutesPromptId, setMinutesPromptId] = useState<string | null>(null);
  const [valueFeedbackPromptId, setValueFeedbackPromptId] = useState<string | null>(null);
  const [actualMinutes, setActualMinutes] = useState<string>('');
  const [microReward, setMicroReward] = useState<string | null>(null);
  const [reflectionLoot, setReflectionLoot] = useState<LootType | null>(null);
  const [skipCoachMessage, setSkipCoachMessage] = useState<string | null>(null);
  const [skipCoachLoading, setSkipCoachLoading] = useState(false);
  const [skipRecoveryLoadingId, setSkipRecoveryLoadingId] = useState<string | null>(null);
  const [skipRecoveryHighlightId, setSkipRecoveryHighlightId] = useState<string | null>(null);
  const skipRecoveryBlockersRef = useRef<Record<string, ReflectionBlockerReason | null>>({});
  const [frictionShrinkingId, setFrictionShrinkingId] = useState<string | null>(null);
  const [replacementStepId, setReplacementStepId] = useState<string | null>(null);
  const [replacementOptions, setReplacementOptions] = useState<CuratedDailyTaskOption[]>([]);
  const [replacementLoadingId, setReplacementLoadingId] = useState<string | null>(null);
  const [replacingId, setReplacingId] = useState<string | null>(null);
  const [identityFlash, setIdentityFlash] = useState<string | null>(null);
  const [comebackMessaging, setComebackMessaging] = useState<ComebackMessaging | null>(null);
  const [accountability, setAccountability] = useState<AccountabilityContext | null>(null);
  const identityFlashTimeoutRef = useRef<number | null>(null);
  const microRewardTimeoutRef = useRef<number | null>(null);
  const reportedRef = useRef<Set<string>>(new Set());
  const today = localDateStr(new Date());
  const tBs = useTranslations('behaviorScience');

  useEffect(() => {
    let cancelled = false;
    void fetchFormulationCoachContext()
      .then((ctx) => {
        if (cancelled) return;
        setComebackMessaging(ctx.comeback_messaging);
        setAccountability(ctx.accountability);
      })
      .catch(() => {
        if (cancelled) return;
        setComebackMessaging(null);
        setAccountability(null);
      });
    return () => {
      cancelled = true;
      if (identityFlashTimeoutRef.current) {
        window.clearTimeout(identityFlashTimeoutRef.current);
      }
      if (microRewardTimeoutRef.current) {
        window.clearTimeout(microRewardTimeoutRef.current);
      }
    };
  }, []);

  function showIdentityFlash(message: string) {
    setIdentityFlash(message);
    if (identityFlashTimeoutRef.current) {
      window.clearTimeout(identityFlashTimeoutRef.current);
    }
    identityFlashTimeoutRef.current = window.setTimeout(() => {
      setIdentityFlash(null);
      identityFlashTimeoutRef.current = null;
    }, 4000);
  }

  function showMicroReward(message: string) {
    setMicroReward(message);
    if (microRewardTimeoutRef.current) {
      window.clearTimeout(microRewardTimeoutRef.current);
    }
    microRewardTimeoutRef.current = window.setTimeout(() => {
      setMicroReward(null);
      microRewardTimeoutRef.current = null;
    }, 2600);
  }

  const prefs = loadUserPreferences();
  const schedulePrefs = useMemo(
    () => ({
      wake_time: prefs.wake_time,
      sleep_time: prefs.sleep_time,
      preferred_action_window: prefs.preferred_action_window,
    }),
    [prefs.wake_time, prefs.sleep_time, prefs.preferred_action_window]
  );
  const sortedSteps = useMemo(
    () => sortStepsForDisplay(steps, schedulePrefs, new Date(), energy, weekSteps),
    [steps, schedulePrefs, energy, weekSteps]
  );
  const stepFitScores = useMemo(() => {
    const derived = deriveFitContextFromSteps(weekSteps.length > 0 ? weekSteps : steps);
    return scoreStepsForDisplay(sortedSteps.filter((s) => s.status === 'pending'), {
      energy,
      wakeTime: schedulePrefs.wake_time,
      sleepTime: schedulePrefs.sleep_time,
      preferredActionWindow: schedulePrefs.preferred_action_window,
      ...derived,
    });
  }, [sortedSteps, energy, schedulePrefs, weekSteps, steps]);
  const recommendedId =
    pickStartHereStep(sortedSteps, energy, schedulePrefs, weekSteps)?.id ?? null;
  const pendingCount = sortedSteps.filter((step) => step.status === 'pending').length;
  const showEveningMomentum = shouldShowEveningMomentumMessage(
    prefs.sleep_time,
    pendingCount
  );

  const completedToday = sortedSteps.filter((step) => step.status === 'completed');
  const allActioned =
    sortedSteps.length > 0 && sortedSteps.every((step) => step.status !== 'pending');
  const totalLoggedMinutes = completedToday.reduce(
    (sum, step) => sum + (step.actual_minutes ?? step.estimated_minutes),
    0
  );
  const finalBoss = getFinalBossStep(sortedSteps, prefs.sleep_time);
  const comebackChain = weekSteps.length > 0 ? computeComebackChain(weekSteps, today) : 0;
  const dailyRollUp = allActioned
    ? buildDailyRollUp(sortedSteps, identityTitle, comebackChain)
    : null;
  const missedYesterday = weekSteps.length > 0 && hadMissedYesterday(weekSteps, today);
  const recoveryQuest = missedYesterday
    ? pickRecoveryQuest(sortedSteps, energy, schedulePrefs, weekSteps)
    : null;
  const recoveryMode = !!recoveryQuest;
  const recentNegativeValueFeedback = countRecentNegativeValueFeedback(
    weekSteps.length > 0 ? weekSteps : sortedSteps
  );

  function maybeShowValueFeedback(step: DailyBabyStep) {
    const completedAiToday = sortedSteps.filter(
      (item) => item.status === 'completed' && item.generated_by_ai
    ).length;
    if (
      shouldPromptStepValueFeedback({
        step,
        completedAiStepsToday: completedAiToday,
        recentNegativeFeedbackCount: recentNegativeValueFeedback,
      })
    ) {
      setValueFeedbackPromptId(step.id);
    }
  }

  async function saveValueFeedback(step: DailyBabyStep, feedback: StepValueFeedback) {
    try {
      await lifeCoachApi.updateDailyStepStatus(step.id, {
        status: 'completed',
        value_feedback: feedback,
      });
      toast.success(t('lifeCoach.valueFeedback.thanks'));
      setValueFeedbackPromptId(null);
      await onRefresh?.();
    } catch {
      toast.error(t('feedback.failed'));
    }
  }
  const displaySteps = recoveryMode && recoveryQuest
    ? sortedSteps.filter((s) => s.id === recoveryQuest.id)
    : sortedSteps;

  useEffect(() => {
    if (!prefs.behavioral_analytics_enabled) return;
    for (const step of steps) {
      if (step.status === 'pending' && !step.first_viewed_at && !reportedRef.current.has(step.id)) {
        reportedRef.current.add(step.id);
        void lifeCoachApi.updateDailyStepStatus(step.id, {
          status: step.status,
          first_viewed_at: new Date().toISOString(),
        } as Record<string, unknown>).catch(() => {/* best-effort */});
      }
    }
  }, [prefs.behavioral_analytics_enabled, steps]);

  if (steps.length === 0) {
    if (hideEmptyState) return null;
    return (
      <DailyStepsEmptyState
        hasGoals={hasGoals}
        emptyAction={emptyAction}
        onSetupGoal={onSetupGoal}
        goalSetupHref={goalSetupHref}
      />
    );
  }

  function toggleDescription(stepId: string, hasBeenRead: boolean) {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(stepId)) {
        next.delete(stepId);
      } else {
        next.add(stepId);
        if (!hasBeenRead && prefs.behavioral_analytics_enabled) {
          void lifeCoachApi.updateDailyStepStatus(stepId, {
            status: steps.find((s) => s.id === stepId)?.status ?? 'pending',
            read_description: true,
          } as Record<string, unknown>).catch(() => {/* best-effort */});
        }
      }
      return next;
    });
  }

  async function applySkipRecovery(step: DailyBabyStep) {
    setSkipRecoveryLoadingId(step.id);
    try {
      let content = buildSkipRecoveryStep(step, locale);
      try {
        const suggested = await lifeCoachApi.suggestSkipRecovery(step.id, {
          locale,
          blocker_reason: skipRecoveryBlockersRef.current[step.id] ?? null,
        });
        content = suggested.content;
      } catch {
        /* local fallback */
      }
      await lifeCoachApi.updateDailyStepContent(step.id, content);
      await lifeCoachApi.updateDailyStepStatus(step.id, {status: 'pending'});
      setSkipRecoveryHighlightId(null);
      await onRefresh?.();
      toast.success(t('lifeCoach.skipRecovery.done'));
    } catch {
      toast.error(t('feedback.failed'));
    } finally {
      setSkipRecoveryLoadingId(null);
    }
  }

  async function createMicroStepTomorrow(step: DailyBabyStep) {
    setMicroCreatingId(step.id);
    try {
      await lifeCoachApi.createDailyStep({
        goal_id: step.goal_id,
        domain: step.domain,
        title: t('lifeCoach.microStepTomorrowTitle', {title: step.title}),
        description: t('lifeCoach.microStepTomorrowDesc'),
        estimated_minutes: 2,
        difficulty: 'easy',
        scheduled_date: getTomorrow(),
      });
      await onRefresh?.();
      toast.success(t('lifeCoach.microStepTomorrowCreated'));
    } catch {
      toast.error(t('feedback.failed'));
    } finally {
      setMicroCreatingId(null);
    }
  }

  async function openReplacementOptions(step: DailyBabyStep) {
    setReplacementStepId(step.id);
    setReplacementOptions([]);
    setReplacementLoadingId(step.id);
    try {
      const currentCuratedId = curatedIdFromReasoning(step.reasoning);
      const selectedCuratedIds = new Set(
        steps
          .filter((item) => item.id !== step.id)
          .map((item) => curatedIdFromReasoning(item.reasoning))
          .filter((taskId): taskId is string => Boolean(taskId))
      );
      const response = await lifeCoachApi.getCuratedDailyTasks({
        domain: step.domain,
        date: step.scheduled_date,
        locale,
      });
      setReplacementOptions(
        response.tasks
          .filter((task) => task.id !== currentCuratedId && !selectedCuratedIds.has(task.id))
          .slice(0, 5)
      );
    } catch (error) {
      toast.error(resolveCuratedErrorMessage(error, t));
      setReplacementStepId(null);
    } finally {
      setReplacementLoadingId(null);
    }
  }

  async function replaceCuratedStep(step: DailyBabyStep, task: CuratedDailyTaskOption) {
    setReplacingId(task.id);
    try {
      await lifeCoachApi.replaceCuratedDailyStep(step.id, {
        replacement_task_id: task.id,
        locale,
      });
      setReplacementStepId(null);
      setReplacementOptions([]);
      await onRefresh?.();
      toast.success(t('lifeCoach.curatedReplace.saved'));
    } catch (error) {
      toast.error(resolveCuratedErrorMessage(error, t));
    } finally {
      setReplacingId(null);
    }
  }

  const lifeContexts = prefs.life_context_statuses;
  const suggestedTimes = assignSuggestedStepTimes(
    sortedSteps.length,
    prefs.wake_time,
    prefs.sleep_time,
    prefs.preferred_action_window
  );
  const beforeWake = isBeforeWakeTime(prefs.wake_time);

  return (
    <>
      <LifeContextChip statuses={lifeContexts} className="mb-1" />
      {showEveningMomentum && (
        <p className="mb-3 text-xs leading-6 text-amber-100/75">{t('lifeCoach.eveningMomentumHint')}</p>
      )}
      {skipRecoveryHighlightId && (() => {
        const step = sortedSteps.find(
          (item) => item.id === skipRecoveryHighlightId && item.status === 'skipped'
        );
        if (!step) return null;
        return (
          <div className="mb-3 rounded-[18px] border border-sky-400/25 bg-sky-500/8 px-4 py-3">
            <p className="text-sm font-black txt-strong">{t('lifeCoach.skipRecovery.bannerTitle')}</p>
            <p className="mt-1 text-xs leading-5 txt-soft">{t('lifeCoach.skipRecovery.bannerBody')}</p>
            <BusyButton
              type="button"
              className="focus-ring btn-small mt-3"
              busy={skipRecoveryLoadingId === step.id}
              busyLabel={t('lifeCoach.generating')}
              onClick={() => void applySkipRecovery(step)}
            >
              {t('lifeCoach.skipRecovery.btn')}
            </BusyButton>
            <AiActionHelpMicrocopy kind="skipRecovery" className="mt-2" />
          </div>
        );
      })()}
      {(skipCoachLoading || skipCoachMessage) && (
        <CoachMomentCard
          text={skipCoachMessage}
          loading={skipCoachLoading}
          defaultOpen
          onDismiss={() => {
            setSkipCoachMessage(null);
            setSkipCoachLoading(false);
          }}
        />
      )}
      {reflectionLoot && (
        <ReflectionLootCard loot={reflectionLoot} onDismiss={() => setReflectionLoot(null)} />
      )}
      {dailyRollUp ? (
        <DailyRollUpCard rollUp={dailyRollUp} />
      ) : (
        allActioned &&
        completedToday.length > 0 && (
          <div className="mb-3 rounded-[18px] border border-[var(--blue)]/25 bg-[var(--blue)]/8 px-4 py-3">
            <p className="text-sm font-black txt-strong">
              {t('lifeCoach.dailySummary', {
                count: completedToday.length,
                minutes: totalLoggedMinutes,
              })}
            </p>
          </div>
        )
      )}
      {finalBoss && !recoveryMode && <FinalBossBanner step={finalBoss} />}
      {recoveryMode && recoveryQuest && (
        <div className="mb-3 space-y-3">
          <NeverMissTwiceBanner />
          <RecoveryQuestCard step={recoveryQuest} />
        </div>
      )}
      {identityFlash && (
        <div className="mb-3 rounded-[18px] border border-violet-400/25 bg-violet-500/8 px-4 py-3 text-sm font-semibold leading-6 text-violet-100">
          {identityFlash}
        </div>
      )}
      {microReward && (
        <div className="mb-3 rounded-[18px] border border-emerald-400/25 bg-emerald-500/8 px-4 py-3 text-sm font-black text-emerald-300">
          {microReward}
        </div>
      )}
      {accountability?.daily_step_serve && sortedSteps.length > 0 && (
        <div className="mb-3 rounded-[18px] border border-[var(--blue)]/20 bg-[var(--blue)]/6 px-4 py-3">
          <p className="text-sm font-semibold leading-6 txt-strong">
            {accountability.daily_step_serve}
          </p>
        </div>
      )}
      {goals.length > 0 && (
        <div className="mb-4">
          <CommitmentTodayPanel goals={goals} todaySteps={steps} />
        </div>
      )}
      <div className="grid gap-4">
        {displaySteps.map((step) => {
          const stepGoal = step.goal_id ? goalsById.get(step.goal_id) : undefined;
          const commitmentBadge = commitmentBadgeForStep(stepGoal, tCommitment);
          const index = sortedSteps.findIndex((s) => s.id === step.id);
          const isExpanded = expandedIds.has(step.id);
          const suggestedTime = suggestedTimes[index];
          const isRecommended = step.id === recommendedId;
          const fit = stepFitScores.get(step.id);
          const frictionDiagnosis = step.status === 'pending' ? diagnoseFriction(step) : null;
          const isFinalBoss = finalBoss?.id === step.id;
          const questType = classifyQuestType(step);
          const habitAnchor = parseHabitTriggerFromTitle(step.title, locale);
          const curatedTaskId = curatedIdFromReasoning(step.reasoning);
          const canReplaceCurated = step.status === 'pending' && !!curatedTaskId;
          const timeLabel = beforeWake && index === 0
            ? t('schedule.stepSuggestedFromWake', {wakeTime: prefs.wake_time})
            : suggestedTime
              ? t('schedule.stepSuggestedTime', {time: suggestedTime})
              : null;
          return (
            <article
              key={step.id}
              id={`step-${step.id}`}
              aria-label={step.title}
              className={`panel-surface p-5 ${isRecommended ? 'ring-1 ring-[var(--blue)]/35' : ''} ${isFinalBoss ? 'ring-1 ring-amber-400/40' : ''}`}
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <DomainStepBadge domain={step.domain} />
                    {commitmentBadge && (
                      <span className="inline-flex items-center rounded-full border border-violet-400/35 bg-violet-500/12 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-violet-200">
                        {commitmentBadge}
                      </span>
                    )}
                    <QuestTypeBadge type={questType} />
                    {isRecommended && (
                      <span
                        className="inline-flex items-center rounded-full border border-emerald-400/35 bg-emerald-500/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] text-emerald-300"
                        aria-label={
                          fit
                            ? t('lifeCoach.recommendedFirstHint', {
                                fit: fit.fit_score,
                                energy: fit.energy_fit,
                                time: fit.time_fit,
                              })
                            : undefined
                        }
                      >
                        {t('lifeCoach.recommendedFirst')}
                      </span>
                    )}
                  </div>
                  {habitAnchor ? (
                    <>
                      <p className="mt-3 text-xs font-semibold leading-5 text-[var(--blue)]/85">
                        {habitAnchor.trigger}
                      </p>
                      <h4 className="mt-1 text-lg font-black txt-strong">{habitAnchor.action}</h4>
                    </>
                  ) : (
                    <h4 className="mt-3 text-lg font-black txt-strong">{step.title}</h4>
                  )}
                  {timeLabel && (
                    <p className="mt-2 text-xs font-semibold text-[var(--blue)]/80">{timeLabel}</p>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {(step.reschedule_count ?? 0) >= 2 && (
                    <span
                      aria-label={t('lifeCoach.rescheduledHint')}
                      className="inline-flex cursor-help items-center rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-1 text-xs font-semibold text-amber-400"
                    >
                      {t('lifeCoach.rescheduledBadge', {count: step.reschedule_count ?? 0})}
                    </span>
                  )}
                  <span
                    className="inline-flex cursor-help items-center gap-1.5 rounded-full border border-[color:var(--color-border)] fill-1 px-3 py-1.5 text-xs font-semibold uppercase tracking-[0.12em] txt-soft"
                    aria-label={step.status === 'pending' ? t('lifeCoach.pendingStatusInfo') : undefined}
                  >
                    {t(`lifeCoach.dailyStepStatus.${step.status}`)}
                    {step.status === 'pending' && <span aria-hidden className="txt-muted">ⓘ</span>}
                  </span>
                </div>
              </div>
              {step.status === 'pending' && (
                <p className="mt-2 text-xs leading-5 txt-muted">{t('lifeCoach.pendingStatusHint')}</p>
              )}
              {(step.reschedule_count ?? 0) >= 3 && step.status === 'pending' && (
                <p className="mt-2 text-xs leading-5 text-amber-400/80">⚠ {t('lifeCoach.rescheduledHint')}</p>
              )}

              <div className="mt-3">
                <p className={`text-sm leading-7 text-[var(--muted)] ${!isExpanded ? 'line-clamp-2' : ''}`}>
                  {step.description}
                </p>
                {step.description && step.description.length > 80 && (
                  <button
                    type="button"
                    className="focus-ring mt-1 text-xs txt-muted transition-colors hover:txt-soft"
                    aria-expanded={isExpanded}
                    onClick={() => toggleDescription(step.id, !!step.read_description)}
                  >
                    {isExpanded ? t('lifeCoach.showLess') : t('lifeCoach.showMore')}
                  </button>
                )}
              </div>

              {!isCuratedStepReasoning(step.reasoning) && (
                <StepExplainability reasoning={step.reasoning} className="mt-3" />
              )}

              <p className="mt-3 text-sm font-semibold txt-soft">
                {step.estimated_minutes} {t('lifeCoach.minutes')} · {t(`lifeCoach.difficulty.${step.difficulty}`)}
              </p>

              {step.status === 'pending' && (
                <StepBehaviorHints
                  step={step}
                  stepIndex={index}
                  stepCount={sortedSteps.length}
                  wakeTime={prefs.wake_time}
                  sleepTime={prefs.sleep_time}
                  preferredActionWindow={prefs.preferred_action_window}
                />
              )}

              {canReplaceCurated && (
                <div className="mt-4 rounded-xl border border-[color:var(--color-border)] fill-1 p-4">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <p className="text-xs leading-5 txt-muted">
                      {t('lifeCoach.curatedReplace.hint')}
                    </p>
                    <BusyButton
                      type="button"
                      className="focus-ring btn-ghost text-xs"
                      busy={replacementLoadingId === step.id}
                      busyLabel={t('lifeCoach.curatedReplace.loading')}
                      onClick={() => {
                        if (replacementStepId === step.id) {
                          setReplacementStepId(null);
                          setReplacementOptions([]);
                        } else {
                          void openReplacementOptions(step);
                        }
                      }}
                    >
                      {replacementStepId === step.id
                        ? t('lifeCoach.curatedReplace.close')
                        : t('lifeCoach.curatedReplace.open')}
                    </BusyButton>
                  </div>
                  {replacementStepId === step.id && (
                    <div className="mt-3 grid gap-2">
                      {replacementLoadingId === step.id ? (
                        <p className="text-xs leading-5 txt-muted">
                          {t('lifeCoach.curatedReplace.loading')}
                        </p>
                      ) : replacementOptions.length === 0 ? (
                        <p className="text-xs leading-5 txt-muted">
                          {t('lifeCoach.curatedReplace.empty')}
                        </p>
                      ) : (
                        replacementOptions.map((task) => (
                          <div
                            key={task.id}
                            className="rounded-xl border border-[color:var(--color-border)] bg-[rgba(255,255,255,0.02)] p-3"
                          >
                            <p className="text-sm font-black leading-5 txt-strong">{task.title}</p>
                            <p className="mt-1 text-xs leading-5 txt-muted">{task.description}</p>
                            <div className="mt-3 flex flex-wrap items-center gap-2">
                              <span className="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-xs font-semibold txt-muted">
                                {task.durationMinutes} {t('lifeCoach.minutes')}
                              </span>
                              <span className="rounded-full border border-[color:var(--color-border)] px-2.5 py-1 text-xs font-semibold txt-muted">
                                {t(`lifeCoach.difficulty.${task.difficulty}`)}
                              </span>
                              <BusyButton
                                type="button"
                                className="focus-ring btn-small ms-auto text-xs"
                                busy={replacingId === task.id}
                                busyLabel={t('lifeCoach.curatedReplace.saving')}
                                onClick={() => void replaceCuratedStep(step, task)}
                              >
                                {t('lifeCoach.curatedReplace.choose')}
                              </BusyButton>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}

              {frictionDiagnosis && (
                <FrictionAuditBanner
                  diagnosis={frictionDiagnosis}
                  shrinking={frictionShrinkingId === step.id}
                  onShrink={async () => {
                    setFrictionShrinkingId(step.id);
                    try {
                      const planB = buildSimplifiedStep(step, locale);
                      await lifeCoachApi.updateDailyStepContent(step.id, planB);
                      await onRefresh?.();
                      toast.success(t('lifeCoach.easierStepDone'));
                    } catch {
                      toast.error(t('feedback.failed'));
                    } finally {
                      setFrictionShrinkingId(null);
                    }
                  }}
                />
              )}

              {minutesPromptId === step.id && (
                <div className="mt-4 rounded-xl border border-[color:var(--color-border)] fill-1 p-4">
                  <p className="mb-3 text-xs font-semibold txt-soft">
                    {t('lifeCoach.actualMinutesDefault', {n: step.estimated_minutes})}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {[
                      {key: 'less', mins: Math.max(1, Math.round(step.estimated_minutes * QUICK_TIME_RATIO)), label: t('lifeCoach.actualMinutesLess', {n: step.estimated_minutes})},
                      {key: 'about', mins: step.estimated_minutes, label: t('lifeCoach.actualMinutesAbout', {n: step.estimated_minutes})},
                      {key: 'more', mins: Math.round(step.estimated_minutes * 1.6), label: t('lifeCoach.actualMinutesMore', {n: step.estimated_minutes})},
                    ].map(({key, mins, label}) => (
                      <button
                        key={key}
                        type="button"
                        aria-pressed={actualMinutes === String(mins)}
                        className={`focus-ring rounded-full border px-4 py-2 text-xs font-semibold transition ${
                          actualMinutes === String(mins)
                            ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                            : 'border-[color:var(--color-border)] txt-soft hover:border-[color:var(--color-border-strong)] hover:txt-strong'
                        }`}
                        onClick={() => setActualMinutes(String(mins))}
                      >
                        {label}
                      </button>
                    ))}
                    <input
                      type="number"
                      inputMode="numeric"
                      min={1}
                      max={480}
                      value={actualMinutes}
                      onChange={(e) => setActualMinutes(e.target.value)}
                      placeholder={t('lifeCoach.actualMinutesExact')}
                      aria-label={t('lifeCoach.actualMinutesExact')}
                      className="focus-ring w-28 rounded-full border border-[color:var(--color-border)] fill-1 px-3 py-2 text-xs txt-strong placeholder-[color:var(--color-text-faint)]"
                    />
                  </div>
                  <div className="mt-3 flex gap-3">
                    <button
                      type="button"
                      className="focus-ring btn-small text-xs"
                      onClick={async () => {
                        const mins = parseInt(actualMinutes, 10);
                        if (mins > 0) {
                          await lifeCoachApi.updateDailyStepStatus(step.id, {
                            status: 'completed',
                            actual_minutes: mins,
                          }).catch(() => {/* best-effort */});
                        }
                        setMinutesPromptId(null);
                        setActualMinutes('');
                        maybeShowValueFeedback(step);
                      }}
                    >
                      {t('lifeCoach.save')}
                    </button>
                    <button
                      type="button"
                      className="focus-ring text-xs txt-muted hover:txt-soft"
                      onClick={() => {
                        setMinutesPromptId(null);
                        setActualMinutes('');
                        maybeShowValueFeedback(step);
                      }}
                    >
                      {t('lifeCoach.actualMinutesLooksGood')}
                    </button>
                  </div>
                </div>
              )}

              {valueFeedbackPromptId === step.id && step.status === 'completed' && (
                <StepValueFeedbackPrompt
                  onSelect={(feedback) => saveValueFeedback(step, feedback)}
                  onDismiss={() => setValueFeedbackPromptId(null)}
                />
              )}

              {step.status === 'skipped' && step.scheduled_date === today && (
                <div className="mt-4 space-y-3">
                  <div className="rounded-xl border border-sky-400/20 bg-sky-500/6 px-4 py-3">
                    <p className="text-xs leading-6 text-sky-100/85">{t('lifeCoach.skipRecovery.cta')}</p>
                    <BusyButton
                      type="button"
                      className="focus-ring btn-small mt-3"
                      busy={skipRecoveryLoadingId === step.id}
                      busyLabel={t('lifeCoach.generating')}
                      onClick={() => void applySkipRecovery(step)}
                    >
                      {t('lifeCoach.skipRecovery.btn')}
                    </BusyButton>
                    <AiActionHelpMicrocopy kind="skipRecovery" className="mt-2" />
                  </div>
                  <div className="rounded-xl border border-amber-400/20 bg-amber-400/6 px-4 py-3">
                    <p className="text-xs leading-6 text-amber-100/80">{t('lifeCoach.skippedMicroCta')}</p>
                    <BusyButton
                      type="button"
                      className="focus-ring btn-ghost mt-3 text-xs"
                      busy={microCreatingId === step.id}
                      busyLabel={t('lifeCoach.generating')}
                      onClick={() => void createMicroStepTomorrow(step)}
                    >
                      {t('lifeCoach.skippedMicroCtaBtn')}
                    </BusyButton>
                  </div>
                </div>
              )}

              <StepStatusButtonsHint className="mt-5" />
              <div className="mt-2 flex flex-wrap gap-2">
                <BusyButton
                  className="focus-ring btn-small"
                  type="button"
                  busy={loadingId === step.id}
                  onClick={async () => {
                    setLoadingId(step.id);
                    try {
                      const reattempt = step.status === 'skipped' || step.status === 'partial';
                      await onUpdateStatus(step.id, 'completed', {
                        ...(reattempt ? {reattempt_same_day: true} : {}),
                        actual_minutes: step.estimated_minutes,
                      });
                      const identityMoment = pickIdentityMoment({
                        status: 'completed',
                        reattempt,
                        energy,
                        stepMinutes: step.estimated_minutes,
                      });
                      const identityMsg = identityMoment
                        ? tBs(identityMessageKey(identityMoment))
                        : null;
                      const reward = identityMsg ?? (reattempt
                        ? t('lifeCoach.microRewards.comeback')
                        : t('lifeCoach.microRewards.completed', {minutes: step.estimated_minutes}));
                      showMicroReward(reward);
                      if (identityMsg) {
                        showIdentityFlash(identityMsg);
                      }
                      toast.success(reward);
                      setMinutesPromptId(step.id);
                      setActualMinutes(String(step.estimated_minutes));
                    } finally {
                      setLoadingId(null);
                    }
                  }}
                >
                  {t('lifeCoach.markCompleted')}
                </BusyButton>
                {step.status === 'pending' && (
                  <>
                    <BusyButton
                      className="focus-ring btn-ghost text-xs"
                      type="button"
                      busy={loadingId === step.id}
                      onClick={async () => {
                        setLoadingId(step.id);
                        try {
                          await onUpdateStatus(step.id, 'partial');
                          const partialMsg = resolveComebackMessage(
                            comebackMessaging,
                            'partial_toast',
                            locale
                          );
                          showIdentityFlash(partialMsg);
                          toast.success(partialMsg);
                          await onRefresh?.();
                        } catch {
                          toast.error(t('feedback.failed'));
                        } finally {
                          setLoadingId(null);
                        }
                      }}
                    >
                      {t('lifeCoach.didLessButDid')}
                    </BusyButton>
                    {!isPlanBActive(step) && (
                      <BusyButton
                        className="focus-ring btn-ghost text-xs text-sky-300/90"
                        type="button"
                        busy={loadingId === step.id}
                        onClick={async () => {
                          setLoadingId(step.id);
                          try {
                            const planB = buildSimplifiedStep(step, locale);
                            await lifeCoachApi.updateDailyStepContent(step.id, planB);
                            await onRefresh?.();
                            toast.success(t('lifeCoach.easierStepDone'));
                          } catch {
                            toast.error(t('feedback.failed'));
                          } finally {
                            setLoadingId(null);
                          }
                        }}
                      >
                        {t('lifeCoach.easierStepBtn')}
                      </BusyButton>
                    )}
                  </>
                )}
                <button className="focus-ring btn-small" type="button" onClick={() => {
                  setActiveAction('partial');
                  setActiveStep(step);
                }}>
                  {t('lifeCoach.markPartial')}
                </button>
                <div className="flex flex-col items-start gap-1">
                  <button
                    className="focus-ring btn-ghost"
                    type="button"
                    onClick={() => {
                      setActiveAction('skipped');
                      setActiveStep(step);
                    }}
                  >
                    {t('lifeCoach.markSkipped')}
                  </button>
                  <StepSkipHint />
                </div>
                <BusyButton
                  className="focus-ring btn-ghost"
                  type="button"
                  busy={loadingId === step.id}
                  aria-label={t('lifeCoach.snoozeToTomorrow')}
                  onClick={async () => {
                    setLoadingId(step.id);
                    try {
                      const originalDate = step.rescheduled_from ?? step.scheduled_date;
                      await lifeCoachApi.rescheduleDailyStep(step.id, getTomorrow(), originalDate);
                      await onRefresh?.();
                      toast.success(t('feedback.saved'));
                    } catch {
                      toast.error(t('feedback.failed'));
                    } finally {
                      setLoadingId(null);
                    }
                  }}
                >
                  {t('lifeCoach.snoozeToTomorrow')}
                </BusyButton>
                <BusyButton
                  className="focus-ring btn-ghost text-red-400 hover:text-red-300"
                  type="button"
                  busy={loadingId === step.id}
                  onClick={async () => {
                    const ok = await confirm({
                      message: t('lifeCoach.deleteStepConfirm'),
                      destructive: true,
                      confirmLabel: t('lifeCoach.deleteStep'),
                    });
                    if (!ok) return;
                    setLoadingId(step.id);
                    try {
                      await lifeCoachApi.deleteDailyStep(step.id);
                      await onRefresh?.();
                      toast.success(t('feedback.saved'));
                    } catch {
                      toast.error(t('feedback.failed'));
                    } finally {
                      setLoadingId(null);
                    }
                  }}
                >
                  {t('lifeCoach.deleteStep')}
                </BusyButton>
              </div>
            </article>
          );
        })}
      </div>

      <DailyReflectionModal
        key={activeStep?.id ?? 'closed'}
        open={!!activeStep}
        context="skip"
        skipAction={activeAction}
        goalTitle={activeStep?.title}
        selfContract={
          activeStep?.goal_id && goalsById.get(activeStep.goal_id)
            ? getGoalContract(goalsById.get(activeStep.goal_id)!)
            : null
        }
        comebackMessage={
          activeAction === 'partial'
            ? resolveComebackMessage(comebackMessaging, 'partial_primary', locale)
            : resolveComebackMessage(comebackMessaging, 'skip_primary', locale)
        }
        skipCoachIntro={resolveComebackMessage(comebackMessaging, 'skip_coach_intro', locale)}
        onClose={() => setActiveStep(null)}
        onSubmit={async (input) => {
          if (!activeStep) {
            return;
          }

          if (activeAction === 'skipped') {
            recordStepSkip(
              activeStep,
              input.blocker_reason as ReflectionBlockerReason | null
            );
            skipRecoveryBlockersRef.current[activeStep.id] =
              input.blocker_reason as ReflectionBlockerReason | null;
            setSkipRecoveryHighlightId(activeStep.id);
          }

          await onUpdateStatus(
            activeStep.id,
            activeAction,
            {
              reflection_text: input.reflection_text,
              blocker_reason: input.blocker_reason,
              blocker_category: input.blocker_category,
              writing_duration_sec: input.writing_duration_sec,
              reflection_word_count: input.reflection_word_count,
              self_blame_language: input.self_blame_language,
            }
          );
          if (activeAction === 'skipped' && input.coach_action) {
            await lifeCoachApi.saveSkipCoachAdjustment({
              skip_date: activeStep.scheduled_date,
              step_id: activeStep.id,
              goal_id: activeStep.goal_id,
              blocker_reason: input.blocker_reason,
              coach_action: input.coach_action,
              locale,
            });
            toast.success(
              resolveComebackMessage(comebackMessaging, 'skip_coach_saved', locale)
            );
          } else if (activeAction === 'skipped') {
            toast.success(resolveComebackMessage(comebackMessaging, 'skip_toast', locale));
          } else if (activeAction === 'partial') {
            toast.success(resolveComebackMessage(comebackMessaging, 'partial_toast', locale));
          }
          const loot = generateReflectionLoot({
            blocker_reason: input.blocker_reason,
            reflection_text: input.reflection_text,
            energy,
            completedToday: completedToday.length,
          });
          setReflectionLoot(loot);
          lifeCoachApi
            .saveGamificationUnlock({kind: 'reflection_loot', reward_key: loot})
            .catch(() => {});
          setActiveStep(null);
          if (activeAction === 'skipped') {
            const personalized = resolveComebackMessage(comebackMessaging, 'skip_primary', locale);
            setSkipCoachMessage(personalized);
            setSkipCoachLoading(true);
            void (async () => {
              const text = await fetchCoachMomentSafe(
                buildCoachPayloadFromSkip({
                  locale,
                  stepTitle: activeStep.title,
                  blocker_reason: input.blocker_reason,
                  reflection_text: input.reflection_text,
                  energy,
                })
              );
              setSkipCoachLoading(false);
              if (text) {
                setSkipCoachMessage(text);
              }
            })();
          }
          await onRefresh?.();
        }}
      />
    </>
  );
}
