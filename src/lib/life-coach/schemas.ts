import {z} from 'zod';
import {nextBestActionSchema} from '@/lib/next-best-action/schema';
import {
  aiDailyStepContractSchema,
  goalBreakdownStepContractSchema,
} from '@/lib/life-coach/step-contract';
import {
  AVAILABLE_TIME_OPTIONS,
  DAILY_STEP_DIFFICULTIES,
  DAILY_STEP_STATUSES,
  DOMAIN_BLOCKERS,
  FORMULATION_PHASES,
  FORMULATION_SESSION_STATUSES,
  GOAL_CREATED_BY,
  GOAL_STATUSES,
  INSIGHT_TYPES,
  INTENSITY_PREFERENCES,
  LIFE_CONTEXT_STATUSES,
  LIFE_DOMAINS,
  MILESTONE_STATUSES,
  REFLECTION_BLOCKER_REASONS,
  STEP_VALUE_FEEDBACK_OPTIONS,
  RISK_ACTIONS,
  RISK_LEVELS,
} from './types';

export const lifeDomainSchema = z.enum(LIFE_DOMAINS);
export const intensityPreferenceSchema = z.enum(INTENSITY_PREFERENCES);
const goalStatusSchema = z.enum(GOAL_STATUSES);
const goalCreatedBySchema = z.enum(GOAL_CREATED_BY);
const milestoneStatusSchema = z.enum(MILESTONE_STATUSES);
export const dailyStepStatusSchema = z.enum(DAILY_STEP_STATUSES);
export const dailyStepDifficultySchema = z.enum(DAILY_STEP_DIFFICULTIES);
const reflectionBlockerReasonSchema = z.enum(REFLECTION_BLOCKER_REASONS);
const stepValueFeedbackSchema = z.enum(STEP_VALUE_FEEDBACK_OPTIONS);

const scoreSchema = z.number().int().min(1).max(10);
const optionalIsoDateSchema = z.string().date().nullable();
const requiredIsoDateSchema = z.string().date();

export const lifeDomainAssessmentInputSchema = z.object({
  current_score: scoreSchema,
  current_state: z.string().trim().min(1).max(2000),
  desired_state: z.string().trim().min(1).max(2000),
  main_blockers: z.array(z.string().trim().min(1).max(120)).max(8),
  available_time_per_day: z.union([
    z.literal(AVAILABLE_TIME_OPTIONS[0]),
    z.literal(AVAILABLE_TIME_OPTIONS[1]),
    z.literal(AVAILABLE_TIME_OPTIONS[2]),
    z.literal(AVAILABLE_TIME_OPTIONS[3]),
  ]),
  intensity_preference: intensityPreferenceSchema,
});

const goalCreateInputSchema = z.object({
  domain: lifeDomainSchema,
  domain_category: z.string().trim().min(1).max(120).nullable().optional(),
  title: z.string().trim().min(1).max(140),
  description: z.string().trim().min(1).max(4000),
  success_metric: z.string().trim().min(1).max(280),
  deadline: optionalIsoDateSchema,
  status: goalStatusSchema.default('active'),
  created_by: goalCreatedBySchema.default('user'),
  success_metric_specificity: z.enum(['measurable', 'vague', 'absent']).optional(),
});

export const goalUpdateInputSchema = goalCreateInputSchema.partial().extend({
  status: goalStatusSchema.optional(),
  commitment_days: z.coerce.number().int().min(7).max(90).optional(),
  renew_commitment: z.boolean().optional(),
});

export const milestoneStatusUpdateSchema = z.object({
  status: milestoneStatusSchema,
});

const structuredGoalMilestoneSchema = z.object({
  title: z.string().trim().min(1).max(200).transform((value) => value.slice(0, 140)),
  description: z.string().trim().max(1000).optional().default(''),
  target_date: optionalIsoDateSchema,
});

const planBFieldsSchema = {
  fallback_title: z.string().trim().min(1).max(180),
  fallback_description: z.string().trim().max(500),
  fallback_estimated_minutes: z.coerce.number().int().min(1).max(5),
};

