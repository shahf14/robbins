import type {AppLocale} from '@/i18n/config';
import {openaiLifeCoachService} from '@/lib/ai-life-coach/openai-life-coach-service';
import {resolveDailyStepFromPlan} from '@/lib/ai-life-coach/resolve-daily-step';
import {
  enforceEasyOnlySteps,
  resolveAdaptiveTaskCount,
} from '@/lib/life-coach/adaptive-task-count';
import {
  applyPersonalDifficultyCalibration,
  computePersonalDifficultyCalibration,
  type PersonalDifficultyCalibration,
} from '@/lib/life-coach/personal-difficulty-calibration';
import {
  applyWeeklyPlanAdjustmentsToCalibration,
  applyWeeklyPlanAdjustmentsToSteps,
  applyWeeklyPlanAdjustmentsToTaskCount,
} from '@/lib/life-coach/apply-weekly-plan-adjustments';
import {
  applyFailedActionPatternsToCalibration,
  enforceFailedActionPatternsOnSteps,
} from '@/lib/behavior-profile/failed-action-patterns';
import {
  applySkipWindowsToCalibration,
  resolveSchedulingActionWindow,
} from '@/lib/behavior-profile/skip-windows';
import {refreshUserBehaviorProfile} from '@/lib/behavior-profile/repository';
import {getUserGenerationContext, getUserParticipantProfile, getLatestCompletedFormulation, getLatestWeeklyReview, insertDailyBabySteps, markWeeklyPlanAdjustmentsApplied} from '@/lib/life-coach/repository';
import {buildPersonalizedChallenge} from '@/lib/formulation/personalized-challenge';
import {
  anchorStepsToTriggers,
  buildHabitTriggerContext,
} from '@/lib/formulation/habit-trigger-routing';
import {applyBarrierPlanBToSteps, buildBarrierPlanBStrategy} from '@/lib/formulation/plan-b-routing';
import {
  buildEmotionalStageRouting,
  coachEasyOnlyForEmotionalStage,
  type EmotionalStageRouting,
} from '@/lib/formulation/emotional-stage-routing';
import {computeDomainRivalry} from '@/lib/gamification/domain-rivalry';
import {
  applyLoadAdaptationToCalibration,
  applyLoadAdaptationToSteps,
  applyLoadAdaptationToTaskCount,
  buildLoadAdaptationContext,
  shouldHidePersonalizedChallenge,
} from '@/lib/formulation/load-adaptation-routing';
import {buildAccountabilityContext} from '@/lib/formulation/accountability-routing';
import {
  buildRealLifeAlignmentContext,
} from '@/lib/formulation/real-life-alignment-routing';
import {
  buildFirstWinStep,
  isFirstWinStep,
  prependFirstWinToSteps,
} from '@/lib/formulation/first-win-routing';
import {
  avoidSkippedPatternOnSteps,
  buildSkipAdaptationContext,
  skipAdaptationForPrompt,
} from '@/lib/formulation/skip-adaptation-routing';
import {getActiveWeeklyPlanAdjustments} from '@/lib/life-coach/weekly-pattern-mining';
import {extractWeeklyReviewContext} from '@/lib/life-coach/weekly-review-context';
import {
  applyReflectionAdjustmentsToCalibration,
  applyReflectionAdjustmentsToSteps,
  applyReflectionAdjustmentsToTaskCount,
  getActiveReflectionPlanAdjustments,
  markReflectionAdjustmentApplied,
} from '@/lib/reflection-analysis';
import {
  applySkipCoachToCalibration,
  applySkipCoachToSteps,
  applySkipCoachToTaskCount,
  resolveSkipCoachTimeWindow,
} from '@/lib/skip-coach-loop';
import {
  getActiveSkipCoachAdjustment,
  markSkipCoachAdjustmentApplied,
} from '@/lib/skip-coach-loop/repository';
import {
  attachWeeklyFocusToSteps,
  ensureWeeklyFocusesForGoals,
  pickWeeklyThemeForDate,
  weeklyThemesByGoalId,
} from '@/lib/goal-decomposition-tree';
import {
  buildStepReasoningContext,
  finalizeStepsReasoning,
} from '@/lib/life-coach/step-reasoning';
import {
  applyRitualToAdaptiveTaskCount,
  applyRitualToCalibration,
  enforceRitualOnSteps,
  resolveLatestRitualAdaptation,
  type RitualAdaptationContext,
} from '@/lib/morning-ritual-adaptation';
import {
  applyEveningBriefingToAdaptiveTaskCount,
  applyEveningBriefingToCalibration,
  enforceEveningBriefingOnSteps,
  resolveEveningBriefingForDate,
  type EveningBriefingForTomorrow,
} from '@/lib/evening-reset/for-daily-steps';
import {resolveDailyFocusContext} from '@/lib/daily-focus-context';
import {applyStepValueFeedbackToCalibration} from '@/lib/step-value-feedback/apply-calibration';
import {
  applyOverplanningToAdaptiveTaskCount,
  applyOverplanningToCalibration,
  detectOverplanning,
  type OverplanningContext,
} from '@/lib/life-coach/overplanning';
import type {WeeklyGoalFocus} from '@/lib/goal-decomposition-tree/types';
import type {Goal, FormulationSession, StructuredDailyBabyStep} from '@/lib/life-coach/types';
import type {PhysicalConsideration, PreferredActionWindow} from '@/lib/user-preferences';
import {
  buildStepValidationProfile,
  qualifyGeneratedStepsBeforeSave,
} from '@/lib/life-coach/validate-generated-step';
import {mergeToneWithPersonalization} from '@/lib/ai-personalization-summary';
import {
  resolveDynamicCoachTone,
  saveToneEffectiveness,
  tonePersonalizationForPrompt,
} from '@/lib/coach-tone';
import type {ToneEffectiveness} from '@/lib/coach-tone/types';
import type {CoachingStyle} from '@/lib/user-preferences';

