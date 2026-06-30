import type Database from 'better-sqlite3';
import {migrateFormulationSessionsExplorationPhase} from './migrations/formulation-sessions-exploration.ts';
import {
  INCREMENTAL_COLUMN_REPAIRS,
  INCREMENTAL_INDEX_REPAIRS,
  listTableColumns,
  repairDeleteTriggers,
  tableExists,
} from './schema-drift-repairs.ts';

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

function ensureIncrementalColumns(db: MigrationDb): void {
  for (const {table, column, definition} of INCREMENTAL_COLUMN_REPAIRS) {
    if (tableExists(db, table)) {
      addColumn(db, table, column, definition);
    }
  }
}

function ensureIncrementalIndexes(db: MigrationDb): void {
  for (const {table, columns, sql} of INCREMENTAL_INDEX_REPAIRS) {
    if (!tableExists(db, table)) continue;
    const existing = listTableColumns(db, table);
    if (!columns.every((column) => existing.includes(column))) continue;
    db.exec(sql);
  }
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
  ensureIncrementalColumns(db);

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
  db.exec(`CREATE INDEX IF NOT EXISTS idx_skip_coach_user_date ON skip_coach_adjustments(user_id, skip_date)`);

  // Drop the deprecated parallel simple-task tables (unified into goals/daily_steps).
  db.exec(`DROP TABLE IF EXISTS simple_task_logs`);
  db.exec(`DROP TABLE IF EXISTS simple_tasks`);

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

  ensureIncrementalIndexes(db);
}