const structuredDailyBabyStepSchema = z.object({
  domain: lifeDomainSchema,
  goal_id: z.string().uuid().nullable(),
  title: z.string().trim().min(1).max(180),
  description: z
    .string()
    .trim()
    .max(1000)
    .transform((value) => value || 'Small clear step from your health plan.'),
  estimated_minutes: z.coerce.number().int().min(5).max(20),
  difficulty: dailyStepDifficultySchema,
  reasoning: z.string().trim().max(140).optional(),
  expected_resistance: z.string().trim().max(300).optional(),
  pain_addressed: z.string().trim().max(220).optional(),
  success_signal: z.string().trim().max(300).optional(),
  fallback_title: planBFieldsSchema.fallback_title.optional(),
  fallback_description: planBFieldsSchema.fallback_description.optional(),
  fallback_estimated_minutes: planBFieldsSchema.fallback_estimated_minutes.optional(),
});

export const goalBundleCreateInputSchema = z.object({
  idempotency_key: z.string().uuid().optional(),
  formulation_session_id: z.string().uuid().optional(),
  goal: goalCreateInputSchema,
  milestones: z.array(structuredGoalMilestoneSchema).max(12).default([]),
  initial_steps: z.array(structuredDailyBabyStepSchema.omit({goal_id: true})).max(6).default([]),
});

export const goalIdSchema = z.string().uuid();

const goalCreateResponseSchema = z.object({
  goal: z.object({id: goalIdSchema}).passthrough(),
});

export function parseGoalCreateResponse(payload: unknown): {goal: {id: string}} {
  const parsed = goalCreateResponseSchema.safeParse(payload);
  if (!parsed.success) {
    throw new Error('Invalid goal response from server.');
  }
  return {goal: parsed.data.goal};
}

export const aiStructureGoalRequestSchema = z.object({
  domain: lifeDomainSchema,
  domain_category: z.string().trim().min(1).max(120).optional(),
  raw_goal: z.string().trim().min(1).max(1000),
  deadline: optionalIsoDateSchema.optional().default(null),
  motivation: z.string().trim().max(2000).optional().default(''),
  constraints: z.string().trim().max(1000).optional().default(''),
});

const goalRealismRiskLevelSchema = z.enum(['low', 'medium', 'high']);

const goalRealismCheckSchema = z.object({
  risk_level: goalRealismRiskLevelSchema,
  risk_reason: z.string().trim().min(1).max(400),
  first_week_adjustment: z.string().trim().max(400).nullable().optional().default(null),
});

export const aiStructuredGoalResponseSchema = z.object({
  goal_title: z.string().trim().min(1).max(140),
  goal_description: z.string().trim().min(1).max(2000),
  success_metric: z.string().trim().min(1).max(280),
  deadline: optionalIsoDateSchema,
  milestones: z.array(structuredGoalMilestoneSchema).max(12),
  daily_baby_steps: z.array(goalBreakdownStepContractSchema).min(1).max(6),
  realism_check: goalRealismCheckSchema,
  next_best_action: nextBestActionSchema,
});

export type AiStructuredGoalResponse = z.infer<typeof aiStructuredGoalResponseSchema>;

export const aiGenerateDailyStepsRequestSchema = z.object({
  date: requiredIsoDateSchema.optional(),
  force: z.boolean().optional(),
  /** When set, only (re)generate pending AI steps for this life domain. */
  domain: lifeDomainSchema.optional(),
  /** After formulation completion — prepend a motivation-tuned first win step. */
  include_first_win: z.boolean().optional(),
});

export function aiGenerateDailyStepsResponseSchemaForMax(maxSteps: number) {
  const cap = Math.max(1, Math.min(3, maxSteps));
  return z.object({
    date: requiredIsoDateSchema,
    steps: z.array(aiDailyStepContractSchema).min(1).max(cap),
  });
}

