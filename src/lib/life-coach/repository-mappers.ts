import {asEnum} from '@/lib/as-enum';
import {parseAiPersonalizationSummary} from '@/lib/ai-personalization-summary';
import type {AiPersonalizationSummary} from '@/lib/ai-personalization-summary';
import {parseJsonArrayOr, parseJsonObjectOr, parseJsonOr} from '@/lib/safe-json';
import {parseLifeContextStatuses} from '@/lib/formulation/life-context';
import {
  COACHING_STYLES,
  FAMILY_STATUSES,
  PREFERRED_ACTION_WINDOWS,
} from '@/lib/user-preferences';
import type {
  AiCoachingInsight,
  DailyBabyStep,
  DailyReflection,
  LifeDomain,
  LifeDomainState,
  UserProfile,
} from './types';
import {STEP_VALUE_FEEDBACK_OPTIONS} from './types';

export function rowToState(row: Record<string, unknown>): LifeDomainState {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    domain: row.domain as LifeDomain,
    current_score: row.current_score as number,
    current_state: (row.current_state as string) ?? '',
    desired_state: (row.desired_state as string) ?? '',
    main_blockers: parseJsonArrayOr<string>(row.main_blockers),
    available_time_per_day: row.available_time_per_day as LifeDomainState['available_time_per_day'],
    intensity_preference: row.intensity_preference as LifeDomainState['intensity_preference'],
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function rowToStep(row: Record<string, unknown>): DailyBabyStep {
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    goal_id: (row.goal_id as string) ?? null,
    domain: row.domain as LifeDomain,
    title: row.title as string,
    description: (row.description as string) ?? '',
    estimated_minutes: (row.estimated_minutes as number) ?? 15,
    difficulty: row.difficulty as DailyBabyStep['difficulty'],
    scheduled_date: row.scheduled_date as string,
    status: row.status as DailyBabyStep['status'],
    generated_by_ai: !!row.generated_by_ai,
    is_general: !!row.is_general,
    completed_at: (row.completed_at as string) ?? null,
    actual_minutes: (row.actual_minutes as number) ?? null,
    rescheduled_from: (row.rescheduled_from as string) ?? null,
    reschedule_count: (row.reschedule_count as number) ?? 0,
    first_viewed_at: (row.first_viewed_at as string) ?? null,
    coach_message_impression_at: (row.coach_message_impression_at as string) ?? null,
    primary_cta_clicked_at: (row.primary_cta_clicked_at as string) ?? null,
    read_description: !!row.read_description,
    reflection_text: (row.reflection_text as string) ?? null,
    blocker_reason: (row.blocker_reason as DailyBabyStep['blocker_reason']) ?? null,
    blocker_category: (row.blocker_category as DailyBabyStep['blocker_category']) ?? null,
    reattempt_same_day: !!row.reattempt_same_day,
    fallback_title: (row.fallback_title as string) ?? null,
    fallback_description: (row.fallback_description as string) ?? null,
    fallback_estimated_minutes: (row.fallback_estimated_minutes as number) ?? null,
    reasoning: (row.reasoning as string) ?? null,
    expected_resistance: (row.expected_resistance as string) ?? null,
    pain_addressed: (row.pain_addressed as string) ?? null,
    success_signal: (row.success_signal as string) ?? null,
    user_edited: !!row.user_edited,
    validation_fallback_applied: !!row.validation_fallback_applied,
    coach_tone: asEnum(row.coach_tone, COACHING_STYLES),
    weekly_focus_id: (row.weekly_focus_id as string) ?? null,
    value_feedback: asEnum(row.value_feedback, STEP_VALUE_FEEDBACK_OPTIONS),
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
  };
}

export function rowToReflection(row: Record<string, unknown>): DailyReflection {
  const analysis = parseJsonOr<DailyReflection['analysis']>(row.analysis_json, null);

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    date: row.date as string,
    mood_score: row.mood_score as number | null,
    energy_score: row.energy_score as number | null,
    reflection_text: (row.reflection_text as string) ?? null,
    blocker_reason: (row.blocker_reason as DailyReflection['blocker_reason']) ?? null,
    writing_duration_sec: (row.writing_duration_sec as number) ?? null,
    reflection_word_count: (row.reflection_word_count as number) ?? null,
    self_blame_language: !!row.self_blame_language,
    analysis,
    analyzed_at: (row.analyzed_at as string) ?? null,
    adjustment_applied_at: (row.adjustment_applied_at as string) ?? null,
    created_at: row.created_at as string,
  };
}

export function rowToInsight(row: Record<string, unknown>): AiCoachingInsight {
  const metadata = parseJsonObjectOr<Record<string, unknown>>(row.metadata, {});
  const planAppliedAt =
    (row.plan_adjustments_applied_at as string) ??
    (typeof metadata.plan_adjustments_applied_at === 'string'
      ? metadata.plan_adjustments_applied_at
      : null);
  return {
    id: row.id as string,
    user_id: row.user_id as string,
    insight_type: row.insight_type as AiCoachingInsight['insight_type'],
    content: (row.content as string) ?? '',
    metadata,
    plan_adjustments_applied_at: planAppliedAt,
    tokens_used: (row.tokens_used as number) ?? null,
    generation_duration_ms: (row.generation_duration_ms as number) ?? null,
    model_used: (row.model_used as string) ?? null,
    created_at: row.created_at as string,
  };
}

export function rowToUserProfile(
  userId: string,
  row: Record<string, unknown> | undefined,
  fallbackNow: string
): UserProfile {
  let physicalConsiderations: import('@/lib/user-preferences').PhysicalConsideration[] | null = null;
  if (typeof row?.physical_considerations === 'string') {
    physicalConsiderations = parseJsonArrayOr<import('@/lib/user-preferences').PhysicalConsideration>(
      row.physical_considerations,
      []
    );
  }
  let aiPersonalizationSummary: AiPersonalizationSummary | null = null;
  if (typeof row?.ai_personalization_summary === 'string') {
    aiPersonalizationSummary = parseAiPersonalizationSummary(
      parseJsonOr(row.ai_personalization_summary, null)
    );
  }

  return {
    id: userId,
    email: (row?.email as string) ?? null,
    preferred_language: (row?.language as 'en' | 'he') ?? 'en',
    timezone: (row?.timezone as string) ?? 'UTC',
    gender: (row?.gender as string) ?? null,
    age: row?.age != null ? Number(row.age) : null,
    life_context_statuses: parseLifeContextStatuses(row?.life_context_status, null),
    life_context_note:
      typeof row?.life_context_note === 'string' ? row.life_context_note : null,
    wake_time: typeof row?.wake_time === 'string' ? row.wake_time : null,
    sleep_time: typeof row?.sleep_time === 'string' ? row.sleep_time : null,
    preferred_action_window: asEnum(row?.preferred_action_window, PREFERRED_ACTION_WINDOWS),
    coaching_style: asEnum(row?.coaching_style, COACHING_STYLES),
    family_status: asEnum(row?.family_status, FAMILY_STATUSES),
    physical_considerations: physicalConsiderations,
    ai_personalization_summary: aiPersonalizationSummary,
    created_at: (row?.created_at as string) ?? fallbackNow,
    updated_at: (row?.updated_at as string) ?? fallbackNow,
  };
}
