export const LIFE_DOMAINS = [
  'health', 'time', 'wealth', 'career', 'relationships', 'mind', 'spirit', 'house_family',
] as const;
export type LifeDomain = (typeof LIFE_DOMAINS)[number];

export const AVAILABLE_TIME_OPTIONS = [5, 10, 20, 30] as const;
export type AvailableTimePerDay = (typeof AVAILABLE_TIME_OPTIONS)[number];

export const INTENSITY_PREFERENCES = ['gentle', 'balanced', 'intense'] as const;
export type IntensityPreference = (typeof INTENSITY_PREFERENCES)[number];

export const GOAL_STATUSES = ['active', 'completed', 'paused', 'archived'] as const;
type GoalStatus = (typeof GOAL_STATUSES)[number];

export const GOAL_CREATED_BY = ['user', 'ai'] as const;
type GoalCreatedBy = (typeof GOAL_CREATED_BY)[number];

export const MILESTONE_STATUSES = ['pending', 'completed'] as const;
type MilestoneStatus = (typeof MILESTONE_STATUSES)[number];

export const DAILY_STEP_STATUSES = ['pending', 'completed', 'skipped', 'partial'] as const;
export type DailyStepStatus = (typeof DAILY_STEP_STATUSES)[number];

export const DAILY_STEP_DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
export type DailyStepDifficulty = (typeof DAILY_STEP_DIFFICULTIES)[number];

export const REFLECTION_BLOCKER_REASONS = [
  'no_time', 'forgot', 'low_energy', 'unclear_task', 'emotional_resistance', 'family_chaos', 'other',
] as const;
export type ReflectionBlockerReason = (typeof REFLECTION_BLOCKER_REASONS)[number];

/** Post-completion value check — did the step actually help? */
export const STEP_VALUE_FEEDBACK_OPTIONS = [
  'felt_progress',
  'too_small',
  'too_generic',
  'missed_problem',
] as const;
export type StepValueFeedback = (typeof STEP_VALUE_FEEDBACK_OPTIONS)[number];

export const INSIGHT_TYPES = ['pattern', 'recommendation', 'weekly_review'] as const;
type InsightType = (typeof INSIGHT_TYPES)[number];

export const DOMAIN_BLOCKERS = [
  'low_energy', 'kids', 'no_time', 'money_pressure', 'lack_of_clarity', 'self_doubt', 'environment', 'consistency',
] as const;
export type DomainBlocker = (typeof DOMAIN_BLOCKERS)[number];

export const WEIGHT_DIRECTIONS = ['gain', 'loss', 'maintain'] as const;
export type WeightDirection = (typeof WEIGHT_DIRECTIONS)[number];

export const HEALTH_SECONDARY_FOCUSES = ['weight_gain', 'weight_loss'] as const;
export type HealthSecondaryFocus = (typeof HEALTH_SECONDARY_FOCUSES)[number];

export const HEALTH_PLAN_SOURCES = ['ai', 'fallback'] as const;
export type HealthPlanSource = (typeof HEALTH_PLAN_SOURCES)[number];

export const HEALTH_ANCHOR_HABITS = [
  'morning_coffee', 'commute', 'before_shower', 'before_sleep',
  'lunch_break', 'after_kids_school', 'before_evening_meal', 'after_work', 'custom',
] as const;
export type HealthAnchorHabit = (typeof HEALTH_ANCHOR_HABITS)[number];

export const HEALTH_CATEGORIES = [
  'fitness', 'sleep', 'nutrition', 'weight', 'energy', 'specific_illness',
] as const;
export type HealthCategory = (typeof HEALTH_CATEGORIES)[number];

// ---------------------------------------------------------------------------
// Health plan types
// ---------------------------------------------------------------------------

type HealthPlanTaskTemplate = {
  title: string;
  description: string;
  estimated_minutes: number;
  difficulty: DailyStepDifficulty;
  day_of_week?: number;
};

export type HealthPlanPhase = {
  start_day: number;
  end_day: number;
  focus: string;
  task_templates: HealthPlanTaskTemplate[];
  weigh_in?: boolean;
};

export type HealthExecutionPlan = {
  phases: HealthPlanPhase[];
};

