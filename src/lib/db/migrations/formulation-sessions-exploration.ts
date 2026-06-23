import type Database from 'better-sqlite3';

/**
 * Existing DBs were created before the `exploration` phase was added to the
 * current_phase CHECK constraint. Rebuild the table when needed.
 */
export function migrateFormulationSessionsExplorationPhase(db: Database.Database): void {
  const row = db
    .prepare(`SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'formulation_sessions'`)
    .get() as {sql?: string} | undefined;

  if (!row?.sql || row.sql.includes("'exploration'")) {
    return;
  }

  db.exec('BEGIN');
  try {
    db.exec(`
      CREATE TABLE formulation_sessions_new (
        id                            TEXT PRIMARY KEY,
        user_id                       TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        locale                        TEXT NOT NULL DEFAULT 'he' CHECK (locale IN ('he', 'en')),
        status                        TEXT NOT NULL DEFAULT 'draft'
          CHECK (status IN ('draft', 'completed', 'abandoned', 'crisis_stopped', 'skipped_after_consent')),
        current_phase                 TEXT NOT NULL DEFAULT 'consent'
          CHECK (current_phase IN ('consent', 'risk', 'open', 'dimensions', 'exploration', 'formulation', 'goal', 'complete')),
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
      )
    `);

    db.exec(`
      INSERT INTO formulation_sessions_new (
        id, user_id, locale, status, current_phase,
        life_context_status, life_context_statuses_json, life_context_status_note,
        participant_gender, participant_age,
        consent_accepted_at, consent_version, boundaries_ack_json,
        risk_q1, risk_q2, risk_follow_up_confirmed, risk_level, risk_action, risk_screen_at,
        presenting_concern_raw, presenting_concern_user_words, reflection_llm_text,
        passive_ratings_json, rating_follow_ups_json,
        dimensions_json, formulation_draft_json, formulation_approved_json,
        user_edited_formulation, formulation_approved_at, coach_handoff_json,
        checkin_prefill_json, phases_skipped_json,
        prior_question_key, prior_question_answer, prior_question_answers_json,
        llm_exploration_questions_json, llm_exploration_answers_json,
        last_ai_action, last_ai_tokens, last_ai_model, last_ai_duration_ms,
        started_at, completed_at, updated_at, duration_sec
      )
      SELECT
        id, user_id, locale, status, current_phase,
        life_context_status, life_context_statuses_json, life_context_status_note,
        participant_gender, participant_age,
        consent_accepted_at, consent_version, boundaries_ack_json,
        risk_q1, risk_q2, risk_follow_up_confirmed, risk_level, risk_action, risk_screen_at,
        presenting_concern_raw, presenting_concern_user_words, reflection_llm_text,
        passive_ratings_json, rating_follow_ups_json,
        dimensions_json, formulation_draft_json, formulation_approved_json,
        user_edited_formulation, formulation_approved_at, coach_handoff_json,
        checkin_prefill_json, phases_skipped_json,
        prior_question_key, prior_question_answer, prior_question_answers_json,
        llm_exploration_questions_json, llm_exploration_answers_json,
        last_ai_action, last_ai_tokens, last_ai_model, last_ai_duration_ms,
        started_at, completed_at, updated_at, duration_sec
      FROM formulation_sessions
    `);

    db.exec('DROP TABLE formulation_sessions');
    db.exec('ALTER TABLE formulation_sessions_new RENAME TO formulation_sessions');
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_formulation_user_status
        ON formulation_sessions(user_id, status)
    `);
    db.exec(`
      CREATE INDEX IF NOT EXISTS idx_formulation_user_completed
        ON formulation_sessions(user_id, completed_at DESC)
    `);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
