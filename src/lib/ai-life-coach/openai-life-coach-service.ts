import type {ZodType, z} from 'zod';
import type {AppLocale} from '@/i18n/config';
import {
  aiGenerateDailyStepsResponseSchemaForMax,
  aiStructuredGoalResponseSchema,
  reflectionAnalysisResponseSchema,
  skipRecoveryStepContentSchema,
  weeklyReviewResponseSchema,
  type AiStructuredGoalResponse,
  type WeeklyReviewAiResponse,
} from '@/lib/life-coach/schemas';
import {parseJsonOr} from '@/lib/safe-json';
import type {
  DailyBabyStep,
  DailyReflection,
  Goal,
  LifeContextStatus,
  LifeDomain,
  LifeDomainState,
  StructuredDailyBabyStep,
  StructuredGoalPlan,
  WeeklyReview,
  WeeklyPatternMining,
} from '@/lib/life-coach/types';
import {enforceFailedActionPatternsOnSteps} from '@/lib/behavior-profile/failed-action-patterns';
import {clampWeeklyPlanAdjustmentsWithLoadAdaptation} from '@/lib/formulation/load-adaptation-routing';
import {applyGoalRealismToPlan, realismCheckForAiResponse} from '@/lib/life-coach/goal-realism-check';
import {
  buildGoalStructuringNextBestAction,
  buildWeeklyReviewNextBestAction,
  buildReflectionNextBestAction,
  ensureNextBestAction,
} from '@/lib/next-best-action';
import {buildReflectionAnalysisFallback} from '@/lib/reflection-analysis/fallback';
import type {ReflectionAnalysis} from '@/lib/reflection-analysis/types';
import {getLifeCoachModelConfig} from '@/lib/life-coach/env';
import {
  buildDailyStepsSystemPrompt,
  buildDailyStepsUserPrompt,
  buildGoalStructuringSystemPrompt,
  buildGoalStructuringUserPrompt,
  buildReflectionAnalysisSystemPrompt,
  buildReflectionAnalysisUserPrompt,
  buildWeeklyReviewSystemPrompt,
  buildWeeklyReviewUserPrompt,
  buildSkipRecoverySystemPrompt,
  buildSkipRecoveryUserPrompt,
} from './prompts';
import {callOpenAiResponses} from '@/lib/llm/client';
import {
  buildEmotionalReflectionFallback,
  buildProgressEvidenceFallback,
  buildWeeklyExecutionSnapshot,
  collectIdentityPhrases,
} from '@/lib/life-coach/weekly-review-emotional';
import {buildRecurringPatternFallback} from '@/lib/life-coach/weekly-review-recurring-pattern';
import type {AiPersonalizationSummary} from '@/lib/ai-personalization-summary';
import type {UserBehaviorProfile} from '@/lib/behavior-profile/types';
import type {RecurringBlockerPattern} from '@/lib/blocker-patterns/types';
import type {LongTermProfile, ShortTermContext} from '@/lib/coach-memory';
import {enforceRitualOnSteps, type RitualAdaptationContext} from '@/lib/morning-ritual-adaptation';
import type {ExecutionHistorySummary} from '@/lib/execution-history/summarize';
import type {AdaptiveTaskCountReason} from '@/lib/life-coach/adaptive-task-count';
import {
  applyPersonalDifficultyCalibration,
  type PersonalDifficultyCalibration,
} from '@/lib/life-coach/personal-difficulty-calibration';
import {
  aiDailyStepContractToStructured,
  buildFallbackStepContract,
  goalBabyStepsFromContracts,
  type AiDailyStepContract,
} from '@/lib/life-coach/step-contract';
import {
  enforceKnownBlockersOnGoalSteps,
  type KnownBlockersProfile,
} from '@/lib/life-coach/known-blockers';
import {buildSkipRecoveryStep, type SimplifiedStepContent} from '@/lib/life-coach/simplify-step';
import type {ReflectionBlockerReason} from '@/lib/life-coach/types';
type GoalStructuringInput = {
  locale: AppLocale;
  domain: LifeDomain;
  assessment: LifeDomainState | null;
  raw_goal: string;
  deadline: string | null;
  motivation: string;
  constraints: string;
  life_context_statuses?: LifeContextStatus[];
  coaching_style?: string;
  preferred_tone?: string;
  avoid_tone?: string;
  age?: number | null;
  gender?: string | null;
  known_blockers?: KnownBlockersProfile | null;
  ai_personalization_summary?: AiPersonalizationSummary | null;
  user_behavior_profile?: UserBehaviorProfile | null;
};