export type HealthGoalAnchor = {
  habit_key: HealthAnchorHabit;
  time?: string;
  custom_label?: string;
};

export type HealthGoalContext = {
  category: HealthCategory;
  metrics: {
    category: HealthCategory;
    baseline_value: number;
    target_value: number;
  };
  weight_direction?: WeightDirection;
  secondary_focus?: HealthSecondaryFocus;
  current_kg?: number;
  target_kg?: number;
  timeline: {
    days_30: string;
    days_60: string;
    days_90: string;
  };
  why_deep: {
    why_important: string;
    why_now: string;
    what_lost: string;
  };
  anchor?: HealthGoalAnchor;
  execution_plan?: HealthExecutionPlan;
  plan_source?: HealthPlanSource;
};

// ---------------------------------------------------------------------------
// Core domain types
// ---------------------------------------------------------------------------

export type UserProfile = {
  id: string;
  email: string | null;
  preferred_language: 'en' | 'he';
  timezone: string;
  gender: string | null;
  age: number | null;
  life_context_statuses: LifeContextStatus[];
  life_context_note?: string | null;
  wake_time?: string | null;
  sleep_time?: string | null;
  preferred_action_window?: import('@/lib/user-preferences').PreferredActionWindow | null;
  coaching_style?: import('@/lib/user-preferences').CoachingStyle | null;
  family_status?: import('@/lib/user-preferences').FamilyStatus | null;
  physical_considerations?: import('@/lib/user-preferences').PhysicalConsideration[] | null;
  ai_personalization_summary?: import('@/lib/ai-personalization-summary').AiPersonalizationSummary | null;
  created_at: string;
  updated_at: string;
};

export type LifeDomainState = {
  id: string;
  user_id: string;
  domain: LifeDomain;
  current_score: number;
  current_state: string;
  desired_state: string;
  main_blockers: string[];
  available_time_per_day: AvailableTimePerDay;
  intensity_preference: IntensityPreference;
  created_at: string;
  updated_at: string;
};

export type Goal = {
  id: string;
  user_id: string;
  domain: LifeDomain;
  domain_category?: string | null;
  title: string;
  description: string;
  success_metric: string;
  deadline: string | null;
  commitment_days?: number | null;
  commitment_started_at?: string | null;
  status: GoalStatus;
  created_by: GoalCreatedBy;
  health_context: HealthGoalContext | null;
  created_at: string;
  updated_at: string;
  // Raw behavioral metrics
  completed_at?: string | null;
  revision_count?: number;
  // Psychological metrics
  abandoned_before_first_step?: number;
  success_metric_specificity?: 'measurable' | 'vague' | 'absent';
};

export type Milestone = {
  id: string;
  goal_id: string;
  title: string;
  description: string;
  target_date: string | null;
  /** Day marker within the 90-day plan: 30, 60, or 90. */
  day_marker?: number | null;
  status: MilestoneStatus;
  created_at: string;
  // Raw behavioral metrics
  completed_at?: string | null;
};

export type DailyBabyStep = {
  id: string;
  user_id: string;
  goal_id: string | null;
  domain: LifeDomain;
  title: string;
  description: string;
  estimated_minutes: number;
  difficulty: DailyStepDifficulty;
  scheduled_date: string;
  status: DailyStepStatus;
  generated_by_ai: boolean;
  /** Domain-level action without a specific goal. Non-general steps require goal_id. */
  is_general: boolean;
  created_at: string;
  updated_at: string;
  /** Human-readable explanation of why this step was chosen (shown in UI) */
  reasoning?: string | null;
  expected_resistance?: string | null;
  /** Internal — which pain/friction this step reduces (not shown in UI). */
  pain_addressed?: string | null;
  success_signal?: string | null;
  user_edited?: boolean;
  validation_fallback_applied?: boolean;
  coach_tone?: import('@/lib/user-preferences').CoachingStyle | null;
  weekly_focus_id?: string | null;
  // Raw behavioral metrics
  completed_at?: string | null;
  actual_minutes?: number | null;
  rescheduled_from?: string | null;
  reschedule_count?: number;
  first_viewed_at?: string | null;
  coach_message_impression_at?: string | null;
  primary_cta_clicked_at?: string | null;
  read_description?: boolean;
  reflection_text?: string | null;
  blocker_reason?: ReflectionBlockerReason | null;
  // Psychological metrics
  blocker_category?: 'external' | 'internal' | 'unclear' | null;
  reattempt_same_day?: boolean;
  fallback_title?: string | null;
  fallback_description?: string | null;
  fallback_estimated_minutes?: number | null;
  /** Post-completion: did this step create real value? */
  value_feedback?: StepValueFeedback | null;
};

