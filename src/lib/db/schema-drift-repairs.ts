/**
 * Incremental columns added after initial table creation. Table rebuild migrations
 * (goals v7, formulation_sessions v2) can drop these; repairSchemaDrift re-applies them
 * on every DB access so warm dev-server handles never miss a column.
 */
export type ColumnRepair = {
  table: string;
  column: string;
  definition: string;
};

export const INCREMENTAL_COLUMN_REPAIRS: ColumnRepair[] = [
  {table: 'morning_rituals', column: 'session_json', definition: 'TEXT'},
  {table: 'gratitude_entries', column: 'trigger_key', definition: 'TEXT'},
  {table: 'gratitude_entries', column: 'entry_duration_sec', definition: 'INTEGER'},
  {table: 'gratitude_entries', column: 'was_edited', definition: 'INTEGER DEFAULT 0'},
  {table: 'morning_rituals', column: 'mode', definition: 'TEXT'},
  {table: 'morning_rituals', column: 'selected_affirmation_id', definition: 'TEXT'},
  {table: 'morning_rituals', column: 'breathing_rounds_done', definition: 'INTEGER'},
  {table: 'morning_rituals', column: 'skipped_steps', definition: 'TEXT'},
  {table: 'morning_rituals', column: 'visualization_duration_sec', definition: 'INTEGER'},
  {table: 'checkins', column: 'session_duration_sec', definition: 'INTEGER'},
  {table: 'checkins', column: 'slider_adjustments', definition: 'INTEGER'},
  {table: 'checkins', column: 'opened_coach_support', definition: 'INTEGER DEFAULT 0'},
  {table: 'checkins', column: 'entry_json', definition: 'TEXT'},
  {table: 'daily_steps', column: 'completed_at', definition: 'TEXT'},
  {table: 'daily_steps', column: 'actual_minutes', definition: 'INTEGER'},
  {table: 'daily_steps', column: 'rescheduled_from', definition: 'TEXT'},
  {table: 'daily_steps', column: 'reschedule_count', definition: 'INTEGER DEFAULT 0'},
  {table: 'daily_steps', column: 'first_viewed_at', definition: 'TEXT'},
  {table: 'daily_steps', column: 'read_description', definition: 'INTEGER DEFAULT 0'},
  {table: 'daily_steps', column: 'fallback_title', definition: 'TEXT'},
  {table: 'daily_steps', column: 'fallback_description', definition: 'TEXT'},
  {table: 'daily_steps', column: 'fallback_estimated_minutes', definition: 'INTEGER'},
  {table: 'daily_steps', column: 'coach_message_impression_at', definition: 'TEXT'},
  {table: 'daily_steps', column: 'primary_cta_clicked_at', definition: 'TEXT'},
  {table: 'daily_steps', column: 'reasoning', definition: 'TEXT'},
  {table: 'daily_steps', column: 'expected_resistance', definition: 'TEXT'},
  {table: 'daily_steps', column: 'pain_addressed', definition: 'TEXT'},
  {table: 'daily_steps', column: 'success_signal', definition: 'TEXT'},
  {table: 'daily_steps', column: 'user_edited', definition: 'INTEGER DEFAULT 0'},
  {table: 'daily_steps', column: 'validation_fallback_applied', definition: 'INTEGER DEFAULT 0'},
  {table: 'daily_steps', column: 'coach_tone', definition: 'TEXT'},
  {table: 'daily_steps', column: 'weekly_focus_id', definition: 'TEXT'},
  {table: 'daily_steps', column: 'value_feedback', definition: 'TEXT'},
  {table: 'daily_steps', column: 'is_general', definition: 'INTEGER DEFAULT 0'},
  {table: 'user_behavior_profile', column: 'tone_effectiveness', definition: 'TEXT'},
  {table: 'user_behavior_profile', column: 'avoid_windows', definition: "TEXT DEFAULT '[]'"},
  {table: 'user_behavior_profile', column: 'best_windows', definition: "TEXT DEFAULT '[]'"},
  {table: 'user_behavior_profile', column: 'weekday_skip_patterns', definition: "TEXT DEFAULT '[]'"},
  {table: 'user_behavior_profile', column: 'failed_action_patterns', definition: "TEXT DEFAULT '[]'"},
  {table: 'daily_reflections', column: 'writing_duration_sec', definition: 'INTEGER'},
  {table: 'daily_reflections', column: 'analysis_json', definition: 'TEXT'},
  {table: 'daily_reflections', column: 'analyzed_at', definition: 'TEXT'},
  {table: 'daily_reflections', column: 'adjustment_applied_at', definition: 'TEXT'},
  {table: 'goals', column: 'completed_at', definition: 'TEXT'},
  {table: 'goals', column: 'revision_count', definition: 'INTEGER DEFAULT 0'},
  {table: 'milestones', column: 'completed_at', definition: 'TEXT'},
  {table: 'ai_insights', column: 'tokens_used', definition: 'INTEGER'},
  {table: 'ai_insights', column: 'generation_duration_ms', definition: 'INTEGER'},
  {table: 'ai_insights', column: 'model_used', definition: 'TEXT'},
  {table: 'ai_insights', column: 'plan_adjustments_applied_at', definition: 'TEXT'},
  {table: 'checkins', column: 'priority_action_word_count', definition: 'INTEGER'},
  {table: 'checkins', column: 'rewrote_priority_action_count', definition: 'INTEGER DEFAULT 0'},
  {table: 'checkins', column: 'tag_valence_shift', definition: 'INTEGER'},
  {table: 'checkins', column: 'energy_focus_divergence', definition: 'INTEGER'},
  {table: 'checkins', column: 'physical_complaint_mentioned', definition: 'INTEGER DEFAULT 0'},
  {table: 'checkins', column: 'help_engagement_depth', definition: 'TEXT'},
  {table: 'checkins', column: 'stated_action_completed', definition: 'INTEGER'},
  {table: 'morning_rituals', column: 'gratitude_generic_flags', definition: 'TEXT'},
  {table: 'morning_rituals', column: 'gratitude_target_types', definition: 'TEXT'},
  {table: 'morning_rituals', column: 'mission_changed_from_yesterday', definition: 'INTEGER DEFAULT 0'},
  {table: 'morning_rituals', column: 'breathing_full_pattern_done', definition: 'INTEGER DEFAULT 0'},
  {table: 'morning_rituals', column: 'visualization_content_type', definition: 'TEXT'},
  {table: 'daily_reflections', column: 'reflection_word_count', definition: 'INTEGER'},
  {table: 'daily_reflections', column: 'self_blame_language', definition: 'INTEGER DEFAULT 0'},
  {table: 'daily_steps', column: 'blocker_category', definition: 'TEXT'},
  {table: 'daily_steps', column: 'reattempt_same_day', definition: 'INTEGER DEFAULT 0'},
  {table: 'goals', column: 'abandoned_before_first_step', definition: 'INTEGER DEFAULT 0'},
  {table: 'goals', column: 'success_metric_specificity', definition: 'TEXT'},
  {table: 'users', column: 'life_context_status', definition: 'TEXT'},
  {table: 'users', column: 'last_completed_formulation_at', definition: 'TEXT'},
  {table: 'users', column: 'formulation_gate_dismissed', definition: 'INTEGER DEFAULT 0'},
  {table: 'users', column: 'gender', definition: 'TEXT'},
  {table: 'users', column: 'age', definition: 'INTEGER'},
  {table: 'formulation_sessions', column: 'participant_gender', definition: 'TEXT'},
  {table: 'formulation_sessions', column: 'participant_age', definition: 'INTEGER'},
  {table: 'formulation_sessions', column: 'life_context_statuses_json', definition: 'TEXT'},
  {table: 'formulation_sessions', column: 'prior_question_answers_json', definition: 'TEXT'},
  {table: 'formulation_sessions', column: 'passive_ratings_json', definition: 'TEXT'},
  {table: 'formulation_sessions', column: 'rating_follow_ups_json', definition: 'TEXT'},
  {table: 'formulation_sessions', column: 'llm_exploration_questions_json', definition: 'TEXT'},
  {table: 'formulation_sessions', column: 'llm_exploration_answers_json', definition: 'TEXT'},
  {table: 'formulation_sessions', column: 'suggested_domain', definition: 'TEXT'},
  {table: 'formulation_sessions', column: 'created_goal_id', definition: 'TEXT'},
  {table: 'users', column: 'stripe_customer_id', definition: 'TEXT'},
  {table: 'users', column: 'trial_ends_at', definition: 'TEXT'},
  {table: 'users', column: 'wake_time', definition: 'TEXT'},
  {table: 'users', column: 'sleep_time', definition: 'TEXT'},
  {table: 'users', column: 'preferred_action_window', definition: 'TEXT'},
  {table: 'users', column: 'coaching_style', definition: 'TEXT'},
  {table: 'users', column: 'family_status', definition: 'TEXT'},
  {table: 'users', column: 'physical_considerations', definition: 'TEXT'},
  {table: 'users', column: 'life_context_note', definition: 'TEXT'},
  {table: 'users', column: 'onboarding_completed_at', definition: 'TEXT'},
  {table: 'users', column: 'onboarding_primary_domain', definition: 'TEXT'},
  {table: 'users', column: 'ai_personalization_summary', definition: 'TEXT'},
  {table: 'users', column: 'clerk_id', definition: 'TEXT'},
  {table: 'evening_resets', column: 'tomorrow_constraint', definition: 'TEXT'},
  {table: 'evening_resets', column: 'what_worked', definition: 'TEXT'},
  {table: 'evening_resets', column: 'what_failed', definition: 'TEXT'},
  {table: 'evening_resets', column: 'energy_forecast', definition: 'TEXT'},
  {table: 'evening_resets', column: 'tomorrow_takeaway', definition: 'TEXT'},
  {table: 'goals', column: 'commitment_days', definition: 'INTEGER DEFAULT 30'},
  {table: 'goals', column: 'commitment_started_at', definition: 'TEXT'},
  {table: 'goals', column: 'create_idempotency_key', definition: 'TEXT'},
];