function finalizeSteps(
  steps: StructuredDailyBabyStep[],
  adaptive: ReturnType<typeof resolveAdaptiveTaskCount>,
  calibration: PersonalDifficultyCalibration,
  latestRitual: RitualAdaptationContext | null,
  eveningBriefing: EveningBriefingForTomorrow | null
): StructuredDailyBabyStep[] {
  const capped = steps.slice(0, adaptive.max_steps);
  const easyAdjusted = adaptive.easy_only ? enforceEasyOnlySteps(capped) : capped;
  const calibrated = applyPersonalDifficultyCalibration(easyAdjusted, calibration);
  const ritualAdjusted = enforceRitualOnSteps(calibrated, latestRitual);
  return enforceEveningBriefingOnSteps(ritualAdjusted, eveningBriefing);
}

type AiGenerationParams = {
  locale: AppLocale;
  date: string;
  goalsForAi: Goal[];
  context: Awaited<ReturnType<typeof getUserGenerationContext>>;
  profile: Awaited<ReturnType<typeof getUserParticipantProfile>>;
  wakeTime: string;
  sleepTime: string;
  coachingStyle: string;
  physicalConsiderations: PhysicalConsideration[];
  effectiveWindow: PreferredActionWindow;
  adaptiveTaskCount: ReturnType<typeof resolveAdaptiveTaskCount>;
  difficultyCalibration: PersonalDifficultyCalibration;
  coachTone: CoachingStyle;
  preferredTone: string;
  avoidTone: string;
  toneEffectiveness: ToneEffectiveness;
  weeklyFocusByGoalId: Record<string, WeeklyGoalFocus>;
  latestRitual: RitualAdaptationContext | null;
  morningMission: {
    mission: string;
    identity: string | null;
    time_block: string | null;
    suggested_domain: import('@/lib/life-coach/types').LifeDomain | null;
  } | null;
  eveningBriefing: EveningBriefingForTomorrow | null;
  overplanning: OverplanningContext | null;
  personalizedChallenge: import('@/lib/formulation/personalized-challenge').PersonalizedChallenge | null;
  habitTrigger: import('@/lib/formulation/habit-trigger-routing').HabitTriggerContext | null;
  planBStrategy: import('@/lib/formulation/plan-b-routing').BarrierPlanBStrategy | null;
  loadAdaptation: import('@/lib/formulation/load-adaptation-routing').LoadAdaptationContext | null;
  accountability: import('@/lib/formulation/accountability-routing').AccountabilityContext | null;
  realLifeAlignment: import('@/lib/formulation/real-life-alignment-routing').RealLifeAlignmentContext | null;
  skipAdaptation: import('@/lib/formulation/skip-adaptation-routing').SkipAdaptationContext | null;
  skipCoachAdjustment: import('@/lib/skip-coach-loop').SkipCoachAdjustment | null;
  emotionalRouting: EmotionalStageRouting | null;
  domainRivalry: import('@/lib/gamification/domain-rivalry').DomainRivalrySnapshot | null;
  weeklyReviewContext: import('@/lib/life-coach/weekly-review-context').WeeklyReviewContext | null;
};