type DailyStepGenerationInput = {
  locale: AppLocale;
  date: string;
  domainStates: LifeDomainState[];
  activeGoals: Goal[];
  recentSteps: DailyBabyStep[];
  recentReflections: DailyReflection[];
  milestonesByGoalId?: Record<string, import('@/lib/life-coach/types').Milestone[]>;
  weeklyFocusByGoalId?: Record<string, import('@/lib/goal-decomposition-tree/types').WeeklyGoalFocus>;
  wake_time?: string;
  sleep_time?: string;
  coaching_style?: string;
  preferred_tone?: string;
  avoid_tone?: string;
  tone_personalization?: ReturnType<
    typeof import('@/lib/coach-tone').tonePersonalizationForPrompt
  >;
  life_context_statuses?: LifeContextStatus[];
  life_context_note?: string | null;
  physical_considerations?: import('@/lib/user-preferences').PhysicalConsideration[];
  preferred_action_window?: import('@/lib/user-preferences').PreferredActionWindow;
  age?: number | null;
  gender?: string | null;
  user_behavior_profile?: UserBehaviorProfile | null;
  recurring_blocker_patterns?: RecurringBlockerPattern[];
  execution_history?: ExecutionHistorySummary | null;
  short_term_context?: ShortTermContext | null;
  long_term_profile?: LongTermProfile | null;
  max_steps?: number;
  easy_only?: boolean;
  task_count_reason?: AdaptiveTaskCountReason;
  difficulty_calibration?: PersonalDifficultyCalibration | null;
  latest_morning_ritual?: RitualAdaptationContext | null;
  morning_mission?: {
    mission: string;
    identity: string | null;
    time_block: string | null;
    suggested_domain: LifeDomain | null;
  } | null;
  evening_briefing?: import('@/lib/evening-reset/for-daily-steps').EveningBriefingForTomorrow | null;
  ai_personalization_summary?: AiPersonalizationSummary | null;
  overplanning?: import('@/lib/life-coach/overplanning').OverplanningContext | null;
  personalized_challenge?: import('@/lib/formulation/personalized-challenge').PersonalizedChallenge | null;
  habit_trigger?: import('@/lib/formulation/habit-trigger-routing').HabitTriggerContext | null;
  plan_b_strategy?: import('@/lib/formulation/plan-b-routing').BarrierPlanBStrategy | null;
  load_adaptation?: import('@/lib/formulation/load-adaptation-routing').LoadAdaptationContext | null;
  accountability?: import('@/lib/formulation/accountability-routing').AccountabilityContext | null;
  real_life_alignment?: import('@/lib/formulation/real-life-alignment-routing').RealLifeAlignmentContext | null;
  skip_adaptation?: Record<string, unknown> | null;
  emotional_routing?: import('@/lib/formulation/emotional-stage-routing').EmotionalStageRouting | null;
  domain_rivalry?: import('@/lib/gamification/domain-rivalry').DomainRivalrySnapshot | null;
  weekly_review_context?: import('@/lib/life-coach/weekly-review-context').WeeklyReviewContext | null;
};

type ReflectionAnalysisInput = {
  locale: AppLocale;
  date: string;
  blocker_reason: DailyReflection['blocker_reason'];
  reflection_text: string | null;
  recentSteps: DailyBabyStep[];
  recentReflections: DailyReflection[];
  life_context_statuses?: LifeContextStatus[];
  user_behavior_profile?: UserBehaviorProfile | null;
  recurring_blocker_patterns?: RecurringBlockerPattern[];
  execution_history?: ExecutionHistorySummary | null;
  short_term_context?: ShortTermContext | null;
  long_term_profile?: LongTermProfile | null;
};

