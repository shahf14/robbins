'use client';

import {useCallback, useEffect, useMemo, useRef, useState, type ReactNode} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import {loadUserPreferences} from '@/lib/user-preferences';
import type {AiCoachingInsight, DailyBabyStep, DomainCardSummary, Goal, LifeDomainState} from '@/lib/life-coach/types';
import {AIInsightCard} from './ai-insight-card';
import {DailyBabyStepsList} from './daily-baby-steps-list';
import {CuratedDailyTaskPicker} from './curated-daily-task-picker';
import {LifeCoachAuthShell} from './life-coach-auth-shell';
import {LifeDomainCard} from './life-domain-card';
import {WeeklyReviewCard} from './weekly-review-card';
import {AiInsightsVsWeeklyReviewExplainer} from './shared/ai-insights-vs-weekly-review-explainer';
import {CoachHandoffCard} from '@/components/formulation/coach-handoff-card';
import {FeatureUnlockBanner} from './feature-unlock-banner';
import {SurvivalModeBanner} from './survival-mode-banner';
import {shouldHighlightSurvivalMode} from '@/lib/life-context-content';
import {fetchFormulationCoachContext} from '@/lib/formulation/personalized-challenge-storage';
import {
  shouldEmphasizeSurvivalMode,
  isSoftSurvivalMode,
  type LoadAdaptationContext,
} from '@/lib/formulation/load-adaptation-routing';
import type {ComebackMessaging} from '@/lib/formulation/comeback-messaging';
import {fetchSessions, getStreak} from '@/lib/morning-ritual-storage';
import type {MorningRitualSession} from '@/lib/morning-ritual-types';
import {useToast} from '@/components/feedback/toast-provider';
import {LoadingErrorPanel} from '@/components/feedback/loading-error-panel';
import {MobileQuickAction} from '@/components/feedback/mobile-quick-action';
import {AiActionHelpMicrocopy} from '@/components/feedback/ai-action-help-microcopy';
import {BusyButton} from '@/components/feedback/busy-button';
import {AiGeneratingProgress} from './shared/ai-generating-progress';
import {ContinueProcessBanner} from '@/components/feedback/continue-process-banner';
import {StepFilterChips, type StepStatusFilter} from './step-filter-chips';
import {FeatureHint} from '@/components/feedback/feature-hint';
import {NextActionBar} from '@/components/feedback/next-action-bar';
import {markFeatureSeen} from '@/lib/feature-discovery';
import {computeComebackChain} from '@/lib/gamification/comeback-chain';
import {deriveIdentityTitle} from '@/lib/gamification/identity-titles';
import {computeRecoveryRate} from '@/lib/behavior-profile/compute';
import {computeMysteryUnlock} from '@/lib/gamification/mystery-unlocks';
import {HomeGamificationStrip} from '@/components/gamification/home-gamification-strip';
import {computeDomainRivalry} from '@/lib/gamification/domain-rivalry';
import {deriveStreakHealth} from '@/lib/gamification/streak-health';
import {
  BehaviorScoreChip,
  EarlyWarningBanner,
  EndOfDayClosureCard,
  LifeContextModeBanner,
  SocialAccountabilityActions,
} from '@/components/behavior-science/behavior-panels';
import {computeWeeklyBehaviorScore} from '@/lib/behavior-science/behavior-score';
import {detectEarlyWarning} from '@/lib/behavior-science/early-warning';
import {resolveLifeContextMode} from '@/lib/behavior-science/life-context-mode';
import {buildWeeklyShareText, shareOrCopyWeeklyUpdate} from '@/lib/behavior-science/social-accountability';
import {buildSimplifiedStep} from '@/lib/life-coach/simplify-step';
import {pickStartHereStep} from '@/lib/life-coach/step-priority';
import {getPersonalDayPhase} from '@/lib/schedule-content';
import {buildEndOfDayClosure} from '@/lib/behavior-science/end-of-day-closure';
import {DomainScoreExplainer} from './shared/domain-score-explainer';
import {RegenerateStepsHint} from './shared/regenerate-steps-hint';
import {currentWeekRange, todayYMD} from '@/lib/date-utils';
import {WEEKLY_TARGET_RATIO} from '@/lib/life-coach/progress-constants';

