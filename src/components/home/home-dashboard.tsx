'use client';

import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/config';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import {type ApiLoadFailureKind, resolveLifeCoachErrorMessage} from '@/lib/life-coach/api-error';
import {useOnLocalAuthReady} from '@/lib/auth/use-on-local-auth-ready';
import {loadHomeDashboardData, type HomeOptionalSection} from '@/lib/home/load-home-dashboard-data';
import {SurvivalModeBanner} from '@/components/life-coach/survival-mode-banner';
import {
  shouldHighlightSurvivalMode,
} from '@/lib/life-context-content';
import {loadUserPreferences, saveUserPreferences} from '@/lib/user-preferences';
import {
  getPersonalDayPhase,
} from '@/lib/schedule-content';
import {loadOnboardingState} from '@/lib/onboarding-state';
import {useToast} from '@/components/feedback/toast-provider';
import {HomeLoadStatusBanner} from '@/components/home/home-load-status-banner';
import {MobileQuickAction} from '@/components/feedback/mobile-quick-action';
import {ContinueProcessBanner} from '@/components/feedback/continue-process-banner';
import {HomeHowItWorks} from '@/components/home/home-how-it-works';
import {HomeNowActionCard} from '@/components/home/home-now-action-card';
import {
  HomeCelebrationMoment,
  HomeCompactHeader,
  HomeCompactProgress,
  HomeMicroReward,
  HomeSkeleton,
} from '@/components/home/home-dashboard-shell';
import {
  HomeBadgesPanel,
  HomeDomainAttention,
  HomeSoftProgress,
  HomeWeeklyChallenge,
} from '@/components/home/home-dashboard-widgets';
import {
  HomeGoalProgress,
  HomeKpiStrip,
  HomePersonalBests,
} from '@/components/home/home-dashboard-metrics';
import {HomeToolsBar} from '@/components/home/home-tools-bar';
import {ProfileCompletionPrompt} from '@/components/home/profile-completion-prompt';
import {
  computeMomentumScore,
  deriveCelebration,
  deriveHomeBadges,
  derivePrimaryGoal,
  type CelebrationId,
  type HomeDashboardData,
} from '@/lib/home/dashboard-derived';
import {isHomeHowItWorksFirstUseComplete} from '@/lib/home/how-it-works-state';
import {resolveHomeNowAction} from '@/lib/home/resolve-home-now-action';
import {
  getRecommendedPathTool,
  getRecommendedToolLabelKey,
  getRecommendedToolsBarId,
} from '@/lib/home/resolve-recommended-path';
import {
  analyzeWeekBehaviorChange,
} from '@/lib/formulation/behavior-change-tracking';
import {analyzeReturningBarrierWeek} from '@/lib/formulation/skip-adaptation-routing';
import {BehaviorChangeInsightCard} from '@/components/behavior-science/behavior-change-insight-card';
import {shouldEmphasizeSurvivalMode, isSoftSurvivalMode, shouldHidePersonalizedChallenge} from '@/lib/formulation/load-adaptation-routing';
import {detectEnergyMatchBonus} from '@/lib/gamification/energy-match';
import {buildGamificationState} from '@/lib/gamification/state';
import {HomeGamificationStrip} from '@/components/gamification/home-gamification-strip';
import {

  EarlyWarningBanner,
  EndOfDayClosureCard,
  LifeContextModeBanner,
  SocialAccountabilityActions,
} from '@/components/behavior-science/behavior-panels';
import {computeWeeklyBehaviorScore} from '@/lib/behavior-science/behavior-score';
import {detectEarlyWarning} from '@/lib/behavior-science/early-warning';
import {buildEndOfDayClosure} from '@/lib/behavior-science/end-of-day-closure';
import {resolveLifeContextMode} from '@/lib/behavior-science/life-context-mode';
import {buildWeeklyShareText, shareOrCopyWeeklyUpdate} from '@/lib/behavior-science/social-accountability';
import {buildSimplifiedStep} from '@/lib/life-coach/simplify-step';
import {pickStartHereStep} from '@/lib/life-coach/step-priority';
import {currentWeekRange, todayYMD} from '@/lib/date-utils';
import {WEEKLY_TARGET_RATIO} from '@/lib/life-coach/progress-constants';
import {
  completedRitualSessions,
  energyTrend,
  ritualEnergy,
  survivalSignalsFromSessions,
} from '@/lib/home/ritual-derived';