type WeeklyReviewInput = {
  locale: AppLocale;
  period_start: string;
  period_end: string;
  domainStates: LifeDomainState[];
  activeGoals: Goal[];
  recentSteps: DailyBabyStep[];
  recentReflections: DailyReflection[];
  life_context_statuses?: LifeContextStatus[];
  user_behavior_profile?: UserBehaviorProfile | null;
  recurring_blocker_patterns?: RecurringBlockerPattern[];
  execution_history?: ExecutionHistorySummary | null;
  short_term_context?: ShortTermContext | null;
  long_term_profile?: LongTermProfile | null;
  pattern_mining?: WeeklyPatternMining | null;
  coaching_style?: string;
  preferred_tone?: string;
  avoid_tone?: string;
  tone_personalization?: ReturnType<
    typeof import('@/lib/coach-tone').tonePersonalizationForPrompt
  >;
  ai_personalization_summary?: AiPersonalizationSummary | null;
  load_adaptation?: import('@/lib/formulation/load-adaptation-routing').LoadAdaptationContext | null;
  accountability?: import('@/lib/formulation/accountability-routing').AccountabilityContext | null;
  behavior_change?: import('@/lib/formulation/behavior-change-tracking').BehaviorChangeContext | null;
  behavior_change_analysis?: import('@/lib/formulation/behavior-change-tracking').WeekBehaviorChangeAnalysis | null;
  morning_ritual_summary?: import('@/lib/life-coach/morning-ritual-weekly-summary').MorningRitualWeeklySummary | null;
  checkin_weekly_summary?: import('@/lib/life-coach/checkin-weekly-summary').CheckinWeeklySummary | null;
  step_value_feedback_summary?: import('@/lib/step-value-feedback/summarize').StepValueFeedbackSummary | null;
  reflection_loot_summary?: {count: number; dominant_loot_type: string | null} | null;
};

const modelConfig = getLifeCoachModelConfig();