export type DailyReflection = {
  id: string;
  user_id: string;
  date: string;
  mood_score: number | null;
  energy_score: number | null;
  reflection_text: string | null;
  blocker_reason: ReflectionBlockerReason | null;
  created_at: string;
  // Raw behavioral metrics
  writing_duration_sec?: number | null;
  // Psychological metrics
  reflection_word_count?: number | null;
  self_blame_language?: boolean;
  analysis?: import('@/lib/reflection-analysis/types').ReflectionAnalysis | null;
  analyzed_at?: string | null;
  adjustment_applied_at?: string | null;
};

export type AiCoachingInsight = {
  id: string;
  user_id: string;
  insight_type: InsightType;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
  // Raw behavioral metrics
  tokens_used?: number | null;
  generation_duration_ms?: number | null;
  model_used?: string | null;
};

// ---------------------------------------------------------------------------
// Structured / AI response types
// ---------------------------------------------------------------------------

export type StructuredGoalMilestone = {
  title: string;
  description: string;
  target_date: string | null;
};


export type StructuredDailyBabyStep = {
  domain: LifeDomain;
  goal_id: string | null;
  is_general?: boolean;
  title: string;
  description: string;
  estimated_minutes: number;
  difficulty: DailyStepDifficulty;
  /** Links step to the weekly focus that anchored generation */
  weekly_focus_id?: string | null;
  /** Human-readable explanation of why this specific step was chosen today */
  reasoning?: string;
  expected_resistance?: string;
  pain_addressed?: string;
  success_signal?: string;
  fallback_title?: string;
  fallback_description?: string;
  fallback_estimated_minutes?: number;
  validation_fallback_applied?: boolean;
  vague_task_rewritten?: boolean;
  value_gate_repaired?: boolean;
  value_gate_score?: number;
};

type GoalRealismRiskLevel = 'low' | 'medium' | 'high';

export type GoalRealismCheck = {
  risk_level: GoalRealismRiskLevel;
  risk_reason: string;
  first_week_adjustment: string | null;
  adjusted: boolean;
};

export type NextBestAction = import('@/lib/next-best-action').NextBestAction;

export type StructuredGoalPlan = {
  goal_title: string;
  goal_description: string;
  success_metric: string;
  deadline: string | null;
  milestones: StructuredGoalMilestone[];
  daily_baby_steps: Array<Omit<StructuredDailyBabyStep, 'domain' | 'goal_id'>>;
  execution_plan?: HealthExecutionPlan | null;
  plan_source?: HealthPlanSource;
  realism_check?: GoalRealismCheck | null;
  next_best_action?: NextBestAction | null;
};

// ---------------------------------------------------------------------------
// Composite / UI types
// ---------------------------------------------------------------------------

export type DomainCardSummary = {
  domain: LifeDomain;
  current_score: number | null;
  active_goals_count: number;
  today_baby_step_status: 'none' | 'pending' | 'completed' | 'mixed';
  progress_percent: number;
};

export type WeeklyReviewEmotionalReflection = {
  identity_proof: string;
  comeback_evidence: string;
  meaning_statement: string;
  confidence_builder: string;
  next_identity_action: string;
};

export type WeeklyReviewRecurringPattern = {
  statement: string;
  dominant_blocker: ReflectionBlockerReason | null;
};

export type WeeklyReview = {
  completed_steps_count: number;
  domain_progress: Array<{
    domain: LifeDomain;
    completed_steps: number;
    total_steps: number;
  }>;
  main_blocker: string;
  strongest_domain: LifeDomain | null;
  weakest_domain: LifeDomain | null;
  recommended_adjustment: string;
  summary: string;
  period_start?: string;
  period_end?: string;
  pattern_insights?: string[];
  pattern_mining?: WeeklyPatternMining;
  plan_adjustments?: WeeklyPlanAdjustments;
  plan_adjustments_applied_at?: string | null;
  emotional_reflection?: WeeklyReviewEmotionalReflection;
  recurring_pattern?: WeeklyReviewRecurringPattern;
  /** One-sentence concrete proof of progress — shown as a quote card in UI. */
  progress_evidence?: string;
  next_best_action?: NextBestAction | null;
};