async function generateAiStepsBatch(params: AiGenerationParams): Promise<StructuredDailyBabyStep[]> {
  const mergedTone = mergeToneWithPersonalization(
    {preferred_tone: params.preferredTone, avoid_tone: params.avoidTone},
    params.profile.ai_personalization_summary
  );
  const generated = await openaiLifeCoachService.generateDailySteps({
    locale: params.locale,
    date: params.date,
    domainStates: params.context.domainStates,
    activeGoals: params.goalsForAi,
    recentSteps: params.context.dailySteps,
    recentReflections: params.context.reflections,
    milestonesByGoalId: params.context.milestonesByGoalId,
    weeklyFocusByGoalId: params.weeklyFocusByGoalId,
    wake_time: params.wakeTime,
    sleep_time: params.sleepTime,
    coaching_style: params.coachTone,
    preferred_tone: mergedTone.preferred_tone,
    avoid_tone: mergedTone.avoid_tone,
    tone_personalization: tonePersonalizationForPrompt({
      base_style: params.toneEffectiveness.base_style,
      effective_style: params.coachTone,
      preferred_tone: params.preferredTone,
      avoid_tone: params.avoidTone,
      tone_effectiveness: params.toneEffectiveness,
    }),
    life_context_statuses: params.profile.life_context_statuses,
    life_context_note: params.profile.life_context_note,
    physical_considerations: params.physicalConsiderations,
    preferred_action_window: params.effectiveWindow,
    age: params.profile.age,
    gender: params.profile.gender,
    user_behavior_profile: params.context.behaviorProfile,
    recurring_blocker_patterns: params.context.recurringBlockers,
    execution_history: params.context.executionHistory,
    short_term_context: params.context.shortTermContext,
    long_term_profile: params.context.longTermProfile,
    max_steps: params.adaptiveTaskCount.max_steps,
    easy_only: params.adaptiveTaskCount.easy_only,
    task_count_reason: params.adaptiveTaskCount.reason,
    difficulty_calibration: params.difficultyCalibration,
    latest_morning_ritual: params.latestRitual,
    morning_mission: params.morningMission,
    evening_briefing: params.eveningBriefing,
    ai_personalization_summary: params.profile.ai_personalization_summary ?? null,
    overplanning: params.overplanning,
    personalized_challenge: params.personalizedChallenge,
    habit_trigger: params.habitTrigger,
    plan_b_strategy: params.planBStrategy,
    emotional_routing: params.emotionalRouting,
    domain_rivalry: params.domainRivalry,
    weekly_review_context: params.weeklyReviewContext,
    load_adaptation: params.loadAdaptation,
    accountability: params.accountability,
    real_life_alignment: params.realLifeAlignment,
    skip_adaptation: skipAdaptationForPrompt(
      params.skipAdaptation,
      params.skipCoachAdjustment
    ),
  });
  return attachWeeklyFocusToSteps(
    generated.steps,
    params.weeklyFocusByGoalId,
    params.date,
    pickWeeklyThemeForDate
  );
}