export const openaiLifeCoachService = {
  async structureGoal(input: GoalStructuringInput): Promise<StructuredGoalPlan> {
    const usedFallback = !process.env.OPENAI_API_KEY;

    const { data } = await requestStructuredJson({
      model: modelConfig.structuring,
      systemPrompt: buildGoalStructuringSystemPrompt(
        input.locale,
        false,
        input.life_context_statuses,
        input.coaching_style,
        input.preferred_tone,
        input.avoid_tone,
        input.age,
        input.gender,
        input.domain
      ),
      userPrompt: buildGoalStructuringUserPrompt(input),
      schema: aiStructuredGoalResponseSchema,
      fallback: buildStructuredGoalFallbackResponse(input),
      maxOutputTokens: 1400,
    });

    const plan = normalizeStructuredGoalResult(
      mapAiStructuredGoalResponse(data),
      input,
      usedFallback
    );
    const firstStep = plan.daily_baby_steps[0];
    return {
      ...plan,
      next_best_action: ensureNextBestAction(data.next_best_action, buildGoalStructuringNextBestAction({
        locale: input.locale,
        first_step_title: firstStep?.title,
        first_step_minutes: firstStep?.estimated_minutes,
      })),
    };
  },

  async generateDailySteps(input: DailyStepGenerationInput) {
    const maxSteps = Math.max(1, Math.min(3, input.max_steps ?? 2));
    const { data } = await requestStructuredJson({
      model: modelConfig.dailySteps,
      systemPrompt: buildDailyStepsSystemPrompt(
        input.locale,
        false,
        input.wake_time,
        input.coaching_style,
        input.preferred_tone,
        input.avoid_tone,
        input.life_context_statuses,
        input.physical_considerations,
        input.preferred_action_window,
        input.age,
        input.gender,
        input.sleep_time,
        input.emotional_routing
      ),
      userPrompt: buildDailyStepsUserPrompt(input),
      schema: aiGenerateDailyStepsResponseSchemaForMax(maxSteps),
      fallback: buildDailyStepsFallbackResponse(input),
      maxOutputTokens: 1200,
    });

    let steps = data.steps.map(aiDailyStepContractToStructured);

    if (input.easy_only) {
      steps = steps.map((step) => ({
        ...step,
        difficulty: 'easy' as const,
        estimated_minutes: Math.min(step.estimated_minutes, 10),
      }));
    }

    steps = steps.slice(0, maxSteps);
    if (input.difficulty_calibration) {
      steps = applyPersonalDifficultyCalibration(steps, input.difficulty_calibration);
    }

    if (input.latest_morning_ritual) {
      steps = enforceRitualOnSteps(steps, input.latest_morning_ritual);
    }

    return {date: data.date, steps};
  },

  async analyzeReflection(input: ReflectionAnalysisInput): Promise<ReflectionAnalysis & { _metrics: AiCallMetrics }> {
    const { data, metrics } = await requestStructuredJson({
      model: modelConfig.review,
      systemPrompt: buildReflectionAnalysisSystemPrompt(input.locale, input.life_context_statuses),
      userPrompt: buildReflectionAnalysisUserPrompt(input),
      schema: reflectionAnalysisResponseSchema,
      fallback: buildReflectionAnalysisFallback({
        locale: input.locale,
        blocker_reason: input.blocker_reason,
      }),
      maxOutputTokens: 900,
    });

    const pendingStep = input.recentSteps.find(
      (step) => step.scheduled_date === input.date && step.status === 'pending'
    );
    return {
      ...data,
      next_best_action: ensureNextBestAction(data.next_best_action, buildReflectionNextBestAction({
        locale: input.locale,
        blocker_reason: input.blocker_reason,
        recommended_adjustment: data.recommended_adjustment,
        easy_only: data.next_day_adjustments.easy_only,
        pending_step_id: pendingStep?.id,
      })),
      _metrics: metrics,
    };
  },

  async generateWeeklyReview(input: WeeklyReviewInput): Promise<WeeklyReview & { _metrics: AiCallMetrics }> {
    const week_execution = buildWeeklyExecutionSnapshot(
      input.recentSteps,
      input.period_start,
      input.period_end
    );
    const identity_phrases = collectIdentityPhrases(input.activeGoals);
    const pattern_mining_for_prompt = input.pattern_mining?.plan_adjustments
      ? {
          ...input.pattern_mining,
          plan_adjustments: clampWeeklyPlanAdjustmentsWithLoadAdaptation(
            input.pattern_mining.plan_adjustments,
            input.load_adaptation ?? null
          ),
        }
      : input.pattern_mining;
    const emotionalFallback = buildEmotionalReflectionFallback(input);
    const progressEvidenceFallback =
      input.behavior_change_analysis?.headline ??
      buildProgressEvidenceFallback({
        locale: input.locale,
        period_start: input.period_start,
        period_end: input.period_end,
        recentSteps: input.recentSteps,
        recentReflections: input.recentReflections,
      });
    const recurringPatternFallback = buildRecurringPatternFallback({
      locale: input.locale,
      period_start: input.period_start,
      period_end: input.period_end,
      recentSteps: input.recentSteps,
      recentReflections: input.recentReflections,
      recurring_blocker_patterns: input.recurring_blocker_patterns,
    });
    const { data, metrics } = await requestStructuredJson({
      model: modelConfig.review,
      systemPrompt: buildWeeklyReviewSystemPrompt(
        input.locale,
        input.life_context_statuses,
        input.coaching_style,
        input.preferred_tone,
        input.avoid_tone
      ),
      userPrompt: buildWeeklyReviewUserPrompt({
        ...input,
        pattern_mining: pattern_mining_for_prompt,
        week_execution,
        identity_phrases,
        morning_ritual_summary: input.morning_ritual_summary ?? null,
        checkin_weekly_summary: input.checkin_weekly_summary ?? null,
        step_value_feedback_summary: input.step_value_feedback_summary ?? null,
        reflection_loot_summary: input.reflection_loot_summary ?? null,
      }),
      schema: weeklyReviewResponseSchema,
      fallback: buildWeeklyReviewFallback(input),
      maxOutputTokens: 1700,
    });

    const pattern_mining = input.pattern_mining ?? null;
    const pattern_insights = pattern_mining?.insights ?? [];
    const plan_adjustments = pattern_mining?.plan_adjustments
      ? clampWeeklyPlanAdjustmentsWithLoadAdaptation(
          pattern_mining.plan_adjustments,
          input.load_adaptation ?? null
        )
      : undefined;
    const recommended_adjustment =
      data.recommended_adjustment ||
      pattern_insights[0] ||
      plan_adjustments?.rationale ||
      data.recommended_adjustment;

    const emotional_reflection = data.emotional_reflection ?? emotionalFallback;
    return {
      ...data,
      recommended_adjustment,
      emotional_reflection,
      recurring_pattern: data.recurring_pattern ?? recurringPatternFallback,
      progress_evidence: data.progress_evidence ?? progressEvidenceFallback,
      pattern_mining: pattern_mining ?? undefined,
      pattern_insights,
      plan_adjustments,
      next_best_action: ensureNextBestAction(data.next_best_action, buildWeeklyReviewNextBestAction({
        locale: input.locale,
        recommended_adjustment,
        next_identity_action: emotional_reflection.next_identity_action,
      })),
      _metrics: metrics,
    };
  },

  async suggestSkipRecovery(input: {
    locale: AppLocale;
    step: DailyBabyStep;
    blocker_reason?: ReflectionBlockerReason | null;
  }): Promise<SimplifiedStepContent> {
    const fallback = buildSkipRecoveryStep(input.step, input.locale);
    const {data} = await requestStructuredJson({
      model: modelConfig.dailySteps,
      systemPrompt: buildSkipRecoverySystemPrompt(input.locale),
      userPrompt: buildSkipRecoveryUserPrompt({
        locale: input.locale,
        step: input.step,
        blocker_reason: input.blocker_reason,
      }),
      schema: skipRecoveryStepContentSchema,
      fallback,
      maxOutputTokens: 500,
    });

    return {
      title: data.title.trim(),
      description: data.description.trim(),
      estimated_minutes: Math.min(3, data.estimated_minutes),
      difficulty: 'easy',
    };
  },
};