export const dailyStepStatusUpdateSchema = z.object({
  status: dailyStepStatusSchema,
  blocker_reason: reflectionBlockerReasonSchema.nullable().optional().default(null),
  reflection_text: z.string().trim().max(1000).optional().default(''),
  actual_minutes: z.number().int().min(1).max(480).nullable().optional().default(null),
  blocker_category: z.enum(['external', 'internal', 'unclear']).nullable().optional().default(null),
  reattempt_same_day: z.boolean().optional().default(false),
  first_viewed_at: z.string().datetime().nullable().optional().default(null),
  coach_message_impression_at: z.string().datetime().nullable().optional().default(null),
  primary_cta_clicked_at: z.string().datetime().nullable().optional().default(null),
  read_description: z.boolean().optional().default(false),
  writing_duration_sec: z.number().int().min(0).max(86400).nullable().optional().default(null),
  reflection_word_count: z.number().int().min(0).nullable().optional().default(null),
  self_blame_language: z.boolean().optional().default(false),
  value_feedback: stepValueFeedbackSchema.nullable().optional().default(null),
});

export const skipRecoveryStepContentSchema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000),
  estimated_minutes: z.number().int().min(1).max(10),
  difficulty: dailyStepDifficultySchema,
});

export const skipRecoverySuggestInputSchema = z.object({
  locale: z.enum(['he', 'en']).optional(),
  blocker_reason: reflectionBlockerReasonSchema.nullable().optional(),
});

const skipCoachActionSchema = z.enum(['shrink_tomorrow', 'change_time', 'plan_b']);

export const skipCoachAdjustmentInputSchema = z.object({
  skip_date: requiredIsoDateSchema.optional(),
  step_id: z.string().uuid().nullable().optional(),
  goal_id: z.string().uuid().nullable().optional(),
  blocker_reason: reflectionBlockerReasonSchema.nullable().optional(),
  coach_action: skipCoachActionSchema,
});

export const reflectionCreateInputSchema = z.object({
  date: requiredIsoDateSchema,
  mood_score: scoreSchema.nullable().optional().default(null),
  energy_score: scoreSchema.nullable().optional().default(null),
  reflection_text: z.string().trim().max(2000).optional().default(''),
  blocker_reason: reflectionBlockerReasonSchema.nullable().optional().default(null),
  writing_duration_sec: z.number().int().min(0).max(86400).nullable().optional().default(null),
  reflection_word_count: z.number().int().min(0).nullable().optional().default(null),
  self_blame_language: z.boolean().optional().default(false),
});

const reflectionRiskSignalSchema = z.enum(['low', 'medium', 'high']);

export const reflectionAnalysisResponseSchema = z.object({
  patterns: z.array(z.string().trim().min(1).max(220)).max(5),
  recommendations: z.array(z.string().trim().min(1).max(220)).max(5),
  primary_emotion: z.string().trim().min(1).max(80),
  trigger: z.string().trim().min(1).max(120),
  blocker: z.string().trim().min(1).max(160),
  need: z.string().trim().min(1).max(120),
  recommended_adjustment: z.string().trim().min(1).max(220),
  risk_signal: reflectionRiskSignalSchema,
  next_day_adjustments: z.object({
    max_tasks: z.number().int().min(1).max(3),
    max_minutes_per_task: z.number().int().min(2).max(20),
    easy_only: z.boolean(),
  }),
  next_best_action: nextBestActionSchema,
});

const weeklyReviewEmotionalReflectionSchema = z.object({
  identity_proof: z.string().trim().min(1).max(280),
  comeback_evidence: z.string().trim().min(1).max(320),
  meaning_statement: z.string().trim().min(1).max(520),
  confidence_builder: z.string().trim().min(1).max(280),
  next_identity_action: z.string().trim().min(1).max(220),
});

const weeklyReviewRecurringPatternSchema = z.object({
  statement: z.string().trim().min(1).max(320),
  dominant_blocker: reflectionBlockerReasonSchema.nullable(),
});

export const weeklyReviewResponseSchema = z.object({
  completed_steps_count: z.number().int().min(0),
  domain_progress: z.array(
    z.object({
      domain: lifeDomainSchema,
      completed_steps: z.number().int().min(0),
      total_steps: z.number().int().min(0),
    })
  ).max(LIFE_DOMAINS.length),
  main_blocker: z.string().trim().min(1).max(220),
  strongest_domain: lifeDomainSchema.nullable(),
  weakest_domain: lifeDomainSchema.nullable(),
  recommended_adjustment: z.string().trim().min(1).max(240),
  summary: z.string().trim().min(1).max(500),
  emotional_reflection: weeklyReviewEmotionalReflectionSchema,
  recurring_pattern: weeklyReviewRecurringPatternSchema,
  progress_evidence: z.string().trim().min(1).max(280),
  next_best_action: nextBestActionSchema,
});