export function LifeCoachHome() {
  return (
    <main className="section-block border-t-0">
      <div className="page-shell">
        <LifeCoachAuthShell>{() => <LifeCoachHomeContent />}</LifeCoachAuthShell>
      </div>
    </main>
  );
}

function LifeCoachHomeContent() {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [loading, setLoading] = useState(true);
  const [domainCards, setDomainCards] = useState<DomainCardSummary[]>([]);
  const [domainStates, setDomainStates] = useState<LifeDomainState[]>([]);
  const [todaySteps, setTodaySteps] = useState<DailyBabyStep[]>([]);
  const [goals, setGoals] = useState<Goal[]>([]);
  const [weeklyReview, setWeeklyReview] = useState<AiCoachingInsight | null>(null);
  const [insights, setInsights] = useState<AiCoachingInsight[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const toast = useToast();
  const [ritualSessions, setRitualSessions] = useState<MorningRitualSession[]>([]);
  const [weekSteps, setWeekSteps] = useState<DailyBabyStep[]>([]);
  const [ritualStreak, setRitualStreak] = useState(0);
  const [stepFilter, setStepFilter] = useState<StepStatusFilter>('all');
  const [sharingWeekly, setSharingWeekly] = useState(false);
  const [loadAdaptation, setLoadAdaptation] = useState<LoadAdaptationContext | null>(null);
  const [comebackMessaging, setComebackMessaging] = useState<ComebackMessaging | null>(null);
  const mountedRef = useRef(true);
  const scrollTimeoutRef = useRef<number | null>(null);

  useEffect(() => () => {
    mountedRef.current = false;
    if (scrollTimeoutRef.current) {
      window.clearTimeout(scrollTimeoutRef.current);
    }
  }, []);

  const hasAnyGoal = domainCards.some((card) => card.active_goals_count > 0);
  const configuredCount = domainCards.filter((card) => card.active_goals_count > 0).length;
  const totalDomains = domainCards.length || 8;
  const refresh = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const {start, end} = currentWeekRange();
      const [domains, goalsRes, dailySteps, weekStepsRes, latestReview, recentInsights, sessions, coachContext] =
        await Promise.all([
        lifeCoachApi.listDomains(),
        lifeCoachApi.listGoals().catch(() => ({goals: []})),
        lifeCoachApi.getDailySteps(todayYMD()),
        lifeCoachApi.getDailyStepsRange(start, end),
        lifeCoachApi.getLatestWeeklyReview().catch(() => ({review: null})),
        lifeCoachApi.listInsights().catch(() => ({insights: []})),
        fetchSessions().catch(() => []),
        fetchFormulationCoachContext().catch(() => ({
          challenge: null,
          load_adaptation: null,
          comeback_messaging: null,
          accountability: null,
          behavior_change: null,
        })),
      ]);

      if (!mountedRef.current) return;
      setDomainCards(domains.domains);
      setDomainStates(domains.states);
      setGoals(goalsRes.goals);
      setTodaySteps(dailySteps.steps);
      setWeekSteps(weekStepsRes.steps);
      setWeeklyReview(latestReview.review);
      setInsights(recentInsights.insights.slice(0, 4));
      setRitualSessions(sessions.filter((session) => session.completed));
      setRitualStreak(getStreak(sessions));
      setLoadAdaptation(coachContext.load_adaptation);
      setComebackMessaging(coachContext.comeback_messaging);
    } catch {
      if (!mountedRef.current) return;
      setLoadError(t('lifeCoach.loadError'));
    }
    if (mountedRef.current) {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      void refresh();
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [refresh]);

  const prefs = loadUserPreferences();
  const schedulePrefs = {
    wake_time: prefs.wake_time,
    sleep_time: prefs.sleep_time,
    preferred_action_window: prefs.preferred_action_window,
  };
  const latestRitualEnergy =
    ritualSessions[0]?.energyScore ??
    (ritualSessions[0]?.moodBefore ? Number(ritualSessions[0].moodBefore) : null);
  const pendingStep =
    pickStartHereStep(todaySteps, latestRitualEnergy, schedulePrefs, weekSteps) ?? null;
  const generateLabel =
    todaySteps.length > 0 ? t('lifeCoach.regenerateTodaySteps') : t('lifeCoach.generateTodaySteps');
  const stepFilterCounts = useMemo(
    () => ({
      pending: todaySteps.filter((s) => s.status === 'pending').length,
      completed: todaySteps.filter((s) => s.status === 'completed').length,
      skipped: todaySteps.filter((s) => s.status === 'skipped').length,
      partial: todaySteps.filter((s) => s.status === 'partial').length,
    }),
    [todaySteps]
  );
  const filteredSteps = useMemo(
    () => (stepFilter === 'all' ? todaySteps : todaySteps.filter((s) => s.status === stepFilter)),
    [todaySteps, stepFilter]
  );
  const latestEnergy = latestRitualEnergy;
  const nextActionLabel = pendingStep
    ? t('home.nextAction.markStep')
    : hasAnyGoal
      ? t('home.nextAction.generateSteps')
      : t('home.nextAction.setGoal');
  const weeklyDone = weekSteps.filter((s) => s.status === 'completed').length;
  const comebackChain = computeComebackChain(weekSteps, todayYMD());
  const identityTitle = deriveIdentityTitle({
    weeklyDone,
    allDoneToday: todaySteps.length > 0 && todaySteps.every((s) => s.status !== 'pending'),
    comebackChain,
    activeDomains: new Set(weekSteps.filter((s) => s.status === 'completed').map((s) => s.domain)).size,
    pendingEvening: todaySteps.filter((s) => s.status === 'pending').length,
    recoveryRate: computeRecoveryRate(weekSteps),
  });
  useEffect(() => {
    if (identityTitle) {
      lifeCoachApi
        .saveGamificationUnlock({kind: 'identity_title', reward_key: identityTitle})
        .catch(() => {});
    }
  }, [identityTitle]);
  const domainRivalry = computeDomainRivalry(weekSteps);
  const mysteryUnlock = computeMysteryUnlock(weeklyDone, !!weeklyReview);
  useEffect(() => {
    if (weeklyDone > 0 && weeklyDone % 3 === 0) {
      const {start} = currentWeekRange();
      const rewardKey = weeklyDone >= 9 ? 'weeklyPattern' : weeklyDone >= 6 ? 'domainTip' : 'newInsight';
      lifeCoachApi
        .saveGamificationUnlock({kind: 'mystery_unlock', reward_key: rewardKey, week_start: start})
        .catch(() => {});
    }
  }, [weeklyDone]);
  const streakHealth = deriveStreakHealth(
    ritualStreak,
    todaySteps.filter((s) => s.status === 'pending').length,
    loadUserPreferences().sleep_time,
    false,
    new Date(),
    latestRitualEnergy
  );
  const behaviorScore = computeWeeklyBehaviorScore(weekSteps);
  const weeklyTarget = Math.max(3, Math.min(weekSteps.length, Math.ceil(weekSteps.length * WEEKLY_TARGET_RATIO)));
  const weeklyComplete = weeklyDone >= weeklyTarget;
  const lifeContextMode = resolveLifeContextMode(prefs.life_context_statuses);
  const pendingCount = todaySteps.filter((s) => s.status === 'pending').length;
  const atRisk = detectEarlyWarning({
    weekSteps,
    today: todayYMD(),
    pendingToday: pendingCount,
    ritualSessions,
  });
  const allDoneToday = todaySteps.length > 0 && todaySteps.every((s) => s.status !== 'pending');
  const dayPhase = getPersonalDayPhase(prefs.wake_time, prefs.sleep_time);
  const endOfDayClosure = buildEndOfDayClosure(todaySteps);
  const showClosure = endOfDayClosure && (allDoneToday || dayPhase === 'evening' || dayPhase === 'night');

  async function handleGenerateSteps() {
    setNotice(null);
    if (!hasAnyGoal) {
      setNotice(t('lifeCoach.noGoalsForSteps'));
      return;
    }
    setGenerating(true);
    try {
      const {wake_time, sleep_time, coaching_style, physical_considerations, preferred_action_window} =
        loadUserPreferences();
      const force = todaySteps.length > 0;
      await lifeCoachApi.generateDailySteps({
        locale,
        wake_time,
        sleep_time,
        coaching_style,
        physical_considerations,
        preferred_action_window,
        force,
      });
      await refresh();
      toast.success(t('lifeCoach.stepsGenerated'));
      if (scrollTimeoutRef.current) {
        window.clearTimeout(scrollTimeoutRef.current);
      }
      scrollTimeoutRef.current = window.setTimeout(() => {
        document.getElementById('today-plan')?.scrollIntoView({behavior: 'smooth', block: 'start'});
        scrollTimeoutRef.current = null;
      }, 50);
    } catch {
      toast.error(t('feedback.failed'));
    } finally {
      setGenerating(false);
    }
  }

  async function handleQuickAction() {
    if (pendingStep) {
      try {
        await lifeCoachApi.updateDailyStepStatus(pendingStep.id, {status: 'completed'});
        await refresh();
        toast.success(t('feedback.completed'));
      } catch {
        toast.error(t('feedback.failed'));
      }
      return;
    }
    await handleGenerateSteps();
  }

  return (
  <div className="pb-24 sm:pb-0">
    <>
      <ContinueProcessBanner includeOnboarding />

      <section className="panel-surface-strong mt-6 overflow-hidden px-6 py-8 sm:px-8 sm:py-10">
        <p className="eyebrow">{t('lifeCoach.homeEyebrow')}</p>
        <h1 className="mt-4 text-[clamp(2.4rem,6vw,4.2rem)] font-black leading-[1.06] txt-strong">
          {t('lifeCoach.homeTitle')}
        </h1>
        <p className="mt-4 max-w-3xl text-lg leading-8 text-[var(--muted)]">{t('lifeCoach.homeBody')}</p>
      </section>

      <LoadingErrorPanel
        loading={loading}
        error={loadError}
        onRetry={() => void refresh()}
        className="panel-surface mt-6 p-6 sm:p-8"
      />

      {!loading && !loadError && (
        <>
          <LifeCoachHomeSection
            id="setup"
            titleKey="lifeCoach.setupSectionTitle"
            bodyKey="lifeCoach.setupSectionBody"
          >
            {!hasAnyGoal && (
              <section className="panel-surface overflow-hidden p-6 sm:p-8">
                <p className="eyebrow">{t('lifeCoach.onboardingEyebrow')}</p>
                <h2 className="mt-4 text-2xl font-black txt-strong">{t('lifeCoach.onboardingTitle')}</h2>
                <p className="mt-3 max-w-2xl text-base leading-7 text-[var(--muted)]">{t('lifeCoach.onboardingBody')}</p>
                <ol className="mt-6 grid gap-4 sm:grid-cols-3">
                  {[1, 2, 3].map((n) => (
                    <li key={n} className="rounded-2xl border border-[color:var(--color-border)] fill-1 p-4">
                      <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-[var(--blue)]/15 text-sm font-black text-[var(--blue)]">
                        {n}
                      </span>
                      <p className="mt-3 text-sm font-bold txt-strong">{t(`lifeCoach.onboardingStep${n}Title`)}</p>
                      <p className="mt-1 text-sm leading-6 text-[var(--muted)]">{t(`lifeCoach.onboardingStep${n}Body`)}</p>
                    </li>
                  ))}
                </ol>
                <a href="#domains" className="focus-ring btn-primary mt-6 inline-flex">
                  {t('lifeCoach.onboardingCta')}
                </a>
              </section>
            )}

            <div className="mt-6 grid gap-4">
              <FeatureUnlockBanner />
              <CoachHandoffCard />
            </div>

            <section id="domains" className="mt-6 scroll-mt-24">
              <DomainsSetupProgress configured={configuredCount} total={totalDomains} />
              <DomainScoreExplainer className="mt-4" />
              <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {domainCards.map((summary) => (
                  <LifeDomainCard key={summary.domain} summary={summary} />
                ))}
              </div>
            </section>

            <div className="mt-6">
              <CrossDomainBlockerCard domainStates={domainStates} />
            </div>
          </LifeCoachHomeSection>

          <LifeCoachHomeSection
            id="daily"
            titleKey="lifeCoach.dailySectionTitle"
            bodyKey="lifeCoach.dailySectionBody"
          >
            <div className="flex flex-wrap gap-4">
              <div className="flex flex-col items-start gap-2">
                <BusyButton
                  className="focus-ring btn-primary"
                  type="button"
                  busy={generating}
                  busyLabel={t('lifeCoach.generating')}
                  onClick={() => void handleGenerateSteps()}
                >
                  {generateLabel}
                </BusyButton>
                <AiActionHelpMicrocopy kind="dailySteps" />
              </div>
              <div className="flex flex-col items-start gap-2">
                <button
                  className="focus-ring btn-ghost"
                  type="button"
                  onClick={async () => {
                    try {
                      markFeatureSeen('weekly_review');
                      await lifeCoachApi.generateWeeklyReview({locale});
                      await refresh();
                    } catch {
                      /* network error — silent */
                    }
                  }}
                >
                  {t('lifeCoach.generateWeeklyReview')}
                </button>
                <AiActionHelpMicrocopy kind="weeklyReview" />
              </div>
            </div>
            {notice && (
              <div className="mt-4 flex flex-wrap items-center gap-3 rounded-2xl border border-amber-400/25 bg-amber-400/8 px-4 py-3" role="alert">
                <p className="text-sm font-semibold text-amber-200/90">{notice}</p>
                <a href="#domains" className="focus-ring btn-small ms-auto">
                  {t('lifeCoach.noGoalsForStepsCta')}
                </a>
              </div>
            )}
            {todaySteps.length > 0 && <RegenerateStepsHint className="mt-3" />}
            {generating && (
              <div className="mt-4">
                <AiGeneratingProgress variant="dailySteps" />
              </div>
            )}
            {todaySteps.length === 0 && (
              <div className="mt-6">
                <CuratedDailyTaskPicker onCreated={refresh} />
                {hasAnyGoal && (
                  <div className="mt-4 flex flex-col items-start gap-2">
                    <BusyButton
                      type="button"
                      className="focus-ring btn-ghost"
                      busy={generating}
                      busyLabel={t('lifeCoach.generating')}
                      onClick={() => void handleGenerateSteps()}
                    >
                      {t('lifeCoach.noDailyStepsCta')}
                    </BusyButton>
                    <p className="text-xs leading-5 txt-muted">{t('lifeCoach.noDailyStepsAiSecondary')}</p>
                  </div>
                )}
              </div>
            )}

          <section className="mt-6 grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
            <section id="today-plan" className="panel-surface scroll-mt-24 p-6 sm:p-8" aria-label={t('lifeCoach.todayPlan')}>
              <FeatureHint feature="weekly_review" className="mb-4" />
              <p className="eyebrow">{t('lifeCoach.dailyBabySteps')}</p>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <h2 className="text-2xl font-black txt-strong">{t('lifeCoach.todayPlan')}</h2>
                <EnergyAdaptedBadge domainStates={domainStates} />
              </div>
              {todaySteps.length > 0 && (
                <div className="mt-4">
                  <StepFilterChips
                    value={stepFilter}
                    onChange={setStepFilter}
                    counts={stepFilterCounts}
                  />
                </div>
              )}
              <div className="mt-6 space-y-4">
                {todaySteps.filter((s) => s.status === 'pending').length > 0 && (
                  <SurvivalModeBanner
                    pendingSteps={todaySteps.filter((s) => s.status === 'pending')}
                    lifeContexts={loadUserPreferences().life_context_statuses}
                    emphasize={
                      shouldHighlightSurvivalMode(
                        ritualSessions.map((session) => ({
                          energy:
                            session.energyScore ??
                            (session.moodBefore ? Number(session.moodBefore) : 6),
                          primaryTag: session.primaryTag ?? null,
                        }))
                      ) ||
                      shouldEmphasizeSurvivalMode(loadAdaptation)
                    }
                    softCopy={isSoftSurvivalMode(loadAdaptation)}
                    doneMessages={
                      comebackMessaging
                        ? {
                            easy: comebackMessaging.survival_done_easy,
                            skip: comebackMessaging.survival_done_skip,
                            pause: comebackMessaging.survival_done_pause,
                          }
                        : undefined
                    }
                    onEasyStep={async (stepId) => {
                      const pending = todaySteps.filter((s) => s.status === 'pending');
                      await Promise.all(
                        pending
                          .filter((s) => s.id !== stepId)
                          .map((s) =>
                            lifeCoachApi.updateDailyStepStatus(s.id, {
                              status: 'skipped',
                              blocker_reason: 'low_energy',
                            })
                          )
                      );
                      await refresh();
                    }}
                    onSkipAll={async (blocker) => {
                      const pending = todaySteps.filter((s) => s.status === 'pending');
                      await Promise.all(
                        pending.map((s) =>
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
                      await refresh();
                    }}
                    onPauseDay={async () => {
                      const pending = todaySteps.filter((s) => s.status === 'pending');
                      await Promise.all(
                        pending.map((s) =>
                          lifeCoachApi.updateDailyStepStatus(s.id, {
                            status: 'skipped',
                            blocker_reason: 'low_energy',
                          })
                        )
                      );
                      await refresh();
                    }}
                  />
                )}
                {filteredSteps.length === 0 && todaySteps.length > 0 ? (
                  <p className="text-sm leading-7 text-[var(--muted)]">{t('lifeCoach.stepFilters.empty')}</p>
                ) : (
                <DailyBabyStepsList
                  steps={filteredSteps}
                  goals={goals}
                  energy={latestEnergy}
                  weekSteps={weekSteps}
                  identityTitle={identityTitle}
                  hasGoals={hasAnyGoal}
                  goalSetupHref="#domains"
                  hideEmptyState={todaySteps.length === 0}
                  emptyAction={{
                    label: t('lifeCoach.noDailyStepsCta'),
                    onClick: () => void handleGenerateSteps(),
                    loading: generating,
                    loadingLabel: t('lifeCoach.generating'),
                  }}
                  onUpdateStatus={async (id, status, detail) => {
                    await lifeCoachApi.updateDailyStepStatus(id, {
                      status,
                      ...detail,
                    });
                    if (detail?.reflection_text || detail?.blocker_reason) {
                      const date = todayYMD();
                      await lifeCoachApi.saveReflection({
                        date,
                        mood_score: null,
                        energy_score: null,
                        reflection_text: detail?.reflection_text || '',
                        blocker_reason: detail?.blocker_reason ?? null,
                      });
                      await lifeCoachApi.analyzeReflection({
                        locale,
                        date,
                        reflection_text: detail?.reflection_text || '',
                        blocker_reason: detail?.blocker_reason ?? null,
                      });
                    }
                  }}
                  onRefresh={refresh}
                />
                )}
              </div>
            </section>

            <div className="grid gap-6">
              <WeeklyReviewCard insight={weeklyReview} recentSteps={weekSteps} />
              <section className="panel-surface p-6" aria-label={t('lifeCoach.aiInsights')}>
                <p className="eyebrow">{t('lifeCoach.aiInsights')}</p>
                <h2 className="mt-4 text-2xl font-black txt-strong">{t('lifeCoach.patternsAndAdjustments')}</h2>
                <AiInsightsVsWeeklyReviewExplainer className="mt-4" />
                <div className="mt-6 grid gap-4" aria-live="polite">
                  {insights.length === 0 ? (
                    <div className="flex flex-col gap-4">
                      <p className="text-sm leading-7 text-[var(--muted)]">{t('lifeCoach.insightsEmptyDomain')}</p>
                      <HomeInsightGenerateButton locale={locale} onGenerated={refresh} />
                    </div>
                  ) : (
                    insights.map((insight) => <AIInsightCard key={insight.id} insight={insight} />)
                  )}
                </div>
              </section>
            </div>
          </section>
          </LifeCoachHomeSection>

          {/* Zone D — gamification, behavior stats, social share */}
          <div className="mt-8 grid gap-4">
            <HomeGamificationStrip
              streakHealth={streakHealth}
              streak={ritualStreak}
              comebackChain={comebackChain}
              identityTitle={identityTitle}
              domainRivalry={domainRivalry}
              mysteryUnlock={mysteryUnlock}
            />
            <div className="grid gap-3 sm:grid-cols-2">
              <BehaviorScoreChip score={behaviorScore} />
              {lifeContextMode.active && <LifeContextModeBanner mode={lifeContextMode} />}
            </div>
            {atRisk && pendingCount > 0 && pendingStep && (
              <EarlyWarningBanner
                onTwoMinuteStep={async () => {
                  try {
                    const planB = buildSimplifiedStep(pendingStep, locale);
                    await lifeCoachApi.updateDailyStepContent(pendingStep.id, planB);
                    await refresh();
                    document.getElementById('today-plan')?.scrollIntoView({behavior: 'smooth', block: 'start'});
                  } catch {
                    toast.error(t('feedback.failed'));
                  }
                }}
              />
            )}
            {showClosure && endOfDayClosure && <EndOfDayClosureCard closure={endOfDayClosure} />}
            {weeklyComplete && (
              <SocialAccountabilityActions
                busy={sharingWeekly}
                onShare={async () => {
                  setSharingWeekly(true);
                  try {
                    const text = buildWeeklyShareText({
                      completed: weeklyDone,
                      showUpDays: behaviorScore.showUps,
                      minutes: weekSteps
                        .filter((s) => s.status === 'completed')
                        .reduce((sum, s) => sum + (s.actual_minutes ?? s.estimated_minutes), 0),
                      locale,
                    });
                    const result = await shareOrCopyWeeklyUpdate(text);
                    if (result === 'copied') toast.success(t('behaviorScience.social.copied'));
                    else if (result === 'shared') toast.success(t('behaviorScience.social.shared'));
                    else toast.error(t('feedback.failed'));
                  } finally {
                    setSharingWeekly(false);
                  }
                }}
              />
            )}
          </div>
        </>
      )}

      {!loading && !loadError && (
        <>
          <NextActionBar
            className="mt-6 hidden sm:block"
            label={nextActionLabel}
            onClick={() => void handleQuickAction()}
          />
          <MobileQuickAction
            label={pendingStep ? t('lifeCoach.markCompleted') : generateLabel}
            onClick={() => void handleQuickAction()}
            loading={generating}
            loadingLabel={t('lifeCoach.generating')}
          />
        </>
      )}
    </>
  </div>
  );
}

function DomainsSetupProgress({configured, total}: {configured: number; total: number}) {
  const t = useTranslations();
  const progressPercent = total > 0 ? Math.round((configured / total) * 100) : 0;
  const barColor = progressPercent >= 75 ? '#10b981' : progressPercent >= 37 ? '#3b82f6' : '#f59e0b';

  const hintKey =
    configured >= total
      ? 'lifeCoach.domainsSetupProgressHintComplete'
      : configured === 0
        ? 'lifeCoach.domainsSetupProgressHintStart'
        : configured === 1
          ? 'lifeCoach.domainsSetupProgressHintOne'
          : 'lifeCoach.domainsSetupProgressHintPartial';

  return (
    <article className="panel-surface p-5 sm:p-6" aria-label={t('lifeCoach.domainsSetupProgressEyebrow')}>
      <p className="field-label mb-0 txt-muted">{t('lifeCoach.domainsSetupProgressEyebrow')}</p>
      <p className="mt-2 text-lg font-black leading-snug txt-strong sm:text-xl">
        {t('lifeCoach.domainsSetupProgressHeadline', {configured, total})}
      </p>
      <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t(hintKey)}</p>
      <div className="mt-4 flex items-center gap-3">
        <div className="h-2.5 min-w-0 flex-1 overflow-hidden rounded-full fill-3">
          <div
            className="h-full rounded-full transition-[width] duration-700"
            style={{width: `${progressPercent}%`, backgroundColor: barColor}}
          />
        </div>
        <span className="shrink-0 text-sm font-bold tabular-nums txt-soft">
          {t('lifeCoach.domainsSetupProgressFraction', {configured, total})}
        </span>
      </div>
    </article>
  );
}

function LifeCoachHomeSection({
  id,
  titleKey,
  bodyKey,
  children,
}: {
  id: string;
  titleKey: string;
  bodyKey: string;
  children: ReactNode;
}) {
  const t = useTranslations();

  return (
    <section id={id} className="mt-8 scroll-mt-24" aria-labelledby={`${id}-heading`}>
      <header className="mb-6 border-b border-[color:var(--color-border)] pb-5">
        <h2 id={`${id}-heading`} className="text-xl font-black txt-strong sm:text-2xl">
          {t(titleKey)}
        </h2>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">{t(bodyKey)}</p>
      </header>
      {children}
    </section>
  );
}

function HomeInsightGenerateButton({locale, onGenerated}: {locale: AppLocale; onGenerated: () => Promise<void>}) {
  const t = useTranslations();
  const [busy, setBusy] = useState(false);

  return (
    <div className="flex flex-col items-start gap-2">
      <button
        type="button"
        className="focus-ring btn-small self-start"
        disabled={busy}
        aria-busy={busy}
        onClick={async () => {
          setBusy(true);
          try {
            const date = todayYMD();
            await lifeCoachApi.analyzeReflection({locale, date, reflection_text: '', blocker_reason: null});
            await onGenerated();
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? t('lifeCoach.generatingInsight') : t('lifeCoach.generateInitialInsight')}
      </button>
      <AiActionHelpMicrocopy kind="insight" />
    </div>
  );
}

function EnergyAdaptedBadge({domainStates}: {domainStates: LifeDomainState[]}) {
  const t = useTranslations();
  // Derive average score across configured domains as proxy for energy level
  const scores = domainStates
    .map((s) => s.current_score)
    .filter((v): v is number => typeof v === 'number' && v > 0);

  if (scores.length === 0) return null;
  const avg = scores.reduce((a, b) => a + b, 0) / scores.length;

  if (avg > 4) return null; // Only show badge when overall scores are low

  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-amber-500/25 bg-amber-500/10 px-3 py-1 text-xs font-semibold text-amber-400">
      {t('lifeCoach.energyAdapted')}
    </span>
  );
}

function CrossDomainBlockerCard({domainStates}: {domainStates: LifeDomainState[]}) {
  const t = useTranslations();

  // Find blockers that appear in 2+ domains
  const blockerMap = new Map<string, string[]>();
  for (const state of domainStates) {
    for (const blocker of (state.main_blockers ?? [])) {
      if (!blocker) continue;
      const existing = blockerMap.get(blocker) ?? [];
      existing.push(state.domain);
      blockerMap.set(blocker, existing);
    }
  }

  const sharedBlockers = [...blockerMap.entries()]
    .filter(([, domains]) => domains.length >= 2)
    .slice(0, 2);

  if (sharedBlockers.length === 0) return null;

  return (
    <article className="panel-surface p-5" aria-label={t('lifeCoach.crossDomainTitle')}>
      <p className="field-label mb-0 text-amber-400" aria-hidden="true">{t('lifeCoach.crossDomainTitle')}</p>
      <div className="mt-4 grid gap-3">
        {sharedBlockers.map(([blocker, domains]) => (
          <div key={blocker} className="rounded-2xl border border-amber-500/15 bg-amber-500/5 p-4">
            <p className="text-sm font-semibold txt-strong">
              {t('lifeCoach.crossDomainBlocker', {blocker, count: String(domains.length)})}
            </p>
            <p className="mt-1 text-xs leading-5 txt-muted">
              {t('lifeCoach.crossDomainSuggestion')}
            </p>
          </div>
        ))}
      </div>
    </article>
  );
}