export type AiCallMetrics = {
  tokens_used: number | null;
  generation_duration_ms: number | null;
  model_used: string | null;
};

async function requestStructuredJson<T>({
  model,
  systemPrompt,
  userPrompt,
  schema,
  fallback,
  maxOutputTokens,
}: {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  schema: ZodType<T>;
  fallback: T;
  maxOutputTokens: number;
}): Promise<{ data: T; metrics: AiCallMetrics }> {
  const nullMetrics: AiCallMetrics = { tokens_used: null, generation_duration_ms: null, model_used: null };

  const result = await callOpenAiResponses({
    model,
    instructions: systemPrompt,
    input: userPrompt,
    maxOutputTokens,
  });

  if (!result || !result.text) {
    return { data: fallback, metrics: nullMetrics };
  }

  const parsed = schema.safeParse(parseJsonOr<unknown>(result.text, null));
  const metrics: AiCallMetrics = {
    tokens_used: result.tokensUsed,
    generation_duration_ms: result.durationMs,
    model_used: result.model,
  };
  return { data: parsed.success ? parsed.data : fallback, metrics };
}

function mapAiStructuredGoalResponse(response: AiStructuredGoalResponse): StructuredGoalPlan {
  return {
    goal_title: response.goal_title,
    goal_description: response.goal_description,
    success_metric: response.success_metric,
    deadline: response.deadline,
    milestones: response.milestones,
    daily_baby_steps: goalBabyStepsFromContracts(response.daily_baby_steps),
    realism_check: response.realism_check
      ? {
          risk_level: response.realism_check.risk_level,
          risk_reason: response.realism_check.risk_reason,
          first_week_adjustment: response.realism_check.first_week_adjustment ?? null,
          adjusted: false,
        }
      : null,
  };
}