export type WeeklyReviewAiResponse = z.infer<typeof weeklyReviewResponseSchema>;
export const lifeContextStatusSchema = z.enum(LIFE_CONTEXT_STATUSES);
const riskLevelSchema = z.enum(RISK_LEVELS);
const riskActionSchema = z.enum(RISK_ACTIONS);

const riskAnswerSchema = z.union([z.literal(0), z.literal(1)]).nullable();

export const formulationSessionCreateSchema = z.object({
  locale: z.enum(['he', 'en']).optional(),
});

const boundariesAckSchema = z.object({
  can_stop: z.boolean(),
  can_skip: z.boolean(),
  can_edit_summary: z.boolean(),
});

const formulationMindBodySchema = z.object({
  sleep_changed: z.boolean().optional(),
  appetite_changed: z.boolean().optional(),
  body_tension: z.boolean().optional(),
  energy_changed: z.boolean().optional(),
  skipped: z.boolean().optional(),
  notes: z.string().trim().max(500).optional(),
});

const formulationDimensionsSchema = z.object({
  frequency_per_week: z.number().int().min(0).max(70).nullable().optional(),
  intensity_0_10: z.number().int().min(0).max(10).nullable().optional(),
  contexts: z.array(z.string().trim().min(1).max(80)).max(12).optional(),
  mind_body: formulationMindBodySchema.optional(),
  systems: z.array(z.string().trim().min(1).max(80)).max(8).optional(),
  systems_notes: z.string().trim().max(500).optional(),
  dimension_skips: z.array(z.string().trim().max(40)).max(4).optional(),
});

export const formulationApprovedSchema = z.object({
  presenting_concern_user_words: z.string().trim().min(1).max(2000),
  intensity_0_10: z.number().int().min(0).max(10).nullable(),
  contexts: z.array(z.string().trim().max(80)).max(12),
  stressors: z.array(z.string().trim().max(200)).max(12),
  maintaining_factors: z.array(z.string().trim().max(200)).max(12),
  existing_strengths: z.array(z.string().trim().max(200)).max(12),
  uncertainties: z.array(z.string().trim().max(200)).min(1).max(8),
  risk_screen: z.object({
    level: riskLevelSchema,
    action: riskActionSchema,
  }),
});

const coachHandoffSchema = z.object({
  value: z.string().trim().min(1).max(500),
  micro_goal_week: z.string().trim().min(1).max(500),
  anticipated_barrier: z.string().trim().max(500),
  plan_b: z.string().trim().max(500),
  do_not_touch: z.array(z.string().trim().max(200)).max(8),
});

const formulationCheckinPrefillSchema = z.object({
  energy_score: z.number().int().min(1).max(10).nullable().optional(),
  focus_score: z.number().int().min(1).max(10).nullable().optional(),
  selected_tags: z.array(z.string()).max(4).optional(),
  date: z.string().optional(),
  used: z.boolean().optional(),
});

const participantGenderSchema = z.enum(['female', 'male']);

const formulationPatchConsentSchema = z.object({
  phase: z.literal('consent'),
  life_context_statuses: z.array(lifeContextStatusSchema).min(1).max(6),
  life_context_status_note: z.string().trim().max(200).optional(),
  gender: participantGenderSchema,
  age: z.number().int().min(16).max(120).nullable(),
  age_prefer_not: z.boolean().optional(),
  boundaries_ack: boundariesAckSchema,
  consent_version: z.string().trim().min(1).max(20),
  next_phase: z.literal('risk'),
});

const formulationPatchRiskSchema = z.object({
  phase: z.literal('risk'),
  risk_q1: riskAnswerSchema,
  risk_q2: riskAnswerSchema,
  risk_follow_up_confirmed: z.boolean().nullable().optional(),
  presenting_concern_raw: z.string().trim().max(2000).optional(),
});