async function qualifyAndInsertSteps(
  userId: string,
  date: string,
  locale: AppLocale,
  steps: StructuredDailyBabyStep[],
  planStepKeys: Set<string>,
  params: AiGenerationParams,
  coachTone: CoachingStyle
) {
  const validationProfile = buildStepValidationProfile({
    locale,
    goals: params.context.goals.map((g) => ({
      id: g.id,
      domain: g.domain,
      title: g.title,
      description: g.description,
    })),
    domainStates: params.context.domainStates.map((d) => ({
      domain: d.domain,
      available_time_per_day: d.available_time_per_day,
      main_blockers: d.main_blockers,
    })),
    calibration: params.difficultyCalibration,
    recurringBlockers: params.context.recurringBlockers,
    recentReflections: params.context.reflections.map((r) => ({
      blocker_reason: r.blocker_reason,
      date: r.date,
    })),
    worstBlocker: params.context.executionHistory.worst_blocker,
    real_life_alignment: params.realLifeAlignment,
  });

  const planSteps = steps.filter((s) => planStepKeys.has(stepKey(s)));
  const aiSteps = steps.filter((s) => !planStepKeys.has(stepKey(s)));

  const {steps: qualified, metrics} = await qualifyGeneratedStepsBeforeSave(
    steps,
    validationProfile,
    {
      isRegenerateCandidate: (step) =>
        !planStepKeys.has(stepKey(step)) && !isFirstWinStep(step),
      regenerate: async () => {
        const regeneratedAi = await generateAiStepsBatch({
          ...params,
          goalsForAi: params.context.goals,
        });
        return finalizeSteps(
          [...planSteps, ...regeneratedAi],
          params.adaptiveTaskCount,
          params.difficultyCalibration,
          params.latestRitual,
          params.eveningBriefing
        );
      },
    }
  );

  if (metrics.fallback_repaired > 0 || metrics.regenerated || metrics.value_gate_failed > 0) {
    console.info('[step-validation]', {
      userId,
      date,
      ...metrics,
      ai_steps: aiSteps.length,
    });
  }

  return insertDailyBabySteps(userId, date, qualified, locale, coachTone);
}

function stepKey(step: StructuredDailyBabyStep): string {
  return `${step.goal_id ?? 'none'}::${step.domain}::${step.title}`;
}

function injectFirstWinStep(
  steps: StructuredDailyBabyStep[],
  formulation: FormulationSession | null,
  locale: AppLocale,
  loadAdaptation: import('@/lib/formulation/load-adaptation-routing').LoadAdaptationContext | null,
  planBStrategy: import('@/lib/formulation/plan-b-routing').BarrierPlanBStrategy | null,
  maxSteps: number,
  includeFirstWin: boolean
): StructuredDailyBabyStep[] {
  if (!includeFirstWin || !formulation) return steps;
  const firstWin = buildFirstWinStep(formulation, locale, loadAdaptation, planBStrategy);
  if (!firstWin) return steps;
  return prependFirstWinToSteps(steps, firstWin, maxSteps);
}