function normalizeStructuredGoalResult(
  result: StructuredGoalPlan,
  input: GoalStructuringInput,
  _apiMissing: boolean
): StructuredGoalPlan {
  const enforcedSteps = enforceKnownBlockersOnGoalSteps(
    result.daily_baby_steps,
    input.known_blockers
  );

  const normalized: StructuredGoalPlan = {
    ...result,
    success_metric: capSuccessMetric(result.success_metric),
    daily_baby_steps: enforcedSteps,
  };

  const {plan, realism_check} = applyGoalRealismToPlan(
    normalized,
    input,
    result.realism_check
  );
  const failedPatterns = input.user_behavior_profile?.failed_action_patterns ?? [];
  const finalPlan =
    failedPatterns.length > 0
      ? {
          ...plan,
          daily_baby_steps: enforceFailedActionPatternsOnSteps(
            plan.daily_baby_steps,
            failedPatterns
          ),
        }
      : plan;
  return {...finalPlan, realism_check};
}

// Keep the success metric short and readable (item 11). Strips trailing
// punctuation and truncates at a sentence/word boundary under 120 chars.
function capSuccessMetric(metric: string | null | undefined): string {
  const clean = (metric ?? '').trim();
  if (!clean) return clean;
  const firstSentence = clean.split(/(?<=[.!?])\s/)[0] ?? clean;
  const base = firstSentence.length <= 120 ? firstSentence : firstSentence.slice(0, 120);
  if (base.length >= clean.length) return base.trim();
  const lastSpace = base.lastIndexOf(' ');
  return (lastSpace > 60 ? base.slice(0, lastSpace) : base).trim().replace(/[,;:]$/, '');
}

function buildStructuredGoalFallbackResponse(input: GoalStructuringInput): AiStructuredGoalResponse {
  const response = buildGenericStructuredGoalFallbackResponse(input);

  const planForCheck: StructuredGoalPlan = {
    goal_title: response.goal_title,
    goal_description: response.goal_description,
    success_metric: response.success_metric,
    deadline: response.deadline,
    milestones: response.milestones,
    daily_baby_steps: goalBabyStepsFromContracts(response.daily_baby_steps),
  };

  const firstStep = response.daily_baby_steps[0];
  return {
    ...response,
    realism_check: realismCheckForAiResponse(planForCheck, input),
    next_best_action: buildGoalStructuringNextBestAction({
      locale: input.locale,
      first_step_title: firstStep?.title,
      first_step_minutes: firstStep?.estimated_minutes,
    }),
  };
}

function buildGenericStructuredGoalFallbackResponse(
  input: GoalStructuringInput
): Omit<AiStructuredGoalResponse, 'realism_check' | 'next_best_action'> {
  const cleanGoal = input.raw_goal.trim();
  const actionBase = cleanGoal.replace(/\.$/, '');
  const he = input.locale === 'he';
  const stepTitle = fallbackStepTitle(input.domain, cleanGoal, input.locale);

  return {
    goal_title: (he ? cleanGoal : toTitleCase(actionBase)) || (he ? 'בניית מומנטום' : `Build ${input.domain} momentum`),
    goal_description: cleanGoal,
    success_metric: he
      ? input.deadline
        ? `להתקדם בצורה נראית לעין לקראת "${cleanGoal}" עד ${input.deadline}.`
        : `להתקדם מדי שבוע בצורה נראית לעין לקראת "${cleanGoal}".`
      : input.deadline
        ? `Make visible progress on "${cleanGoal}" by ${input.deadline}.`
        : `Make visible weekly progress on "${cleanGoal}".`,
    deadline: input.deadline,
    milestones: [
      {
        title: he ? 'לבסס עקביות' : `Build consistency in ${input.domain}`,
        description: he
          ? 'מתחילים מקצב חוזר וקבוע, לא מעוצמה.'
          : 'Start with a repeatable rhythm instead of intensity.',
        target_date: input.deadline,
      },
    ],
    daily_baby_steps: [
      buildFallbackStepContract({
        title: stepTitle,
        description: he
          ? 'שומרים על צעד קטן מספיק כדי לסיים אותו גם ביום עמוס.'
          : 'Keep it small enough to finish even on a busy day.',
        estimated_minutes: Math.min(
          input.known_blockers?.max_initial_step_minutes ?? 10,
          10
        ),
        locale: input.locale,
        why: input.known_blockers?.has_no_time_signal
          ? he
            ? 'נבחר כי סימנת חוסר זמן — צעד קצר של 3-10 דקות.'
            : 'Chosen because you flagged no time — a short 3-10 minute step.'
          : undefined,
      }),
    ],
  };
}