export type WeeklyPlanAdjustments = {
  max_minutes_per_task: number;
  easy_only_bias: boolean;
  cap_tasks: number | null;
  emphasize_domains: LifeDomain[];
  deemphasize_domains: LifeDomain[];
  preferred_action_window: import('@/lib/user-preferences').PreferredActionWindow | null;
  rationale?: string;
};

export type WeeklyPatternMining = {
  by_energy: Array<{
    bucket: 'low' | 'mid' | 'high';
    threshold: string;
    completed: number;
    total: number;
    rate: number;
  }>;
  by_minutes: Array<{
    bucket: 'short' | 'long';
    label: string;
    energy_bucket?: 'low' | 'mid' | 'high';
    completed: number;
    total: number;
    rate: number;
  }>;
  by_domain: Array<{
    domain: LifeDomain;
    completed: number;
    total: number;
    rate: number;
  }>;
  by_time_window: Array<{
    window: import('@/lib/user-preferences').PreferredActionWindow;
    completed: number;
    total: number;
    rate: number;
  }>;
  insights: string[];
  plan_adjustments: WeeklyPlanAdjustments;
};

export type {
  ReflectionAnalysis,
} from '@/lib/reflection-analysis/types';

// ---------------------------------------------------------------------------
// Domain goal wizard types
// ---------------------------------------------------------------------------

export type NonHealthDomain = Exclude<LifeDomain, 'health'>;

export const DOMAIN_CATEGORIES: Record<LifeDomain, string[]> = {
  health: ['fitness', 'sleep', 'nutrition', 'energy', 'weight', 'recovery', 'medical_routine'],
  time: ['morning_routine', 'deep_work', 'priorities', 'delegation', 'digital_detox', 'weekly_planning', 'procrastination', 'work_life_balance'],
  wealth: ['savings', 'income_growth', 'debt_reduction', 'investment', 'spending_habits', 'emergency_fund', 'financial_education'],
  career: ['skill_development', 'visibility', 'promotion', 'side_project', 'networking', 'leadership', 'work_quality'],
  relationships: ['partnership', 'family_time', 'friendships', 'communication', 'conflict_resolution', 'social_life', 'boundaries'],
  mind: ['focus', 'emotional_regulation', 'self_talk', 'stress_management', 'learning', 'creativity', 'mindfulness'],
  spirit: ['purpose', 'values', 'gratitude', 'spiritual_practice', 'inner_peace', 'meaning', 'community'],
  house_family: ['home_order', 'family_routines', 'chores', 'home_improvement', 'family_goals', 'environment'],
};

// ---------------------------------------------------------------------------
// Streak types
// ---------------------------------------------------------------------------

export type StreakInfo = {
  current_streak: number;
  longest_streak: number;
  total_completed: number;
  total_steps: number;
  consistency_rate: number;
  grace_days_used?: number;
};

// ---------------------------------------------------------------------------
// Formulation session (therapeutic clarification)
// ---------------------------------------------------------------------------

export const FORMULATION_SESSION_STATUSES = [
  'draft',
  'completed',
  'abandoned',
  'crisis_stopped',
  'skipped_after_consent',
] as const;
type FormulationSessionStatus = (typeof FORMULATION_SESSION_STATUSES)[number];

export const FORMULATION_PHASES = [
  'consent',
  'risk',
  'open',
  'dimensions',
  'exploration',
  'formulation',
  'goal',
  'complete',
] as const;
export type FormulationPhase = (typeof FORMULATION_PHASES)[number];

export const LIFE_CONTEXT_STATUSES = [
  'student',
  'new_parent',
  'manager',
  'caregiver',
  'between_jobs',
  'other',
  'prefer_not',
] as const;
export type LifeContextStatus = (typeof LIFE_CONTEXT_STATUSES)[number];