function rebuildGoalsWithoutLegacyColumns(db: MigrationDb): void {
  const columns = db.pragma('table_info(goals)') as Array<{name: string}>;
  const names = new Set(columns.map((column) => column.name));
  const legacyColumns = [
    'health_category',
    'health_baseline',
    'health_target',
    'health_unit',
    'health_weight_dir',
    'health_anchor_habit',
    'health_anchor_time',
    'health_why_important',
    'health_why_now',
    'health_what_lost',
    'plan_source',
    'health_context_json',
    'freestyle_times_per_day',
    'freestyle_target_days',
  ];
  if (!legacyColumns.some((column) => names.has(column))) return;
  const createIdempotencySelect = names.has('create_idempotency_key')
    ? 'create_idempotency_key'
    : 'NULL';
  const goalTriggers = db.prepare(`
    SELECT name, sql
    FROM sqlite_master
    WHERE type = 'trigger' AND sql LIKE '%goals%'
  `).all() as Array<{name: string; sql: string | null}>;

  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    for (const trigger of goalTriggers) {
      db.exec(`DROP TRIGGER IF EXISTS ${trigger.name}`);
    }
    db.exec(`
      DROP TABLE IF EXISTS goals_new;

      CREATE TABLE goals_new (
        id                    TEXT PRIMARY KEY,
        user_id               TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        domain                TEXT NOT NULL CHECK (domain IN ('health', 'time', 'wealth', 'career', 'relationships', 'mind', 'spirit', 'house_family')),
        domain_category       TEXT,
        title                 TEXT NOT NULL,
        description           TEXT,
        success_metric        TEXT,
        deadline              TEXT,
        commitment_days       INTEGER DEFAULT 30,
        commitment_started_at TEXT,
        status                TEXT DEFAULT 'active' CHECK (status IN ('active', 'completed', 'paused', 'archived')),
        created_by            TEXT DEFAULT 'user' CHECK (created_by IN ('user', 'ai')),
        completed_at          TEXT,
        revision_count        INTEGER DEFAULT 0,
        abandoned_before_first_step INTEGER DEFAULT 0,
        success_metric_specificity  TEXT,
        create_idempotency_key TEXT,
        created_at            TEXT DEFAULT (datetime('now')),
        updated_at            TEXT DEFAULT (datetime('now'))
      );

      INSERT INTO goals_new
        (id, user_id, domain, domain_category, title, description, success_metric,
         deadline, commitment_days, commitment_started_at, status, created_by,
         completed_at, revision_count, abandoned_before_first_step,
         success_metric_specificity, create_idempotency_key, created_at, updated_at)
      SELECT
        id, user_id, domain, domain_category, title, description, success_metric,
        deadline, COALESCE(commitment_days, 30), commitment_started_at, status, created_by,
        completed_at, COALESCE(revision_count, 0), COALESCE(abandoned_before_first_step, 0),
        success_metric_specificity, ${createIdempotencySelect}, created_at, updated_at
      FROM goals;

      DROP TABLE goals;
      ALTER TABLE goals_new RENAME TO goals;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_goals_create_idempotency
        ON goals(user_id, create_idempotency_key)
        WHERE create_idempotency_key IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_goals_user_domain ON goals(user_id, domain, status);
      CREATE INDEX IF NOT EXISTS idx_goals_user_status_updated ON goals(user_id, status, updated_at DESC);
    `);
    for (const trigger of goalTriggers) {
      if (trigger.sql) db.exec(trigger.sql);
    }
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.pragma('foreign_keys = ON');
  }
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
      const cols = new Set(
        (db.pragma('table_info(goals)') as Array<{name: string}>).map((column) => column.name)
      );
      if (cols.has('health_context_json')) {
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
        `);
      }
      db.exec(`DROP TABLE IF EXISTS health_phases;`);
    },
  },
  {
    version: 6,
    name: 'drop_unused_support_tables',
    up: (db) => {
      db.exec(`
        DROP TABLE IF EXISTS content_audit_events;
        DROP TABLE IF EXISTS content_eval_cases;
        DROP TABLE IF EXISTS content_governance_checks;
        DROP TABLE IF EXISTS content_item_versions;
        DROP TABLE IF EXISTS content_items;
        DROP TABLE IF EXISTS health_phases;
        DROP TABLE IF EXISTS push_subscriptions;
        DROP TABLE IF EXISTS subscriptions;
      `);
    },
  },
  {
    version: 7,
    name: 'drop_goal_legacy_health_and_freestyle_columns',
    transactional: false,
    up: (db) => rebuildGoalsWithoutLegacyColumns(db),
  },
  {
    version: 8,
    name: 'formulation_support_links',
    up: (db) => {
      addColumn(db, 'formulation_sessions', 'suggested_domain', 'TEXT');
      addColumn(db, 'formulation_sessions', 'created_goal_id', 'TEXT');
    },
  },
  {
    version: 9,
    name: 'skip_coach_adjustments_allow_history',
    up: (db) => {
      db.exec(`DROP INDEX IF EXISTS idx_skip_coach_user_date`);
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_skip_coach_user_date ON skip_coach_adjustments(user_id, skip_date)`
      );
    },
  },
  {
    version: 10,
    name: 'daily_steps_commitment_goal_date_unique',
    up: (db) => {
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_steps_commitment_goal_date
          ON daily_steps(user_id, goal_id, scheduled_date)
          WHERE generated_by_ai = 0 AND goal_id IS NOT NULL
      `);
    },
  },
  {
    version: 11,
    name: 'ai_insights_plan_adjustments_applied_at',
    up: (db) => {
      addColumn(db, 'ai_insights', 'plan_adjustments_applied_at', 'TEXT');
      db.exec(`
        UPDATE ai_insights
        SET plan_adjustments_applied_at = json_extract(COALESCE(metadata, '{}'), '$.plan_adjustments_applied_at')
        WHERE insight_type = 'weekly_review'
          AND plan_adjustments_applied_at IS NULL
          AND json_extract(COALESCE(metadata, '{}'), '$.plan_adjustments_applied_at') IS NOT NULL
      `);
    },
  },
  {
    version: 12,
    name: 'client_log_entries',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS client_log_entries (
          id TEXT PRIMARY KEY,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          log_date TEXT NOT NULL,
          line_json TEXT NOT NULL,
          bytes INTEGER NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now'))
        )
      `);
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_client_log_entries_date_created
         ON client_log_entries(log_date, created_at DESC)`
      );
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_client_log_entries_user_date
         ON client_log_entries(user_id, log_date)`
      );
    },
  },
  {
    version: 13,
    name: 'api_idempotency_and_daily_step_create_key',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS api_idempotency_records (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          scope TEXT NOT NULL,
          idempotency_key TEXT NOT NULL,
          resource_id TEXT,
          response_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          PRIMARY KEY (user_id, scope, idempotency_key)
        )
      `);
      db.exec(
        `CREATE INDEX IF NOT EXISTS idx_api_idempotency_resource
         ON api_idempotency_records(user_id, scope, resource_id)`
      );
      addColumn(db, 'daily_steps', 'create_idempotency_key', 'TEXT');
      db.exec(`
        CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_steps_create_idempotency
          ON daily_steps(user_id, create_idempotency_key)
          WHERE create_idempotency_key IS NOT NULL
      `);
    },
  },
];

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

  repairSchemaDrift(db);
}

/**
 * Idempotent repairs for columns dropped by older table rebuilds (e.g. v2
 * exploration migration) or missed when the dev server kept a warm DB handle.
 */
export function repairSchemaDrift(db: MigrationDb): void {
  ensureIncrementalColumns(db);
  ensureIncrementalIndexes(db);
  repairDeleteTriggers(db);
}