const passiveRatingItemSchema = z.object({
  key: z
    .string()
    .trim()
    .min(1)
    .max(80)
    .regex(/^[a-z][a-z0-9_]*$/),
  score: z.number().int().min(1).max(5),
});

const formulationPatchOpenSchema = z.object({
  phase: z.literal('open'),
  passive_ratings: z.array(passiveRatingItemSchema).min(1).max(40),
  next_phase: z.literal('dimensions'),
});

const priorQuestionAnswerSchema = z.object({
  key: z.string().trim().min(1).max(80),
  answer: z.string().trim().min(1).max(1000),
});

const formulationPatchDimensionsSchema = z.object({
  phase: z.literal('dimensions'),
  dimensions: formulationDimensionsSchema.optional(),
  checkin_prefill: formulationCheckinPrefillSchema.nullable().optional(),
  prior_question_key: z.string().trim().max(80).optional(),
  prior_question_answer: z.string().trim().max(1000).optional(),
  prior_question_answers: z.array(priorQuestionAnswerSchema).max(3).optional(),
  phases_skipped: z.array(z.string().trim().max(40)).optional(),
  next_phase: z.literal('exploration'),
});

const llmExplorationQuestionSchema = z.object({
  id: z
    .string()
    .trim()
    .regex(/^q\d{2}$/),
  text: z.string().trim().min(8).max(600),
  focus_area: z.string().trim().max(80).optional(),
});

const llmExplorationAnswerSchema = z.object({
  key: z
    .string()
    .trim()
    .regex(/^q\d{2}$/),
  score: z.number().int().min(1).max(5),
});

const formulationPatchExplorationSchema = z.object({
  phase: z.literal('exploration'),
  llm_exploration_questions: z.array(llmExplorationQuestionSchema).length(15).optional(),
  llm_exploration_answers: z.array(llmExplorationAnswerSchema).length(15).optional(),
  next_phase: z.literal('formulation'),
});

const formulationPatchFormulationSchema = z.object({
  phase: z.literal('formulation'),
  formulation_draft: formulationApprovedSchema.optional(),
  formulation_approved: formulationApprovedSchema,
  user_edited_formulation: z.boolean(),
  next_phase: z.literal('goal'),
});

const formulationPatchGoalSchema = z.object({
  phase: z.literal('goal'),
  coach_handoff: coachHandoffSchema,
  next_phase: z.literal('complete').optional(),
});

const formulationPatchNavigateSchema = z.object({
  phase: z.literal('navigate'),
  action: z.enum(['back', 'restart']),
});

export const formulationSessionPatchSchema = z.discriminatedUnion('phase', [
  formulationPatchConsentSchema,
  formulationPatchRiskSchema,
  formulationPatchOpenSchema,
  formulationPatchDimensionsSchema,
  formulationPatchExplorationSchema,
  formulationPatchFormulationSchema,
  formulationPatchGoalSchema,
  formulationPatchNavigateSchema,
]);

export const formulationAiActionSchema = z.object({
  action: z.enum([
    'generate_exploration_questions',
    'draft_formulation',
    'suggest_micro_goal',
  ]),
  locale: z.enum(['he', 'en']).optional(),
});

const scheduleTimeSchema = z.string().regex(/^\d{2}:\d{2}$/);

export const formulationProfilePatchSchema = z.object({
  life_context_statuses: z.array(lifeContextStatusSchema).min(0).max(6).optional(),
  gender: participantGenderSchema.nullable().optional(),
  age: z.number().int().min(16).max(120).nullable().optional(),
  wake_time: scheduleTimeSchema.nullable().optional(),
  sleep_time: scheduleTimeSchema.nullable().optional(),
  preferred_action_window: z.enum(['morning', 'midday', 'evening', 'flexible']).nullable().optional(),
  coaching_style: z.enum(['supportive', 'direct', 'motivational']).nullable().optional(),
  family_status: z.enum(['single', 'in_relationship', 'married', 'married_with_kids', 'other']).nullable().optional(),
  physical_considerations: z.array(z.enum(['low_intensity', 'physical_limitation', 'pregnancy_postpartum'])).nullable().optional(),
  life_context_note: z.string().trim().max(200).nullable().optional(),
});