function buildDailyStepsFallbackResponse(input: DailyStepGenerationInput): {
  date: string;
  steps: AiDailyStepContract[];
} {
  const he = input.locale === 'he';
  const maxSteps = Math.max(1, Math.min(3, input.max_steps ?? 2));
  const cal = input.difficulty_calibration;
  const defaultMinutes = cal?.target_minutes ?? 10;
  const mission = input.morning_mission?.mission?.trim();

  if (mission) {
    const domain = input.morning_mission?.suggested_domain ?? input.domainStates[0]?.domain ?? 'mind';
    return {
      date: input.date,
      steps: [
        {
          ...buildFallbackStepContract({
            title: mission.slice(0, 160),
            description: he
              ? 'זה מחובר למשימת הבוקר שלך — נשאיר את זה קטן ובר ביצוע היום.'
              : 'This is connected to your morning mission — keep it small and doable today.',
            estimated_minutes: Math.min(defaultMinutes, cal?.max_minutes ?? 15),
            difficulty: cal?.difficulty_ceiling ?? 'easy',
            locale: input.locale,
            why: he
              ? 'נבחר כי זו המשימה שהגדרת בטקס הבוקר.'
              : 'Chosen because this is the mission you set in your morning ritual.',
          }),
          domain,
          goal_id: null,
        },
      ],
    };
  }

  const contracts: AiDailyStepContract[] = input.activeGoals.slice(0, maxSteps).map((goal) => {
    const contract = buildFallbackStepContract({
      title: fallbackStepTitle(goal.domain, goal.title, input.locale),
      description: he
        ? 'נשארים עם צעד אחד קטן ונראה לעין היום.'
        : 'Stay with one small, visible move today.',
      estimated_minutes: Math.min(
        resolveMinutesForGoal(goal.domain, input.domainStates),
        cal?.max_minutes ?? 20
      ),
      difficulty: cal?.difficulty_ceiling ?? 'easy',
      locale: input.locale,
    });
    return {...contract, domain: goal.domain, goal_id: goal.id};
  });

  const steps =
    contracts.length > 0
      ? contracts
      : [
          {
            ...buildFallbackStepContract({
              title: he
                ? 'להקדיש 10 דקות לצעד הבא והנראה לעין'
                : 'Spend 10 minutes on the next visible step',
              description: he
                ? 'שומרים על זה מוחשי וקל להתחלה.'
                : 'Keep it concrete and easy to start.',
              estimated_minutes: defaultMinutes,
              difficulty: cal?.difficulty_ceiling ?? 'easy',
              locale: input.locale,
            }),
            domain: input.domainStates[0]?.domain ?? 'mind',
            goal_id: null,
          },
        ];

  return {date: input.date, steps};
}

