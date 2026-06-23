import assert from 'node:assert/strict';
import {mkdtempSync, rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import Database from 'better-sqlite3';
import {migrateFormulationSessionsExplorationPhase} from './formulation-sessions-exploration.ts';

const QUESTIONS = JSON.stringify(['What matters most?']);
const ANSWERS = JSON.stringify(['Family time']);

/** Legacy schema: all columns exist, but current_phase CHECK omits exploration. */
const LEGACY_TABLE_SQL = `
  CREATE TABLE users (id TEXT PRIMARY KEY, email TEXT);
  INSERT INTO users (id) VALUES ('user-1');

  CREATE TABLE formulation_sessions (
    id                            TEXT PRIMARY KEY,
    user_id                       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    locale                        TEXT NOT NULL DEFAULT 'he' CHECK (locale IN ('he', 'en')),
    status                        TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'completed', 'abandoned', 'crisis_stopped', 'skipped_after_consent')),
    current_phase                 TEXT NOT NULL DEFAULT 'consent'
      CHECK (current_phase IN ('consent', 'risk', 'open', 'dimensions', 'formulation', 'goal', 'complete')),
    life_context_status           TEXT,
    life_context_statuses_json    TEXT,
    life_context_status_note      TEXT,
    participant_gender            TEXT,
    participant_age               INTEGER,
    consent_accepted_at           TEXT,
    consent_version               TEXT,
    boundaries_ack_json           TEXT,
    risk_q1                       INTEGER,
    risk_q2                       INTEGER,
    risk_follow_up_confirmed      INTEGER,
    risk_level                    TEXT CHECK (risk_level IN ('none', 'elevated', 'crisis')),
    risk_action                   TEXT CHECK (risk_action IN ('continue', 'resources', 'stop')),
    risk_screen_at                TEXT,
    presenting_concern_raw        TEXT,
    presenting_concern_user_words TEXT,
    reflection_llm_text           TEXT,
    passive_ratings_json          TEXT,
    rating_follow_ups_json        TEXT,
    dimensions_json               TEXT,
    formulation_draft_json        TEXT,
    formulation_approved_json     TEXT,
    user_edited_formulation       INTEGER DEFAULT 0 CHECK (user_edited_formulation IN (0, 1)),
    formulation_approved_at       TEXT,
    coach_handoff_json            TEXT,
    checkin_prefill_json          TEXT,
    phases_skipped_json           TEXT,
    prior_question_key            TEXT,
    prior_question_answer         TEXT,
    prior_question_answers_json   TEXT,
    llm_exploration_questions_json TEXT,
    llm_exploration_answers_json   TEXT,
    last_ai_action                TEXT,
    last_ai_tokens                INTEGER,
    last_ai_model                 TEXT,
    last_ai_duration_ms           INTEGER,
    started_at                    TEXT DEFAULT (datetime('now')),
    completed_at                  TEXT,
    updated_at                    TEXT DEFAULT (datetime('now')),
    duration_sec                  INTEGER
  );

  INSERT INTO formulation_sessions (
    id, user_id, locale, status, current_phase,
    llm_exploration_questions_json, llm_exploration_answers_json
  ) VALUES (
    'sess-1', 'user-1', 'he', 'draft', 'dimensions',
    '${QUESTIONS}', '${ANSWERS}'
  );
`;

function createLegacyDb(): Database.Database {
  const dir = mkdtempSync(join(tmpdir(), 'robbins-formulation-migration-'));
  const db = new Database(join(dir, 'test.db'));
  db.pragma('foreign_keys = ON');
  db.exec(LEGACY_TABLE_SQL);
  return db;
}

function cleanupDb(db: Database.Database) {
  const dbPath = db.name;
  db.close();
  rmSync(dbPath, {force: true});
  rmSync(join(dbPath, '..'), {recursive: true, force: true});
}

test('migrateFormulationSessionsExplorationPhase preserves exploration Q&A columns', () => {
  const db = createLegacyDb();

  try {
    migrateFormulationSessionsExplorationPhase(db);

    const row = db
      .prepare(
        `SELECT llm_exploration_questions_json, llm_exploration_answers_json, current_phase
         FROM formulation_sessions WHERE id = 'sess-1'`
      )
      .get() as {
      llm_exploration_questions_json: string;
      llm_exploration_answers_json: string;
      current_phase: string;
    };

    assert.equal(row.llm_exploration_questions_json, QUESTIONS);
    assert.equal(row.llm_exploration_answers_json, ANSWERS);
    assert.equal(row.current_phase, 'dimensions');

    const schema = db
      .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'formulation_sessions'`)
      .get() as {sql: string};
    assert.match(schema.sql, /'exploration'/);
  } finally {
    cleanupDb(db);
  }
});

test('migrateFormulationSessionsExplorationPhase is a no-op when exploration already allowed', () => {
  const db = createLegacyDb();
  migrateFormulationSessionsExplorationPhase(db);

  const before = db
    .prepare(
      `SELECT llm_exploration_questions_json, llm_exploration_answers_json FROM formulation_sessions WHERE id = 'sess-1'`
    )
    .get() as {llm_exploration_questions_json: string; llm_exploration_answers_json: string};

  migrateFormulationSessionsExplorationPhase(db);

  const after = db
    .prepare(
      `SELECT llm_exploration_questions_json, llm_exploration_answers_json FROM formulation_sessions WHERE id = 'sess-1'`
    )
    .get() as {llm_exploration_questions_json: string; llm_exploration_answers_json: string};

  try {
    assert.deepEqual(after, before);
  } finally {
    cleanupDb(db);
  }
});
