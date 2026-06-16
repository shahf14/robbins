import path from 'path';
import Database from 'better-sqlite3';
import {migrateFormulationSessionsExplorationPhase} from './migrations/formulation-sessions-exploration';
import {SCHEMA_SQL} from './schema';

// The DB file lives at <project-root>/data/life-coach.db
// It is excluded from git via .gitignore
const DB_PATH = path.join(process.cwd(), 'data', 'life-coach.db');

let _db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (_db) return _db;

  _db = new Database(DB_PATH);

  // Performance pragmas
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  _db.pragma('synchronous = NORMAL');

  // Apply schema (all CREATE TABLE IF NOT EXISTS — safe to run every time)
  _db.exec(SCHEMA_SQL);

  // Incremental migrations for existing databases
  try { _db.exec(`ALTER TABLE goals ADD COLUMN health_context_json TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE morning_rituals ADD COLUMN session_json TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE goals ADD COLUMN freestyle_times_per_day INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE goals ADD COLUMN freestyle_target_days INTEGER`); } catch { /* already exists */ }

  // ── Raw behavioral metrics (2025) ─────────────────────────────────────
  // gratitude_entries
  try { _db.exec(`ALTER TABLE gratitude_entries ADD COLUMN trigger_key TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE gratitude_entries ADD COLUMN entry_duration_sec INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE gratitude_entries ADD COLUMN was_edited INTEGER DEFAULT 0`); } catch { /* already exists */ }
  // morning_rituals
  try { _db.exec(`ALTER TABLE morning_rituals ADD COLUMN mode TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE morning_rituals ADD COLUMN selected_affirmation_id TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE morning_rituals ADD COLUMN breathing_rounds_done INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE morning_rituals ADD COLUMN skipped_steps TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE morning_rituals ADD COLUMN visualization_duration_sec INTEGER`); } catch { /* already exists */ }
  // checkins
  try { _db.exec(`ALTER TABLE checkins ADD COLUMN session_duration_sec INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE checkins ADD COLUMN slider_adjustments INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE checkins ADD COLUMN opened_coach_support INTEGER DEFAULT 0`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE checkins ADD COLUMN entry_json TEXT`); } catch { /* already exists */ }
  // daily_steps
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN completed_at TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN actual_minutes INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN rescheduled_from TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN reschedule_count INTEGER DEFAULT 0`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN first_viewed_at TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN read_description INTEGER DEFAULT 0`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN fallback_title TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN fallback_description TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN fallback_estimated_minutes INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN coach_message_impression_at TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN primary_cta_clicked_at TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN reasoning TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN expected_resistance TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN pain_addressed TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN success_signal TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN user_edited INTEGER DEFAULT 0`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN validation_fallback_applied INTEGER DEFAULT 0`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN coach_tone TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN weekly_focus_id TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN value_feedback TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE user_behavior_profile ADD COLUMN tone_effectiveness TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE user_behavior_profile ADD COLUMN avoid_windows TEXT DEFAULT '[]'`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE user_behavior_profile ADD COLUMN best_windows TEXT DEFAULT '[]'`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE user_behavior_profile ADD COLUMN weekday_skip_patterns TEXT DEFAULT '[]'`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE user_behavior_profile ADD COLUMN failed_action_patterns TEXT DEFAULT '[]'`); } catch { /* already exists */ }
  // weekly_goal_focus
  try {
    _db.exec(`
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
  } catch { /* already exists */ }
  try {
    _db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_weekly_focus_user_goal_week ON weekly_goal_focus(user_id, goal_id, week_start)`);
  } catch { /* already exists */ }
  // skip_coach_adjustments
  try {
    _db.exec(`
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
  } catch { /* already exists */ }
  try {
    _db.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_skip_coach_user_date ON skip_coach_adjustments(user_id, skip_date)`);
  } catch { /* already exists */ }
  // daily_reflections
  try { _db.exec(`ALTER TABLE daily_reflections ADD COLUMN writing_duration_sec INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_reflections ADD COLUMN analysis_json TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_reflections ADD COLUMN analyzed_at TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_reflections ADD COLUMN adjustment_applied_at TEXT`); } catch { /* already exists */ }
  // goals
  try { _db.exec(`ALTER TABLE goals ADD COLUMN completed_at TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE goals ADD COLUMN revision_count INTEGER DEFAULT 0`); } catch { /* already exists */ }
  // milestones
  try { _db.exec(`ALTER TABLE milestones ADD COLUMN completed_at TEXT`); } catch { /* already exists */ }
  // ai_insights
  try { _db.exec(`ALTER TABLE ai_insights ADD COLUMN tokens_used INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE ai_insights ADD COLUMN generation_duration_ms INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE ai_insights ADD COLUMN model_used TEXT`); } catch { /* already exists */ }

  // ── Psychological metrics (2025) ──────────────────────────────────────────
  // checkins
  try { _db.exec(`ALTER TABLE checkins ADD COLUMN priority_action_word_count INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE checkins ADD COLUMN rewrote_priority_action_count INTEGER DEFAULT 0`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE checkins ADD COLUMN tag_valence_shift INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE checkins ADD COLUMN energy_focus_divergence INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE checkins ADD COLUMN physical_complaint_mentioned INTEGER DEFAULT 0`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE checkins ADD COLUMN help_engagement_depth TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE checkins ADD COLUMN stated_action_completed INTEGER`); } catch { /* already exists */ }
  // morning_rituals
  try { _db.exec(`ALTER TABLE morning_rituals ADD COLUMN gratitude_generic_flags TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE morning_rituals ADD COLUMN gratitude_target_types TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE morning_rituals ADD COLUMN mission_changed_from_yesterday INTEGER DEFAULT 0`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE morning_rituals ADD COLUMN breathing_full_pattern_done INTEGER DEFAULT 0`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE morning_rituals ADD COLUMN visualization_content_type TEXT`); } catch { /* already exists */ }
  // daily_reflections
  try { _db.exec(`ALTER TABLE daily_reflections ADD COLUMN reflection_word_count INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_reflections ADD COLUMN self_blame_language INTEGER DEFAULT 0`); } catch { /* already exists */ }
  // daily_steps
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN blocker_category TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN reattempt_same_day INTEGER DEFAULT 0`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE daily_steps ADD COLUMN reasoning TEXT`); } catch { /* already exists */ }
  // goals
  try { _db.exec(`ALTER TABLE goals ADD COLUMN abandoned_before_first_step INTEGER DEFAULT 0`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE goals ADD COLUMN success_metric_specificity TEXT`); } catch { /* already exists */ }

  // users — formulation profile fields
  try { _db.exec(`ALTER TABLE users ADD COLUMN life_context_status TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN last_completed_formulation_at TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN formulation_gate_dismissed INTEGER DEFAULT 0`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN gender TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN age INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE formulation_sessions ADD COLUMN participant_gender TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE formulation_sessions ADD COLUMN participant_age INTEGER`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE formulation_sessions ADD COLUMN life_context_statuses_json TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE formulation_sessions ADD COLUMN prior_question_answers_json TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE formulation_sessions ADD COLUMN passive_ratings_json TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE formulation_sessions ADD COLUMN rating_follow_ups_json TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE formulation_sessions ADD COLUMN llm_exploration_questions_json TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE formulation_sessions ADD COLUMN llm_exploration_answers_json TEXT`); } catch { /* already exists */ }
  migrateFormulationSessionsExplorationPhase(_db);

  // formulation_sessions table (CREATE IF NOT EXISTS via SCHEMA_SQL)
  try { _db.exec(`CREATE INDEX IF NOT EXISTS idx_formulation_user_status ON formulation_sessions(user_id, status)`); } catch { /* table may not exist yet on first run */ }
  try { _db.exec(`CREATE INDEX IF NOT EXISTS idx_formulation_user_completed ON formulation_sessions(user_id, completed_at DESC)`); } catch { /* ignore */ }

  // Drop the deprecated parallel simple-task tables (unified into goals/daily_steps).
  try { _db.exec(`DROP TABLE IF EXISTS simple_task_logs`); } catch { /* ignore */ }
  try { _db.exec(`DROP TABLE IF EXISTS simple_tasks`); } catch { /* ignore */ }

  // ── Phase 0: Auth + Payments fields ──────────────────────────────────────
  try { _db.exec(`ALTER TABLE users ADD COLUMN stripe_customer_id TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN trial_ends_at TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN wake_time TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN sleep_time TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN preferred_action_window TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN coaching_style TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN family_status TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN physical_considerations TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN life_context_note TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN onboarding_completed_at TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN onboarding_primary_domain TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE users ADD COLUMN ai_personalization_summary TEXT`); } catch { /* already exists */ }

  // ── Evening Reset (2026) ──────────────────────────────────────────────────
  try {
    _db.exec(`CREATE TABLE IF NOT EXISTS evening_resets (
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
  } catch { /* already exists */ }
  try { _db.exec(`CREATE INDEX IF NOT EXISTS idx_evening_resets_date ON evening_resets(date)`); } catch { /* ignore */ }
  try { _db.exec(`CREATE INDEX IF NOT EXISTS idx_evening_resets_user_date ON evening_resets(user_id, date DESC, created_at DESC)`); } catch { /* ignore */ }
  try { _db.exec(`ALTER TABLE evening_resets ADD COLUMN tomorrow_constraint TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE evening_resets ADD COLUMN what_worked TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE evening_resets ADD COLUMN what_failed TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE evening_resets ADD COLUMN energy_forecast TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE evening_resets ADD COLUMN tomorrow_takeaway TEXT`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE goals ADD COLUMN commitment_days INTEGER DEFAULT 30`); } catch { /* already exists */ }
  try { _db.exec(`ALTER TABLE goals ADD COLUMN commitment_started_at TEXT`); } catch { /* already exists */ }
  try {
    _db.exec(
      `UPDATE goals SET commitment_days = 30 WHERE commitment_days IS NULL`
    );
    _db.exec(
      `UPDATE goals SET commitment_started_at = date(created_at) WHERE commitment_started_at IS NULL`
    );
  } catch { /* ignore */ }

  return _db;
}

/** Convenience: run a SELECT and return all rows */
export function dbAll<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return getDb().prepare(sql).all(...params) as T[];
}

/** Convenience: run a SELECT and return one row */
export function dbGet<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  return getDb().prepare(sql).get(...params) as T | undefined;
}

/** Convenience: run INSERT / UPDATE / DELETE */
export function dbRun(sql: string, params: unknown[] = []) {
  return getDb().prepare(sql).run(...params);
}

/** Return all table names in the DB (excluding sqlite internal tables) */
export function listTables(): string[] {
  const rows = dbAll<{name: string}>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`
  );
  return rows.map((r) => r.name);
}

/** Return row count for a specific table */
export function tableRowCount(table: string): number {
  // table name comes from listTables() so it is safe — still whitelist-validated in the route
  const row = dbGet<{'COUNT(*)': number}>(`SELECT COUNT(*) FROM "${table}"`);
  return row?.['COUNT(*)'] ?? 0;
}