export type IndexRepair = {
  table: string;
  columns: string[];
  sql: string;
};

export const INCREMENTAL_INDEX_REPAIRS: IndexRepair[] = [
  {
    table: 'formulation_sessions',
    columns: ['user_id', 'status'],
    sql: `CREATE INDEX IF NOT EXISTS idx_formulation_user_status ON formulation_sessions(user_id, status)`,
  },
  {
    table: 'formulation_sessions',
    columns: ['user_id', 'completed_at'],
    sql: `CREATE INDEX IF NOT EXISTS idx_formulation_user_completed ON formulation_sessions(user_id, completed_at DESC)`,
  },
  {
    table: 'users',
    columns: ['clerk_id'],
    sql: `CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id)`,
  },
  {
    table: 'goals',
    columns: ['user_id', 'create_idempotency_key'],
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_create_idempotency
       ON goals(user_id, create_idempotency_key)
       WHERE create_idempotency_key IS NOT NULL`,
  },
  {
    table: 'daily_steps',
    columns: ['user_id', 'goal_id', 'scheduled_date', 'generated_by_ai'],
    sql: `CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_steps_commitment_goal_date
       ON daily_steps(user_id, goal_id, scheduled_date)
       WHERE generated_by_ai = 0 AND goal_id IS NOT NULL`,
  },
];

export function tableExists(db: {prepare: (sql: string) => {get: (name: string) => unknown}}, table: string): boolean {
  const row = db.prepare(
    `SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`
  ).get(table) as {ok: number} | undefined;
  return !!row?.ok;
}

export function listTableColumns(
  db: {pragma: (sql: string) => unknown},
  table: string
): string[] {
  return (db.pragma(`table_info(${table})`) as Array<{name: string}>).map((c) => c.name);
}

export function findMissingIncrementalColumns(
  db: {pragma: (sql: string) => unknown; prepare: (sql: string) => {get: (name: string) => unknown}}
): ColumnRepair[] {
  return INCREMENTAL_COLUMN_REPAIRS.filter(({table, column}) => {
    if (!tableExists(db, table)) return false;
    return !listTableColumns(db, table).includes(column);
  });
}

/** Markers in trigger SQL that mean the trigger predates a table drop and must be recreated. */
const STALE_DELETE_TRIGGER_MARKERS = ['health_phases'] as const;

const TRG_GOALS_DELETE_DEPENDENTS = `CREATE TRIGGER trg_goals_delete_dependents
AFTER DELETE ON goals
BEGIN
  DELETE FROM milestones WHERE goal_id = OLD.id;
  DELETE FROM daily_steps WHERE goal_id = OLD.id;
  DELETE FROM weekly_goal_focus WHERE goal_id = OLD.id;
END`;

const TRG_USERS_DELETE_DEPENDENTS = `CREATE TRIGGER trg_users_delete_dependents
AFTER DELETE ON users
BEGIN
  DELETE FROM checkins WHERE user_id = OLD.id;
  DELETE FROM gratitude_entries WHERE user_id = OLD.id;
  DELETE FROM morning_rituals WHERE user_id = OLD.id;
  DELETE FROM ritual_content WHERE user_id = OLD.id;
  DELETE FROM domain_assessments WHERE user_id = OLD.id;
  DELETE FROM daily_reflections WHERE user_id = OLD.id;
  DELETE FROM milestones WHERE user_id = OLD.id;
  DELETE FROM daily_steps WHERE user_id = OLD.id;
  DELETE FROM goals WHERE user_id = OLD.id;
  DELETE FROM weekly_reviews WHERE user_id = OLD.id;
  DELETE FROM skip_coach_adjustments WHERE user_id = OLD.id;
  DELETE FROM weekly_goal_focus WHERE user_id = OLD.id;
  DELETE FROM ai_insights WHERE user_id = OLD.id;
  DELETE FROM streaks WHERE user_id = OLD.id;
  DELETE FROM formulation_sessions WHERE user_id = OLD.id;
  DELETE FROM evening_resets WHERE user_id = OLD.id;
  DELETE FROM user_behavior_profile WHERE user_id = OLD.id;
  DELETE FROM gamification_unlocks WHERE user_id = OLD.id;
END`;

type DeleteTriggerRepair = {
  name: string;
  createSql: string;
  requiredFragments: string[];
};

const DELETE_TRIGGER_REPAIRS: DeleteTriggerRepair[] = [
  {
    name: 'trg_goals_delete_dependents',
    createSql: TRG_GOALS_DELETE_DEPENDENTS,
    requiredFragments: ['weekly_goal_focus'],
  },
  {
    name: 'trg_users_delete_dependents',
    createSql: TRG_USERS_DELETE_DEPENDENTS,
    requiredFragments: ['evening_resets', 'gamification_unlocks', 'skip_coach_adjustments'],
  },
];

function readTriggerSql(
  db: {prepare: (sql: string) => {get: (name: string) => unknown}},
  name: string
): string | null {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'trigger' AND name = ?`)
    .get(name) as {sql: string | null} | undefined;
  return row?.sql ?? null;
}

export function deleteTriggerNeedsRepair(
  db: {prepare: (sql: string) => {get: (name: string) => unknown}},
  repair: DeleteTriggerRepair
): boolean {
  const sql = readTriggerSql(db, repair.name);
  if (!sql) return false;
  if (STALE_DELETE_TRIGGER_MARKERS.some((marker) => sql.includes(marker))) return true;
  return !repair.requiredFragments.every((fragment) => sql.includes(fragment));
}

/**
 * `CREATE TRIGGER IF NOT EXISTS` never updates an existing trigger body. After
 * dropping `health_phases`, older local DBs still fire stale delete triggers.
 */
export function repairDeleteTriggers(db: {exec: (sql: string) => void; prepare: (sql: string) => {get: (name: string) => unknown}}): void {
  for (const repair of DELETE_TRIGGER_REPAIRS) {
    if (!deleteTriggerNeedsRepair(db, repair)) continue;
    db.exec(`DROP TRIGGER IF EXISTS ${repair.name}`);
    db.exec(repair.createSql);
  }
}