function buildWeeklyReviewFallback(input: WeeklyReviewInput): WeeklyReviewAiResponse {
  const recent = input.recentSteps;
  const completed = recent.filter((step) => step.status === 'completed');
  const byDomain = input.domainStates.map((state) => {
    const all = recent.filter((step) => step.domain === state.domain);
    return {
      domain: state.domain,
      completed_steps: all.filter((step) => step.status === 'completed').length,
      total_steps: all.length,
    };
  });

  const strongest = [...byDomain].sort((a, b) => b.completed_steps - a.completed_steps)[0] ?? null;
  const weakest = [...byDomain].sort((a, b) => a.completed_steps - b.completed_steps)[0] ?? null;
  const lastBlocker = input.recentReflections.find((item) => item.blocker_reason)?.blocker_reason ?? 'low_energy';
  const he = input.locale === 'he';
  const blockerHe: Record<string, string> = {
    low_energy: 'אנרגיה נמוכה',
    no_time: 'חוסר זמן',
    forgot: 'שכחה',
    unclear_task: 'משימה לא ברורה',
    too_hard: 'קושי גבוה',
    other: 'אחר',
  };
  const pattern_insights = input.pattern_mining?.insights ?? [];
  const plan_adjustments = input.pattern_mining?.plan_adjustments;

  return {
    completed_steps_count: completed.length,
    domain_progress: byDomain,
    main_blocker: he ? (blockerHe[lastBlocker] ?? 'אחר') : lastBlocker.replaceAll('_', ' '),
    strongest_domain: strongest?.domain ?? null,
    weakest_domain: weakest?.domain ?? null,
    recommended_adjustment:
      pattern_insights[0] ??
      (he
        ? 'בשבוע הבא נשמור על תוכנית קטנה, מתוזמנת וקלה יותר להתחלה.'
        : 'Keep next week smaller, more scheduled, and easier to start.'),
    summary: he
      ? pattern_insights.length > 0
        ? pattern_insights.join(' ')
        : 'אתה מצליח יותר כשהמשימה נראית לעין, קצרה ומעוגנת ביום. נשמור על תוכנית מעשית.'
      : pattern_insights.length > 0
        ? pattern_insights.join(' ')
        : 'You do better when the task is visible, brief, and anchored to the day. Keep the plan practical.',
    emotional_reflection: buildEmotionalReflectionFallback(input),
    recurring_pattern: buildRecurringPatternFallback({
      locale: input.locale,
      period_start: input.period_start,
      period_end: input.period_end,
      recentSteps: input.recentSteps,
      recentReflections: input.recentReflections,
      recurring_blocker_patterns: input.recurring_blocker_patterns,
    }),
    progress_evidence: buildProgressEvidenceFallback({
      locale: input.locale,
      period_start: input.period_start,
      period_end: input.period_end,
      recentSteps: input.recentSteps,
      recentReflections: input.recentReflections,
    }),
    next_best_action: buildWeeklyReviewNextBestAction({
      locale: input.locale,
      recommended_adjustment:
        pattern_insights[0] ??
        (he
          ? 'בשבוע הבא נשמור על תוכנית קטנה, מתוזמנת וקלה יותר להתחלה.'
          : 'Keep next week smaller, more scheduled, and easier to start.'),
      next_identity_action: buildEmotionalReflectionFallback(input).next_identity_action,
    }),
  };
}

function fallbackStepTitle(domain: LifeDomain, goal: string, locale: AppLocale = 'en') {
  if (locale === 'he') {
    const prefixHe: Record<LifeDomain, string> = {
      health: 'ללכת או לזוז 8 דקות לקראת',
      time: 'להקדיש 10 דקות מרוכזות לארגון',
      wealth: 'לבחון צעד פיננסי קטן אחד עבור',
      career: 'לעשות מהלך עבודה נראה לעין אחד עבור',
      relationships: 'לשלוח הודעה מתחשבת אחת על',
      mind: 'לכתוב יומן 8 דקות על',
      spirit: 'להקדיש 8 דקות שקטות להתחברות מחדש עם',
      house_family: 'לסדר או לשפר אזור קטן אחד שקשור ל',
    };
    return `${prefixHe[domain]} ${goal}`.trim();
  }

  const prefix: Record<LifeDomain, string> = {
    health: 'Walk or move for 8 minutes toward',
    time: 'Spend 10 focused minutes organizing',
    wealth: 'Review one small financial step for',
    career: 'Do one visible work move for',
    relationships: 'Send one thoughtful message about',
    mind: 'Journal for 8 minutes about',
    spirit: 'Take 8 quiet minutes to reconnect with',
    house_family: 'Tidy or improve one small area related to',
  };

  return `${prefix[domain]} ${goal}`.trim();
}

function resolveMinutesForGoal(_domain: LifeDomain, _domainStates: LifeDomainState[]) {
  return 10;
}

function toTitleCase(value: string) {
  return value
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 6)
    .map((part) => part[0]?.toUpperCase() + part.slice(1))
    .join(' ');
}