export const RISK_LEVELS = ['none', 'elevated', 'crisis'] as const;
export type RiskLevel = (typeof RISK_LEVELS)[number];

export const RISK_ACTIONS = ['continue', 'resources', 'stop'] as const;
export type RiskAction = (typeof RISK_ACTIONS)[number];

type RiskAnswer = 0 | 1 | null;

type FormulationBoundariesAck = {
  can_stop: boolean;
  can_skip: boolean;
  can_edit_summary: boolean;
};

type FormulationMindBody = {
  sleep_changed?: boolean;
  appetite_changed?: boolean;
  body_tension?: boolean;
  energy_changed?: boolean;
  skipped?: boolean;
  notes?: string;
};

type PassiveRatingItem = {
  key: string;
  score: number;
};

export type LlmExplorationQuestion = {
  id: string;
  text: string;
  focus_area?: string;
};

export type LlmExplorationAnswer = {
  key: string;
  score: number;
};

export type RatingFollowUpItem = {
  key: string;
  questionKey: string;
  weight: number;
  /** Step-3 rating that triggered this chip question; null if context-only. */
  source_rating_key: string | null;
};

export type FormulationDimensions = {
  frequency_per_week?: number | null;
  intensity_0_10?: number | null;
  contexts?: string[];
  mind_body?: FormulationMindBody;
  systems?: string[];
  systems_notes?: string;
  dimension_skips?: string[];
};

type FormulationRiskScreenSnapshot = {
  level: RiskLevel;
  action: RiskAction;
};

export type FormulationApproved = {
  presenting_concern_user_words: string;
  intensity_0_10: number | null;
  contexts: string[];
  stressors: string[];
  maintaining_factors: string[];
  existing_strengths: string[];
  uncertainties: string[];
  risk_screen: FormulationRiskScreenSnapshot;
};

export type CoachHandoff = {
  value: string;
  micro_goal_week: string;
  anticipated_barrier: string;
  plan_b: string;
  do_not_touch: string[];
  /** Optional: life domain most relevant to this formulation (e.g. 'health'). */
  suggested_domain?: string | null;
};

type FormulationCheckinPrefill = {
  energy_score?: number | null;
  focus_score?: number | null;
  selected_tags?: string[];
  date?: string;
  used?: boolean;
};

export type FormulationSession = {
  id: string;
  user_id: string;
  locale: 'he' | 'en';
  status: FormulationSessionStatus;
  current_phase: FormulationPhase;
  life_context_status: LifeContextStatus | null;
  life_context_statuses: LifeContextStatus[];
  life_context_status_note: string | null;
  participant_gender: string | null;
  participant_age: number | null;
  prior_question_answers: Array<{key: string; answer: string}>;
  llm_exploration_questions: LlmExplorationQuestion[];
  llm_exploration_answers: LlmExplorationAnswer[];
  consent_accepted_at: string | null;
  consent_version: string | null;
  boundaries_ack: FormulationBoundariesAck | null;
  risk_q1: RiskAnswer;
  risk_q2: RiskAnswer;
  risk_follow_up_confirmed: number | null;
  risk_level: RiskLevel | null;
  risk_action: RiskAction | null;
  risk_screen_at: string | null;
  presenting_concern_raw: string | null;
  presenting_concern_user_words: string | null;
  reflection_llm_text: string | null;
  passive_ratings: PassiveRatingItem[];
  rating_follow_ups: RatingFollowUpItem[];
  dimensions: FormulationDimensions | null;
  formulation_draft: FormulationApproved | null;
  formulation_approved: FormulationApproved | null;
  user_edited_formulation: boolean;
  formulation_approved_at: string | null;
  coach_handoff: CoachHandoff | null;
  checkin_prefill: FormulationCheckinPrefill | null;
  phases_skipped: string[];
  prior_question_key: string | null;
  prior_question_answer: string | null;
  last_ai_action: string | null;
  last_ai_tokens: number | null;
  last_ai_model: string | null;
  last_ai_duration_ms: number | null;
  started_at: string;
  completed_at: string | null;
  updated_at: string;
  duration_sec: number | null;
};

export type FormulationGateResponse = {
  required: boolean;
  reason?: string;
  draft_id?: string | null;
  latest_completed_id?: string | null;
};