export async function generateDailyStepsForUser(
  userId: string,
  date: string,
  locale: AppLocale,
  wakeTime = '07:00',
  coachingStyle = 'supportive',
  physicalConsiderations: PhysicalConsideration[] = [],
  preferredActionWindow: PreferredActionWindow = 'flexible',
  sleepTime = '22:30',
  includeFirstWin = false
) {
  refreshUserBehaviorProfile(userId, preferredActionWindow);
  const [context, profile, latestWeeklyReview, formulation] = await Promise.all([
    getUserGenerationContext(userId),
    getUserParticipantProfile(userId),
    getLatestWeeklyReview(userId),
    getLatestCompletedFormulation(userId).catch(() => null),
  ]);
  const loadAdaptation = formulation ? buildLoadAdaptationContext(formulation, locale) : null;
  const personalizedChallenge =
    formulation && !shouldHidePersonalizedChallenge(loadAdaptation)
      ? buildPersonalizedChallenge(formulation, locale)
      : null;
  const habitTrigger = formulation
    ? buildHabitTriggerContext(formulation, locale, {
        wake_time: wakeTime,
        sleep_time: sleepTime,
        preferred_action_window: preferredActionWindow,
      })
    : null;
  const planBStrategy = formulation ? buildBarrierPlanBStrategy(formulation, locale) : null;
  const emotionalRouting = formulation ? buildEmotionalStageRouting(formulation, locale) : null;
  const weekStartDate = new Date();
  weekStartDate.setDate(weekStartDate.getDate() - 6);
  const weekStartStr = weekStartDate.toISOString().slice(0, 10);
  const weekStepsForRivalry = context.dailySteps.filter(
    (s) => s.scheduled_date >= weekStartStr
  );
  const domainRivalry = computeDomainRivalry(weekStepsForRivalry);
  const accountability = formulation ? buildAccountabilityContext(formulation, locale) : null;
  const realLifeAlignment = formulation
    ? buildRealLifeAlignmentContext(formulation, locale)
    : null;
  const skipAdaptation = formulation
    ? buildSkipAdaptationContext(formulation, locale)
    : null;
  const latestRitual = resolveLatestRitualAdaptation(userId, date);
  const dailyFocus = await resolveDailyFocusContext(userId, date);
  const morningMission = dailyFocus.morningMission
    ? {
        mission: dailyFocus.morningMission,
        identity: dailyFocus.morningIdentity,
        time_block: dailyFocus.morningTimeBlock,
        suggested_domain: dailyFocus.suggestedAction?.domainId ?? dailyFocus.activeDomainId,
      }
    : null;
  const eveningBriefing = resolveEveningBriefingForDate(userId, date);
  const overplanning = detectOverplanning({
    userId,
    date,
    goals: context.goals,
    dailySteps: context.dailySteps,
  });
  const behaviorProfile = context.behaviorProfile;
  const recurringBlockers = context.recurringBlockers;
  const executionHistory = context.executionHistory;
  const shortTermContext = context.shortTermContext;
  const longTermProfile = context.longTermProfile;
  const adaptiveTaskCount = resolveAdaptiveTaskCount({
    behaviorProfile,
    executionHistory,
    shortTermContext,
    longTermProfile,
    recurringBlockers,
    latestRitual,
  });
  const weeklyPlanAdjustments = getActiveWeeklyPlanAdjustments(latestWeeklyReview);
  const weeklyReviewContext = extractWeeklyReviewContext(latestWeeklyReview);
  const reflectionPlanAdjustments = getActiveReflectionPlanAdjustments(userId, date);
  const skipCoachAdjustment = getActiveSkipCoachAdjustment(userId, date);
  const weeklyFocusByGoalId = ensureWeeklyFocusesForGoals(
    userId,
    context.goals,
    context.milestonesByGoalId,
    date,
    locale
  );

  let effectiveAdaptiveTaskCount = adaptiveTaskCount;
  if (weeklyPlanAdjustments) {
    effectiveAdaptiveTaskCount = applyWeeklyPlanAdjustmentsToTaskCount(
      effectiveAdaptiveTaskCount,
      weeklyPlanAdjustments,
      shortTermContext
    );
  }
  if (reflectionPlanAdjustments) {
    effectiveAdaptiveTaskCount = applyReflectionAdjustmentsToTaskCount(
      effectiveAdaptiveTaskCount,
      reflectionPlanAdjustments
    );
  }
  if (skipCoachAdjustment) {
    effectiveAdaptiveTaskCount = applySkipCoachToTaskCount(
      effectiveAdaptiveTaskCount,
      skipCoachAdjustment
    );
  }
  effectiveAdaptiveTaskCount = applyRitualToAdaptiveTaskCount(
    effectiveAdaptiveTaskCount,
    latestRitual
  );
  effectiveAdaptiveTaskCount = applyEveningBriefingToAdaptiveTaskCount(
    effectiveAdaptiveTaskCount,
    eveningBriefing
  );
  if (coachEasyOnlyForEmotionalStage(emotionalRouting)) {
    effectiveAdaptiveTaskCount = {
      ...effectiveAdaptiveTaskCount,
      easy_only: true,
      max_steps: Math.min(effectiveAdaptiveTaskCount.max_steps, 2),
    };
  }
  effectiveAdaptiveTaskCount = applyOverplanningToAdaptiveTaskCount(
    effectiveAdaptiveTaskCount,
    overplanning
  );
  effectiveAdaptiveTaskCount = applyLoadAdaptationToTaskCount(
    effectiveAdaptiveTaskCount,
    loadAdaptation
  );

  let difficultyCalibration = computePersonalDifficultyCalibration(userId);
  if (weeklyPlanAdjustments) {
    difficultyCalibration = applyWeeklyPlanAdjustmentsToCalibration(
      difficultyCalibration,
      weeklyPlanAdjustments
    );
  }
  if (reflectionPlanAdjustments) {
    difficultyCalibration = applyReflectionAdjustmentsToCalibration(
      difficultyCalibration,
      reflectionPlanAdjustments
    );
  }
  if (skipCoachAdjustment) {
    difficultyCalibration = applySkipCoachToCalibration(
      difficultyCalibration,
      skipCoachAdjustment
    );
  }
  difficultyCalibration = applyStepValueFeedbackToCalibration(
    difficultyCalibration,
    executionHistory.step_value_feedback
  );
  difficultyCalibration = applyRitualToCalibration(difficultyCalibration, latestRitual);
  difficultyCalibration = applyEveningBriefingToCalibration(
    difficultyCalibration,
    eveningBriefing
  );
  if (emotionalRouting?.coach.max_estimated_minutes) {
    difficultyCalibration = {
      ...difficultyCalibration,
      max_minutes: Math.min(
        difficultyCalibration.max_minutes,
        emotionalRouting.coach.max_estimated_minutes
      ),
      target_minutes: Math.min(
        difficultyCalibration.target_minutes,
        emotionalRouting.coach.max_estimated_minutes
      ),
    };
  }
  difficultyCalibration = applySkipWindowsToCalibration(
    difficultyCalibration,
    behaviorProfile
  );
  difficultyCalibration = applyFailedActionPatternsToCalibration(
    difficultyCalibration,
    behaviorProfile.failed_action_patterns
  );
  difficultyCalibration = applyLoadAdaptationToCalibration(
    difficultyCalibration,
    loadAdaptation
  );
  const baseCoachingStyle = (profile.coaching_style ?? coachingStyle) as CoachingStyle;
  const dynamicTone = resolveDynamicCoachTone(userId, baseCoachingStyle, locale);
  saveToneEffectiveness(userId, dynamicTone.tone_effectiveness);

  const baseWindow =
    behaviorProfile.sample_size_7d >= 5
      ? behaviorProfile.best_action_window
      : preferredActionWindow;
  const skipAwareWindow = resolveSchedulingActionWindow(behaviorProfile, baseWindow);
  const effectiveWindow = resolveSkipCoachTimeWindow(skipAwareWindow, skipCoachAdjustment);
  const planSteps: StructuredDailyBabyStep[] = [];
  const planStepKeys = new Set<string>();
  const goalsForAi = [...context.goals];
  const aiParams: AiGenerationParams = {
    locale,
    date,
    goalsForAi,
    context,
    profile,
    wakeTime,
    sleepTime,
    coachingStyle,
    physicalConsiderations,
    effectiveWindow,
    adaptiveTaskCount: effectiveAdaptiveTaskCount,
    difficultyCalibration,
    coachTone: dynamicTone.effective_style,
    preferredTone: dynamicTone.preferred_tone,
    avoidTone: dynamicTone.avoid_tone,
    toneEffectiveness: dynamicTone.tone_effectiveness,
    weeklyFocusByGoalId,
    latestRitual,
    morningMission,
    eveningBriefing,
    overplanning: overplanning.is_overplanned ? overplanning : null,
    personalizedChallenge,
    habitTrigger,
    planBStrategy,
    emotionalRouting,
    domainRivalry,
    weeklyReviewContext,
    loadAdaptation,
    accountability,
    realLifeAlignment,
    skipAdaptation,
    skipCoachAdjustment,
  };

  for (const goal of context.goals) {
    if (goal.domain !== 'health' || !goal.health_context?.execution_plan) {
      continue;
    }

    const milestones = context.milestonesByGoalId[goal.id] ?? [];
    const resolved = resolveDailyStepFromPlan({
      goal,
      milestones,
      scheduledDate: date,
      recentSteps: context.dailySteps,
      recentReflections: context.reflections,
      locale,
    });

    if (resolved) {
      const planStep = {...resolved, goal_id: goal.id};
      planSteps.push(planStep);
      planStepKeys.add(stepKey(planStep));
      const index = goalsForAi.findIndex((g) => g.id === goal.id);
      if (index >= 0) {
        goalsForAi.splice(index, 1);
      }
    }
  }

  let aiSteps: StructuredDailyBabyStep[] = [];

  if (goalsForAi.length > 0) {
    aiSteps = await generateAiStepsBatch({...aiParams, goalsForAi});
  }

  const steps = finalizeSteps(
    [...planSteps, ...aiSteps],
    effectiveAdaptiveTaskCount,
    difficultyCalibration,
    latestRitual,
    eveningBriefing
  );
  let adjustedSteps = steps;
  if (weeklyPlanAdjustments) {
    adjustedSteps = applyWeeklyPlanAdjustmentsToSteps(adjustedSteps, weeklyPlanAdjustments);
  }
  if (reflectionPlanAdjustments) {
    adjustedSteps = applyReflectionAdjustmentsToSteps(
      adjustedSteps,
      reflectionPlanAdjustments
    );
  }
  if (skipCoachAdjustment) {
    adjustedSteps = applySkipCoachToSteps(adjustedSteps, skipCoachAdjustment, locale);
    adjustedSteps = avoidSkippedPatternOnSteps(
      adjustedSteps,
      skipCoachAdjustment.adjustment.skipped_step_title
    );
  }
  adjustedSteps = attachWeeklyFocusToSteps(
    adjustedSteps,
    weeklyFocusByGoalId,
    date,
    pickWeeklyThemeForDate
  );
  adjustedSteps = anchorStepsToTriggers(adjustedSteps, habitTrigger);
  adjustedSteps = applyBarrierPlanBToSteps(adjustedSteps, planBStrategy);
  adjustedSteps = applyLoadAdaptationToSteps(adjustedSteps, loadAdaptation);
  adjustedSteps = finalizeStepsReasoning(
    adjustedSteps,
    buildStepReasoningContext({
      locale,
      date,
      reflections: context.reflections,
      easy_only: effectiveAdaptiveTaskCount.easy_only,
    }),
    weeklyThemesByGoalId(weeklyFocusByGoalId, date, pickWeeklyThemeForDate)
  );

  if (adjustedSteps.length === 0) {
    const regenerated = await generateAiStepsBatch({
      ...aiParams,
      goalsForAi: context.goals,
    });
    const finalized = finalizeSteps(
      regenerated,
      effectiveAdaptiveTaskCount,
      difficultyCalibration,
      latestRitual,
      eveningBriefing
    );
    let adjustedFinal = weeklyPlanAdjustments
      ? applyWeeklyPlanAdjustmentsToSteps(finalized, weeklyPlanAdjustments)
      : finalized;
    if (reflectionPlanAdjustments) {
      adjustedFinal = applyReflectionAdjustmentsToSteps(
        adjustedFinal,
        reflectionPlanAdjustments
      );
    }
    if (skipCoachAdjustment) {
      adjustedFinal = applySkipCoachToSteps(adjustedFinal, skipCoachAdjustment, locale);
      adjustedFinal = avoidSkippedPatternOnSteps(
        adjustedFinal,
        skipCoachAdjustment.adjustment.skipped_step_title
      );
    }
    adjustedFinal = attachWeeklyFocusToSteps(
      adjustedFinal,
      weeklyFocusByGoalId,
      date,
      pickWeeklyThemeForDate
    );
    adjustedFinal = anchorStepsToTriggers(adjustedFinal, habitTrigger);
    adjustedFinal = applyBarrierPlanBToSteps(adjustedFinal, planBStrategy);
    adjustedFinal = applyLoadAdaptationToSteps(adjustedFinal, loadAdaptation);
    adjustedFinal = finalizeStepsReasoning(
      adjustedFinal,
      buildStepReasoningContext({
        locale,
        date,
        reflections: context.reflections,
        easy_only: effectiveAdaptiveTaskCount.easy_only,
      }),
      weeklyThemesByGoalId(weeklyFocusByGoalId, date, pickWeeklyThemeForDate)
    );
    adjustedFinal = enforceRitualOnSteps(adjustedFinal, latestRitual);
    adjustedFinal = enforceFailedActionPatternsOnSteps(
      adjustedFinal,
      behaviorProfile.failed_action_patterns
    );
    adjustedFinal = injectFirstWinStep(
      adjustedFinal,
      formulation,
      locale,
      loadAdaptation,
      planBStrategy,
      effectiveAdaptiveTaskCount.max_steps,
      includeFirstWin
    );
    const inserted = await qualifyAndInsertSteps(
      userId,
      date,
      locale,
      adjustedFinal,
      planStepKeys,
      {...aiParams, goalsForAi: context.goals},
      dynamicTone.effective_style
    );
    if (weeklyPlanAdjustments && latestWeeklyReview) {
      await markWeeklyPlanAdjustmentsApplied(latestWeeklyReview.id, userId);
    }
    if (reflectionPlanAdjustments) {
      markReflectionAdjustmentApplied(userId, reflectionPlanAdjustments.reflection_date);
    }
    if (skipCoachAdjustment) {
      markSkipCoachAdjustmentApplied(userId, skipCoachAdjustment.skip_date);
    }
    return inserted;
  }

  adjustedSteps = enforceRitualOnSteps(adjustedSteps, latestRitual);
  adjustedSteps = enforceEveningBriefingOnSteps(adjustedSteps, eveningBriefing);
  adjustedSteps = enforceFailedActionPatternsOnSteps(
    adjustedSteps,
    behaviorProfile.failed_action_patterns
  );
  adjustedSteps = injectFirstWinStep(
    adjustedSteps,
    formulation,
    locale,
    loadAdaptation,
    planBStrategy,
    effectiveAdaptiveTaskCount.max_steps,
    includeFirstWin
  );

  const inserted = await qualifyAndInsertSteps(
    userId,
    date,
    locale,
    adjustedSteps,
    planStepKeys,
    aiParams,
    dynamicTone.effective_style
  );
  if (weeklyPlanAdjustments && latestWeeklyReview) {
    await markWeeklyPlanAdjustmentsApplied(latestWeeklyReview.id, userId);
  }
  if (reflectionPlanAdjustments) {
    markReflectionAdjustmentApplied(userId, reflectionPlanAdjustments.reflection_date);
  }
  if (skipCoachAdjustment) {
    markSkipCoachAdjustmentApplied(userId, skipCoachAdjustment.skip_date);
  }
  return inserted;
}