type CoachMessageView = {
  sentence: string;
  action_framing: string;
  primary_step_id: string | null;
};

// ── Types ─────────────────────────────────────────────────────────────────────
type HomeData = HomeDashboardData;

// ── Main component ────────────────────────────────────────────────────────────

export function HomeDashboard() {
  const t      = useTranslations();
  const locale = useLocale() as AppLocale;

  const [data,     setData]     = useState<HomeData | null>(null);
  const [loading,  setLoading]  = useState(true);
  const [loadFailure, setLoadFailure] = useState<ApiLoadFailureKind | null>(null);
  const [partialFailures, setPartialFailures] = useState<HomeOptionalSection[]>([]);
  const [isStaleView, setIsStaleView] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [microReward, setMicroReward] = useState<string | null>(null);
  const [coachMessage, setCoachMessage] = useState<CoachMessageView | null>(null);
  const [sharingWeekly, setSharingWeekly] = useState(false);
  const focusDraftKey = 'home_focus_draft';
  const focusRef = useRef<HTMLInputElement>(null);
  const dataRef = useRef<HomeData | null>(null);
  const microRewardTimeoutRef = useRef<number | null>(null);
  const toast = useToast();
  const router = useRouter();

  useEffect(() => () => {
    if (microRewardTimeoutRef.current) {
      window.clearTimeout(microRewardTimeoutRef.current);
    }
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadFailure(null);
    setPartialFailures([]);
    setIsStaleView(false);

    const prefs = loadUserPreferences();
    const result = await loadHomeDashboardData({
      displayName: prefs.display_name,
      previous: dataRef.current,
    });

    if (!result.ok) {
      setLoadFailure(result.failure);
      setIsStaleView(dataRef.current !== null);
      setLoading(false);
      return;
    }

    if (focusRef.current && !focusRef.current.value) {
      focusRef.current.value = window.localStorage.getItem(focusDraftKey) ?? '';
    }

    dataRef.current = result.data;
    setData(result.data);
    setPartialFailures(result.partialFailures);
    setLoading(false);
  }, []);

  useEffect(() => {
    dataRef.current = data;
  }, [data]);

  useEffect(() => {
    const id = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(id);
  }, [load]);

  useOnLocalAuthReady(useCallback(() => void load(), [load]));

  useEffect(() => {
    let cancelled = false;
    const id = window.setTimeout(() => {
      async function loadCoachMessage() {
        if (!data) {
          setCoachMessage(null);
          return;
        }
        const prefs = loadUserPreferences();
        const latestEnergy = ritualEnergy(completedRitualSessions(data.ritualSessions)[0]);
        const step = pickStartHereStep(
          data.todaySteps,
          latestEnergy,
          {
            wake_time: prefs.wake_time,
            sleep_time: prefs.sleep_time,
            preferred_action_window: prefs.preferred_action_window,
          },
          data.weekSteps
        );
        if (!step) {
          setCoachMessage(null);
          return;
        }
        try {
          const res = await lifeCoachApi.getDailyCoachMessage(todayYMD(), locale);
          if (!cancelled) {
            setCoachMessage(res.message);
          }
        } catch {
          if (!cancelled) {
            setCoachMessage(null);
          }
        }
      }
      void loadCoachMessage();
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(id);
    };
  }, [data, locale]);

  const handleGenerateSteps = useCallback(async () => {
    setGenerating(true);
    try {
      const prefs = loadUserPreferences();
      await lifeCoachApi.generateDailySteps({
        locale,
        wake_time:               prefs.wake_time,
        sleep_time:              prefs.sleep_time,
        coaching_style:          prefs.coaching_style,
        physical_considerations: prefs.physical_considerations,
        preferred_action_window: prefs.preferred_action_window,
        force:                   false,
      });
      await load();
      toast.success(t('lifeCoach.stepsGenerated'));
      window.setTimeout(() => {
        document.getElementById('home-primary-action')?.scrollIntoView({behavior: 'smooth', block: 'start'});
      }, 50);
    } catch (error) {
      toast.error(resolveLifeCoachErrorMessage(error, t));
    } finally {
      setGenerating(false);
    }
  }, [locale, load, t, toast]);

  const handleMarkDone = useCallback(async (stepId: string) => {
    try {
      const step = data?.todaySteps.find((s) => s.id === stepId);
      await lifeCoachApi.updateDailyStepStatus(stepId, {status: 'completed'});
      const energyBonus = step ? detectEnergyMatchBonus(ritualEnergy(completedRitualSessions(data?.ritualSessions ?? [])[0]), step) : null;
      const reward = energyBonus
        ? t(`gamification.energyMatch.${energyBonus}`)
        : t('home.microRewardStep');
      setMicroReward(reward);
      toast.success(reward);
      if (microRewardTimeoutRef.current) {
        window.clearTimeout(microRewardTimeoutRef.current);
      }
      microRewardTimeoutRef.current = window.setTimeout(() => {
        setMicroReward(null);
        microRewardTimeoutRef.current = null;
      }, 2600);
      await load();
    } catch (error) {
      toast.error(resolveLifeCoachErrorMessage(error, t));
    }
  }, [data, load, t, toast]);

  const trackPrimaryCtaClick = useCallback(async (stepId: string) => {
    const step = data?.todaySteps.find((s) => s.id === stepId);
    const prefs = loadUserPreferences();
    if (!step || !prefs.behavioral_analytics_enabled || step.primary_cta_clicked_at) return;
    await lifeCoachApi
      .updateDailyStepStatus(stepId, {
        status: step.status,
        primary_cta_clicked_at: new Date().toISOString(),
      })
      .catch(() => {/* best-effort */});
  }, [data]);

  const handlePrimaryStepStart = useCallback(async (stepId: string) => {
    await trackPrimaryCtaClick(stepId);
    await handleMarkDone(stepId);
  }, [handleMarkDone, trackPrimaryCtaClick]);

  const behaviorChangeAnalysis = (() => {
    if (!data?.behaviorChange) return null;
    const analysis = analyzeWeekBehaviorChange({
      context: data.behaviorChange,
      steps: data.weekSteps,
      locale,
    });
    const returning = analyzeReturningBarrierWeek({
      context: data.skipAdaptation,
      steps: data.weekSteps,
      locale,
    });
    if (!returning) return analysis;
    return {
      ...analysis,
      returning_barrier_headline: returning.headline,
      returning_barrier_detail: returning.detail,
      detail_lines: [returning.detail, ...analysis.detail_lines],
    };
  })();

  const weeklyDoneForUnlock = data?.weeklyDone ?? 0;
  const identityUnlockTitle = data
    ? buildGamificationState({
        today: todayYMD(),
        todaySteps: data.todaySteps,
        weekSteps: data.weekSteps,
        ritualStreak: data.ritualStreak,
        sleepTime: loadUserPreferences().sleep_time,
        hasTodayRitual: data.hasTodayRitual,
        latestEnergy: ritualEnergy(completedRitualSessions(data.ritualSessions)[0]),
        hasWeeklyReview: false,
      }).identityTitle
    : null;

  useEffect(() => {
    if (weeklyDoneForUnlock <= 0 || weeklyDoneForUnlock % 3 !== 0) return;
    const {start} = currentWeekRange();
    const rewardKey =
      weeklyDoneForUnlock >= 9 ? 'weeklyPattern' : weeklyDoneForUnlock >= 6 ? 'domainTip' : 'newInsight';
    lifeCoachApi
      .recordGamificationEvent({kind: 'mystery_unlock', reward_key: rewardKey, week_start: start})
      .catch(() => {});
  }, [weeklyDoneForUnlock]);

  useEffect(() => {
    if (identityUnlockTitle) {
      lifeCoachApi
        .recordGamificationEvent({kind: 'identity_title', reward_key: identityUnlockTitle})
        .catch(() => {});
    }
  }, [identityUnlockTitle]);

  if (loading && !data) return <HomeSkeleton />;
  if (loadFailure && !data) {
    return (
      <div className="page-shell py-6 sm:py-8">
        <HomeLoadStatusBanner
          failure={loadFailure}
          partialFailures={[]}
          stale={false}
          onRetry={() => void load()}
        />
      </div>
    );
  }
  if (!data) return null;

  const prefs         = loadUserPreferences();
  const latestEnergy = ritualEnergy(completedRitualSessions(data.ritualSessions)[0]);
  const primaryStep =
    pickStartHereStep(
      data.todaySteps,
      latestEnergy,
      {
        wake_time: prefs.wake_time,
        sleep_time: prefs.sleep_time,
        preferred_action_window: prefs.preferred_action_window,
      },
      data.weekSteps
    ) ?? null;
  const primaryStepIndex = primaryStep
    ? data.todaySteps.findIndex((s) => s.id === primaryStep.id)
    : -1;
  const allDone       = data.todaySteps.length > 0 && data.todaySteps.every((s) => s.status !== 'pending');
  const hasGoals      = data.goals.some((g) => g.status === 'active');
  const momentumScore = computeMomentumScore(data);
  const badges        = deriveHomeBadges(data);
  const celebration   = deriveCelebration(data);
  const eTrend        = energyTrend(data.ritualSessions);
  const primaryGoal   = derivePrimaryGoal(data.goals, loadOnboardingState().primaryDomain);
  const pendingSteps  = data.todaySteps.filter((s) => s.status === 'pending');
  const highlightSurvival =
    shouldHighlightSurvivalMode(survivalSignalsFromSessions(data.ritualSessions)) ||
    shouldEmphasizeSurvivalMode(data.loadAdaptation);
  const howItWorksFirstUseComplete = isHomeHowItWorksFirstUseComplete({
    ritualCount: completedRitualSessions(data.ritualSessions).length,
    weeklyStepsDone: data.weeklyDone,
    hasEveningToday: data.hasTodayEvening,
  });
  const nowAction = resolveHomeNowAction({
    hasTodayRitual: data.hasTodayRitual,
    hasEveningToday: data.hasTodayEvening,
    hasGoals,
    todaySteps: data.todaySteps,
    primaryStep,
    primaryStepIndex,
    dailyFocus: data.dailyFocus,
    wakeTime: prefs.wake_time,
    sleepTime: prefs.sleep_time,
    energy: latestEnergy,
  });
  const recommendedPathTool = getRecommendedPathTool(nowAction);
  const recommendedToolsBarId = getRecommendedToolsBarId(recommendedPathTool);
  const recommendedToolLabelKey = getRecommendedToolLabelKey(recommendedPathTool);
  const weeklyTarget =
    data.personalizedChallenge?.target_completions_per_week ??
    (data.weeklyTotal > 0
      ? Math.min(data.weeklyTotal, Math.max(3, Math.ceil(data.weeklyTotal * WEEKLY_TARGET_RATIO)))
      : 3);
  const weeklyComplete = data.weeklyDone >= weeklyTarget;

  const today = todayYMD();
  const gamificationState = buildGamificationState({
    today,
    todaySteps: data.todaySteps,
    weekSteps: data.weekSteps,
    ritualStreak: data.ritualStreak,
    sleepTime: prefs.sleep_time,
    hasTodayRitual: data.hasTodayRitual,
    latestEnergy,
    hasWeeklyReview: false,
  });
  const behaviorScore = computeWeeklyBehaviorScore(data.weekSteps);
  const lifeContextMode = resolveLifeContextMode(prefs.life_context_statuses);
  const atRisk = detectEarlyWarning({
    weekSteps: data.weekSteps,
    today,
    pendingToday: pendingSteps.length,
    ritualSessions: data.ritualSessions,
  });
  const dayPhase = getPersonalDayPhase(prefs.wake_time, prefs.sleep_time);
  const endOfDayClosure = buildEndOfDayClosure(data.todaySteps);
  const showClosure = endOfDayClosure && (allDone || dayPhase === 'evening' || dayPhase === 'night');

  async function handleShareWeekly() {
    if (!data) return;
    setSharingWeekly(true);
    try {
      const text = buildWeeklyShareText({
        completed: data.weeklyDone,
        showUpDays: behaviorScore.showUps,
        minutes: data.weeklyMinutes,
        locale,
      });
      const result = await shareOrCopyWeeklyUpdate(text);
      if (result === 'copied') toast.success(t('behaviorScience.social.copied'));
      else if (result === 'shared') toast.success(t('behaviorScience.social.shared'));
      else toast.error(t('feedback.failed'));
    } finally {
      setSharingWeekly(false);
    }
  }

  async function handleTwoMinuteStep() {
    const target = primaryStep ?? pendingSteps[0];
    if (!target) return;
    try {
      const planB = buildSimplifiedStep(target, locale);
      await lifeCoachApi.updateDailyStepContent(target.id, planB);
      await load();
      document.getElementById('home-primary-action')?.scrollIntoView({behavior: 'smooth', block: 'start'});
    } catch (error) {
      toast.error(resolveLifeCoachErrorMessage(error, t));
    }
  }

  async function handleDailyFocusStep() {
    if (!data) return;
    const suggestion = data.dailyFocus?.suggestedAction;
    if (!suggestion) return;
    try {
      await lifeCoachApi.createDailyStep({
        goal_id: null,
        domain: suggestion.domainId,
        title: suggestion.title,
        description: suggestion.description,
        estimated_minutes: suggestion.estimatedMinutes,
        difficulty: 'easy',
        scheduled_date: todayYMD(),
        status: 'pending',
      });
      await load();
      toast.success(t('feedback.saved'));
      document.getElementById('home-primary-action')?.scrollIntoView({behavior: 'smooth', block: 'start'});
    } catch (error) {
      toast.error(resolveLifeCoachErrorMessage(error, t));
    }
  }

  async function handleSurvivalEasyStep(stepId: string) {
    await Promise.all(
      pendingSteps
        .filter((s) => s.id !== stepId)
        .map((s) =>
          lifeCoachApi.updateDailyStepStatus(s.id, {
            status: 'skipped',
            blocker_reason: 'low_energy',
          })
        )
    );
    await load();
  }

  async function handleSurvivalSkipAll(blocker: import('@/lib/life-coach/types').ReflectionBlockerReason) {
    await Promise.all(
      pendingSteps.map((s) =>
        lifeCoachApi.updateDailyStepStatus(s.id, {
          status: 'skipped',
          blocker_reason: blocker,
        })
      )
    );
    await lifeCoachApi.saveReflection({
      date: todayYMD(),
      mood_score: null,
      energy_score: null,
      reflection_text: '',
      blocker_reason: blocker,
    });
    await load();
  }

  async function handleSurvivalPauseDay() {
    await Promise.all(
      pendingSteps.map((s) =>
        lifeCoachApi.updateDailyStepStatus(s.id, {
          status: 'skipped',
          blocker_reason: 'low_energy',
        })
      )
    );
    await load();
  }

  return (
    <div className="page-shell flex flex-col gap-4 py-6 pb-24 sm:gap-5 sm:py-8 sm:pb-8">
      {(loadFailure || partialFailures.length > 0) && (
        <HomeLoadStatusBanner
          failure={loadFailure}
          partialFailures={partialFailures}
          stale={isStaleView}
          onRetry={() => void load()}
        />
      )}

      {/* ── Above the fold: ברכה + פעולה + כלים ───────────────────────────── */}
      <div className="flex flex-col gap-3">
        <HomeCompactHeader
          streak={data.ritualStreak}
          lifeContexts={prefs.life_context_statuses}
          weeklyDone={data.weeklyDone}
          weeklyTotal={data.weeklyTotal}
          t={t}
        />

        <HomeNowActionCard
          action={nowAction}
          recommendedToolLabelKey={recommendedToolLabelKey}
          coachMessage={
            coachMessage?.primary_step_id === nowAction.step?.id ? coachMessage : null
          }
          generating={generating}
          tiredDayAction={
            pendingSteps.length > 0 ? (
              <SurvivalModeBanner
                pendingSteps={pendingSteps}
                lifeContexts={prefs.life_context_statuses}
                emphasize={highlightSurvival}
                softCopy={isSoftSurvivalMode(data.loadAdaptation)}
                compact
                variant="ghost"
                doneMessages={
                  data.comebackMessaging
                    ? {
                        easy: data.comebackMessaging.survival_done_easy,
                        skip: data.comebackMessaging.survival_done_skip,
                        pause: data.comebackMessaging.survival_done_pause,
                      }
                    : undefined
                }
                onEasyStep={handleSurvivalEasyStep}
                onSkipAll={handleSurvivalSkipAll}
                onPauseDay={handleSurvivalPauseDay}
              />
            ) : null
          }
          onDailyStep={handlePrimaryStepStart}
          onDailyFocusStep={handleDailyFocusStep}
          onGenerateSteps={handleGenerateSteps}
          t={t}
        />

      </div>

      {/* ── התראות קריטיות בלבד ─────────────────────────────────────────── */}
      <ProfileCompletionPrompt />
      {lifeContextMode.active && <LifeContextModeBanner mode={lifeContextMode} />}
      <ContinueProcessBanner includeOnboarding />
      {!howItWorksFirstUseComplete && <HomeHowItWorks firstUseComplete={howItWorksFirstUseComplete} />}
      {atRisk && pendingSteps.length > 0 && (
        <EarlyWarningBanner onTwoMinuteStep={() => void handleTwoMinuteStep()} />
      )}
      {microReward && <HomeMicroReward message={microReward} />}
      {celebration && <HomeCelebrationMoment id={celebration} t={t} />}
      {showClosure && endOfDayClosure && (
        <EndOfDayClosureCard closure={endOfDayClosure} />
      )}

      {/* ── שורת התקדמות אחת ─────────────────────────────────────────────── */}
      <HomeCompactProgress
        streak={data.ritualStreak}
        weeklyDone={data.weeklyDone}
        weeklyTarget={weeklyTarget}
        primaryGoal={primaryGoal}
        hasGoals={hasGoals}
        allDone={allDone}
        t={t}
      />

      {/* ── פירוט — מתקפל, שומר 80% מהפונקציונליות ─────────────────────── */}
      <HomeMoreSection t={t}>
        <HomeToolsBar
          hasTodayRitual={data.hasTodayRitual}
          activeGoalCount={data.goals.filter((g) => g.status === 'active').length}
          wakeTime={prefs.wake_time}
          sleepTime={prefs.sleep_time}
          lifeContexts={prefs.life_context_statuses}
          recommendedToolsBarId={recommendedToolsBarId}
          t={t}
        />

        <HomeFocusInput focusRef={focusRef} focusDraftKey={focusDraftKey} t={t} />

        {!allDone && (
          <HomeGoalProgress
            goal={primaryGoal}
            steps={data.todaySteps}
            t={t}
          />
        )}

        <HomeWeeklyChallenge
          done={data.weeklyDone}
          total={data.weeklyTotal}
          weeklyMinutes={data.weeklyMinutes}
          hasGoals={hasGoals}
          challenge={
            shouldHidePersonalizedChallenge(data.loadAdaptation)
              ? null
              : data.personalizedChallenge
          }
          accountability={data.accountability}
          t={t}
        />

        {!weeklyComplete && (
          <HomeSoftProgress
            weekSteps={data.weekSteps}
            ritualSessions={data.ritualSessions}
            weeklyMinutes={data.weeklyMinutes}
            t={t}
          />
        )}

        <HomeDomainAttention
          weekSteps={data.weekSteps}
          goals={data.goals}
          t={t}
        />

        <HomeKpiStrip
          streak={data.ritualStreak}
          weeklyDone={data.weeklyDone}
          weeklyTotal={data.weeklyTotal}
          energyTrend={eTrend}
          ritualSessions={data.ritualSessions}
          behaviorChangeAnalysis={behaviorChangeAnalysis}
          behaviorScore={behaviorScore}
          t={t}
        />

        {data.weeklyDone >= 2 && (behaviorChangeAnalysis?.returning_barrier_headline ?? behaviorChangeAnalysis?.headline) && (
          <BehaviorChangeInsightCard
            headline={
              behaviorChangeAnalysis.returning_barrier_headline ??
              behaviorChangeAnalysis.headline ??
              ''
            }
            detailLines={
              behaviorChangeAnalysis.returning_barrier_detail
                ? [behaviorChangeAnalysis.returning_barrier_detail]
                : (behaviorChangeAnalysis.detail_lines ?? [])
            }
            className={
              behaviorChangeAnalysis.returning_barrier_headline
                ? 'border-amber-400/20 bg-amber-500/6'
                : undefined
            }
          />
        )}

        {data.weeklyDone >= 3 && (
          <HomePersonalBests
            data={data}
            momentumScore={momentumScore}
            t={t}
          />
        )}

        <HomeGamificationStrip
          streakHealth={gamificationState.streakHealth}
          streak={data.ritualStreak}
          comebackChain={gamificationState.comebackChain}
          identityTitle={gamificationState.identityTitle}
          domainRivalry={gamificationState.domainRivalry}
          mysteryUnlock={gamificationState.mysteryUnlock}
        />
        <HomeBadgesPanel badges={badges} t={t} />

        {weeklyComplete && (
          <SocialAccountabilityActions onShare={() => void handleShareWeekly()} busy={sharingWeekly} />
        )}
      </HomeMoreSection>

      <MobileQuickAction
        label={t(nowAction.ctaKey)}
        onClick={() => {
          if (nowAction.kind === 'daily_step' && nowAction.step) {
            void handlePrimaryStepStart(nowAction.step.id);
            return;
          }
          if (nowAction.kind === 'generate_steps') {
            void handleGenerateSteps();
            return;
          }
          if (nowAction.kind === 'daily_focus') {
            void handleDailyFocusStep();
            return;
          }
          if (nowAction.kind === 'morning_ritual') {
            router.push('/morning-priming');
            return;
          }
          if (nowAction.kind === 'evening_reset') {
            router.push('/evening-reset');
            return;
          }
          router.push('/life-coach');
        }}
        loading={generating}
        loadingLabel={t('lifeCoach.generating')}
      />
    </div>
  );
}

function HomeMoreSection({
  children,
  t,
}: {
  children: ReactNode;
  t: ReturnType<typeof useTranslations>;
}) {
  const [open, setOpen] = useState(false);

  return (
    <section className="rounded-[18px] fill-1">
      <button
        type="button"
        className="focus-ring flex w-full items-center justify-between gap-3 px-5 py-4 text-start"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <div>
          <p className="text-sm font-bold txt-strong">{t('home.more.toggle')}</p>
          <p className="mt-0.5 text-sm txt-muted">{t('home.more.hint')}</p>
        </div>
        <span className="shrink-0 text-lg txt-faint" aria-hidden>
          {open ? '−' : '+'}
        </span>
      </button>
      {open && (
        <div className="flex flex-col gap-4 border-t border-[color:var(--color-border)] px-4 py-4 sm:px-5">
          {children}
        </div>
      )}
    </section>
  );
}

// ── Sub-component: Focus Input ────────────────────────────────────────────────

function HomeFocusInput({
  focusRef,
  focusDraftKey,
  t,
}: {
  focusRef:     React.RefObject<HTMLInputElement | null>;
  focusDraftKey: string;
  t:            ReturnType<typeof useTranslations>;
}) {
  const [focusSaved, setFocusSaved] = useState(false);
  const focusSavedTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    if (focusSavedTimeoutRef.current) {
      window.clearTimeout(focusSavedTimeoutRef.current);
    }
  }, []);

  return (
    <div className="flex items-center gap-3 rounded-[16px] border border-[color:var(--color-border)] fill-1 px-4 py-3">
      <span className="text-base txt-faint" aria-hidden>⚡</span>
      <input
        ref={focusRef}
        id="home-focus-input"
        aria-label={t('dashboard.todayFocusPlaceholder')}
        className="min-w-0 flex-1 bg-transparent text-sm font-semibold txt-strong placeholder:txt-faint outline-none"
        placeholder={t('dashboard.todayFocusPlaceholder')}
        maxLength={120}
        onBlur={(e) => {
          window.localStorage.setItem(focusDraftKey, e.target.value);
          setFocusSaved(true);
          if (focusSavedTimeoutRef.current) {
            window.clearTimeout(focusSavedTimeoutRef.current);
          }
          focusSavedTimeoutRef.current = window.setTimeout(() => {
            setFocusSaved(false);
            focusSavedTimeoutRef.current = null;
          }, 1800);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.currentTarget.blur();
          }
        }}
      />
      <span aria-live="polite" aria-atomic="true" className="shrink-0">
        {focusSaved && (
          <span className="text-xs font-bold text-emerald-400" aria-label="Saved">✓</span>
        )}
      </span>
    </div>
  );
}

