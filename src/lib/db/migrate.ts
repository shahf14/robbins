import type Database from 'better-sqlite3';
import {migrateFormulationSessionsExplorationPhase} from './migrations/formulation-sessions-exploration';

type MigrationDb = Database.Database;

/**
 * Add a column only if it is not already present.
 *
 * This replaces the previous `try { ALTER … } catch {}` idiom: by checking
 * `PRAGMA table_info` first we run the ALTER exactly once, and any *genuine*
 * failure (disk error, locked DB, constraint violation) now propagates instead
 * of being swallowed and indistinguishable from "column already exists".
 */
function addColumn(db: MigrationDb, table: string, column: string, definition: string): void {
  // `table` is always a hardcoded constant from the migration list below — no injection surface.
  const cols = db.pragma(`table_info(${table})`) as Array<{name: string}>;
  if (cols.some((c) => c.name === column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

/**
 * Baseline migration: every column / table / index / backfill that was
 * historically applied by the inline block in `getDb()`. It is fully
 * idempotent — `addColumn` introspects, all CREATEs use `IF NOT EXISTS`, and
 * backfills are guarded by `WHERE … IS NULL` — so it runs harmlessly once on
 * already-migrated databases and is then skipped via `user_version`.
 *
 * Runs inside a single transaction (see `runMigrations`).
 */
function applyBaseline(db: MigrationDb): void {
  addColumn(db, 'goals', 'health_context_json', 'TEXT');
  addColumn(db, 'morning_rituals', 'session_json', 'TEXT');
  addColumn(db, 'goals', 'freestyle_times_per_day', 'INTEGER');
  addColumn(db, 'goals', 'freestyle_target_days', 'INTEGER');

  // ── Raw behavioral metrics (2025) ─────────────────────────────────────
  addColumn(db, 'gratitude_entries', 'trigger_key', 'TEXT');
  addColumn(db, 'gratitude_entries', 'entry_duration_sec', 'INTEGER');
  addColumn(db, 'gratitude_entries', 'was_edited', 'INTEGER DEFAULT 0');
  addColumn(db, 'morning_rituals', 'mode', 'TEXT');
  addColumn(db, 'morning_rituals', 'selected_affirmation_id', 'TEXT');
  addColumn(db, 'morning_rituals', 'breathing_rounds_done', 'INTEGER');
  addColumn(db, 'morning_rituals', 'skipped_steps', 'TEXT');
  addColumn(db, 'morning_rituals', 'visualization_duration_sec', 'INTEGER');
  addColumn(db, 'checkins', 'session_duration_sec', 'INTEGER');
  addColumn(db, 'checkins', 'slider_adjustments', 'INTEGER');
  addColumn(db, 'checkins', 'opened_coach_support', 'INTEGER DEFAULT 0');
  addColumn(db, 'checkins', 'entry_json', 'TEXT');
  addColumn(db, 'daily_steps', 'completed_at', 'TEXT');
  addColumn(db, 'daily_steps', 'actual_minutes', 'INTEGER');
  addColumn(db, 'daily_steps', 'rescheduled_from', 'TEXT');
  addColumn(db, 'daily_steps', 'reschedule_count', 'INTEGER DEFAULT 0');
  addColumn(db, 'daily_steps', 'first_viewed_at', 'TEXT');
  addColumn(db, 'daily_steps', 'read_description', 'INTEGER DEFAULT 0');
  addColumn(db, 'daily_steps', 'fallback_title', 'TEXT');
  addColumn(db, 'daily_steps', 'fallback_description', 'TEXT');
  addColumn(db, 'daily_steps', 'fallback_estimated_minutes', 'INTEGER');
  addColumn(db, 'daily_steps', 'coach_message_impression_at', 'TEXT');
  addColumn(db, 'daily_steps', 'primary_cta_clicked_at', 'TEXT');
  addColumn(db, 'daily_steps', 'reasoning', 'TEXT');
  addColumn(db, 'daily_steps', 'expected_resistance', 'TEXT');
  addColumn(db, 'daily_steps', 'pain_addressed', 'TEXT');
  addColumn(db, 'daily_steps', 'success_signal', 'TEXT');
  addColumn(db, 'daily_steps', 'user_edited', 'INTEGER DEFAULT 0');
  addColumn(db, 'daily_steps', 'validation_fallback_applied', 'INTEGER DEFAULT 0');
  addColumn(db, 'daily_steps', 'coach_tone', 'TEXT');
  addColumn(db, 'daily_steps', 'weekly_focus_id', 'TEXT');
  addColumn(db, 'daily_steps', 'value_feedback', 'TEXT');
  addColumn(db, 'daily_steps', 'is_general', 'INTEGER DEFAULT 0');
  addColumn(db, 'user_behavior_profile', 'tone_effectiveness', 'TEXT');
  addColumn(db, 'user_behavior_profile', 'avoid_windows', "TEXT DEFAULT '[]'");
  addColumn(db, 'user_behavior_profile', 'best_windows', "TEXT DEFAULT '[]'");
  addColumn(db, 'user_behavior_profile', 'weekday_skip_patterns', "TEXT DEFAULT '[]'");
  addColumn(db, 'user_behavior_profile', 'failed_action_patterns', "TEXT DEFAULT '[]'");

  // weekly_goal_focus
  db.exec(`
    CREATE TABLE IF NOT EXISTS weekly_goal_focus (
      id                  TEXT PRIMARY KEY,
      user_id             TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      goal_id             TEXT NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
      domain              TEXT NOT NULL,
      week_start          TEXT NOT NULL,
      week_end            TEXT NOT NULL,
      active_milestone_id TEXT,
      active_day_marker   INTEGER,
      focus_title         TEXT NOT NULL,
      focus_description   TEXT,
      weekly_themes_json  TEXT NOT NULL DEFAULT '[]',
      progress_cue        TEXT,
      source              TEXT DEFAULT 'fallback',
      created_at          TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_focus_user_goal_week ON weekly_goal_focus(user_id, goal_id, week_start)`);

  // skip_coach_adjustments
  db.exec(`
    CREATE TABLE IF NOT EXISTS skip_coach_adjustments (
      id               TEXT PRIMARY KEY,
      user_id          TEXT NOT NULL,
      skip_date        TEXT NOT NULL,
      step_id          TEXT,
      goal_id          TEXT,
      blocker_reason   TEXT,
      coach_action     TEXT NOT NULL,
      adjustment_json  TEXT NOT NULL,
      applied_at       TEXT,
      created_at       TEXT DEFAULT (datetime('now'))
    )
  `);
  db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_skip_coach_user_date ON skip_coach_adjustments(user_id, skip_date)`);

  // daily_reflections
  addColumn(db, 'daily_reflections', 'writing_duration_sec', 'INTEGER');
  addColumn(db, 'daily_reflections', 'analysis_json', 'TEXT');
  addColumn(db, 'daily_reflections', 'analyzed_at', 'TEXT');
  addColumn(db, 'daily_reflections', 'adjustment_applied_at', 'TEXT');
  // goals
  addColumn(db, 'goals', 'completed_at', 'TEXT');
  addColumn(db, 'goals', 'revision_count', 'INTEGER DEFAULT 0');
  // milestones
  addColumn(db, 'milestones', 'completed_at', 'TEXT');
  // ai_insights
  addColumn(db, 'ai_insights', 'tokens_used', 'INTEGER');
  addColumn(db, 'ai_insights', 'generation_duration_ms', 'INTEGER');
  addColumn(db, 'ai_insights', 'model_used', 'TEXT');

  // ── Psychological metrics (2025) ──────────────────────────────────────────
  addColumn(db, 'checkins', 'priority_action_word_count', 'INTEGER');
  addColumn(db, 'checkins', 'rewrote_priority_action_count', 'INTEGER DEFAULT 0');
  addColumn(db, 'checkins', 'tag_valence_shift', 'INTEGER');
  addColumn(db, 'checkins', 'energy_focus_divergence', 'INTEGER');
  addColumn(db, 'checkins', 'physical_complaint_mentioned', 'INTEGER DEFAULT 0');
  addColumn(db, 'checkins', 'help_engagement_depth', 'TEXT');
  addColumn(db, 'checkins', 'stated_action_completed', 'INTEGER');
  addColumn(db, 'morning_rituals', 'gratitude_generic_flags', 'TEXT');
  addColumn(db, 'morning_rituals', 'gratitude_target_types', 'TEXT');
  addColumn(db, 'morning_rituals', 'mission_changed_from_yesterday', 'INTEGER DEFAULT 0');
  addColumn(db, 'morning_rituals', 'breathing_full_pattern_done', 'INTEGER DEFAULT 0');
  addColumn(db, 'morning_rituals', 'visualization_content_type', 'TEXT');
  addColumn(db, 'daily_reflections', 'reflection_word_count', 'INTEGER');
  addColumn(db, 'daily_reflections', 'self_blame_language', 'INTEGER DEFAULT 0');
  addColumn(db, 'daily_steps', 'blocker_category', 'TEXT');
  addColumn(db, 'daily_steps', 'reattempt_same_day', 'INTEGER DEFAULT 0');
  addColumn(db, 'goals', 'abandoned_before_first_step', 'INTEGER DEFAULT 0');
  addColumn(db, 'goals', 'success_metric_specificity', 'TEXT');

  // users — formulation profile fields
  addColumn(db, 'users', 'life_context_status', 'TEXT');
  addColumn(db, 'users', 'last_completed_formulation_at', 'TEXT');
  addColumn(db, 'users', 'formulation_gate_dismissed', 'INTEGER DEFAULT 0');
  addColumn(db, 'users', 'gender', 'TEXT');
  addColumn(db, 'users', 'age', 'INTEGER');
  addColumn(db, 'formulation_sessions', 'participant_gender', 'TEXT');
  addColumn(db, 'formulation_sessions', 'participant_age', 'INTEGER');
  addColumn(db, 'formulation_sessions', 'life_context_statuses_json', 'TEXT');
  addColumn(db, 'formulation_sessions', 'prior_question_answers_json', 'TEXT');
  addColumn(db, 'formulation_sessions', 'passive_ratings_json', 'TEXT');
  addColumn(db, 'formulation_sessions', 'rating_follow_ups_json', 'TEXT');
  addColumn(db, 'formulation_sessions', 'llm_exploration_questions_json', 'TEXT');
  addColumn(db, 'formulation_sessions', 'llm_exploration_answers_json', 'TEXT');

  // formulation_sessions indexes (table created via SCHEMA_SQL)
  db.exec(`CREATE INDEX IF NOT EXISTS idx_formulation_user_status ON formulation_sessions(user_id, status)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_formulation_user_completed ON formulation_sessions(user_id, completed_at DESC)`);

  // Drop the deprecated parallel simple-task tables (unified into goals/daily_steps).
  db.exec(`DROP TABLE IF EXISTS simple_task_logs`);
  db.exec(`DROP TABLE IF EXISTS simple_tasks`);

  // ── Phase 0: Auth + Payments fields ──────────────────────────────────────
  addColumn(db, 'users', 'stripe_customer_id', 'TEXT');
  addColumn(db, 'users', 'trial_ends_at', 'TEXT');
  addColumn(db, 'users', 'wake_time', 'TEXT');
  addColumn(db, 'users', 'sleep_time', 'TEXT');
  addColumn(db, 'users', 'preferred_action_window', 'TEXT');
  addColumn(db, 'users', 'coaching_style', 'TEXT');
  addColumn(db, 'users', 'family_status', 'TEXT');
  addColumn(db, 'users', 'physical_considerations', 'TEXT');
  addColumn(db, 'users', 'life_context_note', 'TEXT');
  addColumn(db, 'users', 'onboarding_completed_at', 'TEXT');
  addColumn(db, 'users', 'onboarding_primary_domain', 'TEXT');
  addColumn(db, 'users', 'ai_personalization_summary', 'TEXT');
  // SQLite cannot ADD COLUMN with a UNIQUE constraint, so existing DBs get a
  // plain column (the previous `… TEXT UNIQUE` ALTER always threw and was
  // swallowed); uniqueness on fresh DBs comes from SCHEMA_SQL. Lookups use the
  // index below.
  addColumn(db, 'users', 'clerk_id', 'TEXT');
  db.exec(`CREATE INDEX IF NOT EXISTS idx_users_clerk_id ON users(clerk_id)`);

  // ── Evening Reset (2026) ──────────────────────────────────────────────────
  db.exec(`CREATE TABLE IF NOT EXISTS evening_resets (
    id                         TEXT PRIMARY KEY,
    user_id                    TEXT REFERENCES users(id) ON DELETE SET NULL,
    date                       TEXT NOT NULL,
    duration_sec               INTEGER,
    completed                  INTEGER DEFAULT 0 CHECK (completed IN (0, 1)),
    mode                       TEXT CHECK (mode IN ('quick', 'standard', 'deep')),
    readiness_score            INTEGER DEFAULT 0,
    tomorrows_win              TEXT,
    emotional_dump_word_count  INTEGER,
    blocker_mentioned          INTEGER DEFAULT 0,
    skipped_steps              TEXT,
    session_json               TEXT,
    created_at                 TEXT DEFAULT (datetime('now'))
  )`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_evening_resets_date ON evening_resets(date)`);
  db.exec(`CREATE INDEX IF NOT EXISTS idx_evening_resets_user_date ON evening_resets(user_id, date DESC, created_at DESC)`);
  addColumn(db, 'evening_resets', 'tomorrow_constraint', 'TEXT');
  addColumn(db, 'evening_resets', 'what_worked', 'TEXT');
  addColumn(db, 'evening_resets', 'what_failed', 'TEXT');
  addColumn(db, 'evening_resets', 'energy_forecast', 'TEXT');
  addColumn(db, 'evening_resets', 'tomorrow_takeaway', 'TEXT');
  addColumn(db, 'goals', 'commitment_days', 'INTEGER DEFAULT 30');
  addColumn(db, 'goals', 'commitment_started_at', 'TEXT');
  db.exec(`UPDATE goals SET commitment_days = 30 WHERE commitment_days IS NULL`);
  db.exec(`UPDATE goals SET commitment_started_at = date(created_at) WHERE commitment_started_at IS NULL`);

  db.exec(`CREATE TABLE IF NOT EXISTS client_log_usage (
    user_id TEXT NOT NULL,
    log_date TEXT NOT NULL,
    bytes_written INTEGER NOT NULL DEFAULT 0,
    PRIMARY KEY (user_id, log_date)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS ai_rate_limit_buckets (
    bucket_key TEXT PRIMARY KEY,
    count INTEGER NOT NULL,
    reset_at INTEGER NOT NULL
  )`);

  addColumn(db, 'goals', 'create_idempotency_key', 'TEXT');
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_create_idempotency
       ON goals(user_id, create_idempotency_key)
       WHERE create_idempotency_key IS NOT NULL`
  );
}

type Migration = {
  version: number;
  name: string;
  /** Migrations default to running inside a single transaction. Set false when
   *  the step manages its own transaction (e.g. a table rebuild that issues
   *  BEGIN/COMMIT itself, which cannot be nested). */
  transactional?: boolean;
  up: (db: MigrationDb) => void;
};

/**
 * Ordered migration ledger. Append new steps with the next version number;
 * never edit or renumber an applied step. `runMigrations` applies every step
 * whose version exceeds the database's current `user_version`.
 */
const MIGRATIONS: Migration[] = [
  {version: 1, name: 'baseline_inline_schema', up: applyBaseline},
  {
    version: 2,
    name: 'formulation_sessions_exploration_phase',
    // Rebuilds the table with its own BEGIN/COMMIT — must not be wrapped.
    transactional: false,
    up: (db) => migrateFormulationSessionsExplorationPhase(db),
  },
  {
    // `is_general` is also added in the baseline for fresh DBs, but the baseline
    // never re-runs on databases already past v1 — so it needs its own version
    // to reach them. addColumn is idempotent, so this no-ops where present.
    version: 3,
    name: 'daily_steps_is_general',
    up: (db) => {
      addColumn(db, 'daily_steps', 'is_general', 'INTEGER DEFAULT 0');
    },
  },
  {
    version: 4,
    name: 'backfill_goal_domain_assessments',
    up: (db) => {
      db.exec(`
        INSERT INTO domain_assessments
          (id, user_id, domain, current_score, current_state, desired_state,
           main_blockers, available_time_per_day, intensity_preference, created_at, updated_at)
        SELECT
          'auto-domain-' || lower(hex(randomblob(16))),
          g.user_id,
          g.domain,
          5,
          '',
          '',
          '[]',
          10,
          'balanced',
          datetime('now'),
          datetime('now')
        FROM (
          SELECT DISTINCT user_id, domain
          FROM goals
          WHERE user_id IS NOT NULL AND domain IS NOT NULL
        ) g
        WHERE NOT EXISTS (
          SELECT 1
          FROM domain_assessments da
          WHERE da.user_id = g.user_id AND da.domain = g.domain
        )
      `);
    },
  },
  {
    version: 5,
    name: 'standardize_health_goal_storage',
    up: (db) => {
      db.exec(`
        UPDATE goals
        SET
          health_category = NULL,
          health_baseline = NULL,
          health_target = NULL,
          health_unit = NULL,
          health_weight_dir = NULL,
          health_anchor_habit = NULL,
          health_anchor_time = NULL,
          health_why_important = NULL,
          health_why_now = NULL,
          health_what_lost = NULL,
          plan_source = NULL,
          health_context_json = NULL
        WHERE domain = 'health';

        DELETE FROM health_phases;
      `);
    },
  },
];

export const LATEST_SCHEMA_VERSION = MIGRATIONS[MIGRATIONS.length - 1]?.version ?? 0;

/**
 * Run all pending migrations against `db`, gated by `PRAGMA user_version`.
 * Each step runs at most once per database and bumps the version on success,
 * so a partially-applied or failed step is retried on the next boot rather than
 * silently skipped.
 */
export function runMigrations(db: MigrationDb): void {
  const current = Number(db.pragma('user_version', {simple: true}) ?? 0);

  for (const migration of MIGRATIONS) {
    if (migration.version <= current) continue;

    if (migration.transactional === false) {
      migration.up(db);
    } else {
      db.transaction(() => migration.up(db))();
    }

    db.pragma(`user_version = ${migration.version}`);
  }
}
