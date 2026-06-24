import {dbGet, getDb} from '../sqlite';
import {normalizeLlmExplorationAnswers} from '@/lib/formulation/exploration-answers';
import {
  parseLifeContextStatuses,
  serializeLifeContextStatuses,
} from '@/lib/formulation/life-context';
import {
  FORMULATION_PHASES,
  FORMULATION_SESSION_STATUSES,
  LIFE_DOMAINS,
  RISK_ACTIONS,
  RISK_LEVELS,
} from '@/lib/life-coach/constants';
import {parseJsonArrayOr, parseJsonOr} from '@/lib/safe-json';
import type {FormulationSession, RatingFollowUpItem} from '@/lib/life-coach/types';

function parseJson<T>(value: unknown, fallback: T): T {
  return parseJsonOr(value, fallback);
}

export function rowToFormulationSession(row: Record<string, unknown>): FormulationSession {
  const life_context_statuses = parseLifeContextStatuses(
    row.life_context_statuses_json,
    row.life_context_status
  );

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    locale: row.locale as FormulationSession['locale'],
    status: row.status as FormulationSession['status'],
    current_phase: row.current_phase as FormulationSession['current_phase'],
    life_context_status: life_context_statuses[0] ?? null,
    life_context_statuses,
    life_context_status_note: (row.life_context_status_note as string) ?? null,
    participant_gender: (row.participant_gender as string) ?? null,
    participant_age:
      row.participant_age != null ? Number(row.participant_age) : null,
    consent_accepted_at: (row.consent_accepted_at as string) ?? null,
    consent_version: (row.consent_version as string) ?? null,
    boundaries_ack: parseJson(row.boundaries_ack_json as string, null),
    risk_q1: row.risk_q1 as FormulationSession['risk_q1'],
    risk_q2: row.risk_q2 as FormulationSession['risk_q2'],
    risk_follow_up_confirmed: row.risk_follow_up_confirmed as number | null,
    risk_level: (row.risk_level as FormulationSession['risk_level']) ?? null,
    risk_action: (row.risk_action as FormulationSession['risk_action']) ?? null,
    risk_screen_at: (row.risk_screen_at as string) ?? null,
    presenting_concern_raw: (row.presenting_concern_raw as string) ?? null,
    presenting_concern_user_words: (row.presenting_concern_user_words as string) ?? null,
    reflection_llm_text: (row.reflection_llm_text as string) ?? null,
    passive_ratings: parseJsonArrayOr(row.passive_ratings_json),
    rating_follow_ups: parseJsonArrayOr<RatingFollowUpItem>(row.rating_follow_ups_json).map(
      (f) => ({...f, source_rating_key: f.source_rating_key ?? null})
    ),
    dimensions: parseJson(row.dimensions_json as string, null),
    formulation_draft: parseJson(row.formulation_draft_json as string, null),
    formulation_approved: parseJson(row.formulation_approved_json as string, null),
    user_edited_formulation: !!row.user_edited_formulation,
    formulation_approved_at: (row.formulation_approved_at as string) ?? null,
    coach_handoff: parseJson(row.coach_handoff_json as string, null),
    suggested_domain: (row.suggested_domain as FormulationSession['suggested_domain']) ?? null,
    created_goal_id: (row.created_goal_id as string) ?? null,
    checkin_prefill: parseJson(row.checkin_prefill_json as string, null),
    phases_skipped: parseJsonArrayOr<string>(row.phases_skipped_json),
    prior_question_key: (row.prior_question_key as string) ?? null,
    prior_question_answer: (row.prior_question_answer as string) ?? null,
    prior_question_answers: parseJsonArrayOr(row.prior_question_answers_json),
    llm_exploration_questions: parseJsonArrayOr(row.llm_exploration_questions_json),
    llm_exploration_answers: normalizeLlmExplorationAnswers(
      parseJson(row.llm_exploration_answers_json as string, [])
    ),
    last_ai_action: (row.last_ai_action as string) ?? null,
    last_ai_tokens: (row.last_ai_tokens as number) ?? null,
    last_ai_model: (row.last_ai_model as string) ?? null,
    last_ai_duration_ms: (row.last_ai_duration_ms as number) ?? null,
    started_at: row.started_at as string,
    completed_at: (row.completed_at as string) ?? null,
    updated_at: row.updated_at as string,
    duration_sec: (row.duration_sec as number) ?? null,
  };
}

/** Column order for INSERT — must stay in sync with schema.ts formulation_sessions. */
const FORMULATION_SESSION_INSERT_COLUMNS = [
  'id',
  'user_id',
  'locale',
  'status',
  'current_phase',
  'life_context_status',
  'life_context_statuses_json',
  'life_context_status_note',
  'participant_gender',
  'participant_age',
  'consent_accepted_at',
  'consent_version',
  'boundaries_ack_json',
  'risk_q1',
  'risk_q2',
  'risk_follow_up_confirmed',
  'risk_level',
  'risk_action',
  'risk_screen_at',
  'presenting_concern_raw',
  'presenting_concern_user_words',
  'reflection_llm_text',
  'passive_ratings_json',
  'rating_follow_ups_json',
  'dimensions_json',
  'formulation_draft_json',
  'formulation_approved_json',
  'user_edited_formulation',
  'formulation_approved_at',
  'coach_handoff_json',
  'suggested_domain',
  'created_goal_id',
  'checkin_prefill_json',
  'phases_skipped_json',
  'prior_question_key',
  'prior_question_answer',
  'prior_question_answers_json',
  'llm_exploration_questions_json',
  'llm_exploration_answers_json',
  'last_ai_action',
  'last_ai_tokens',
  'last_ai_model',
  'last_ai_duration_ms',
  'started_at',
  'completed_at',
  'updated_at',
  'duration_sec',
] as const;

function formulationSessionInsertValues(session: FormulationSession): unknown[] {
  return [
    session.id,
    session.user_id,
    session.locale,
    session.status,
    session.current_phase,
    session.life_context_status,
    session.life_context_statuses.length > 0
      ? serializeLifeContextStatuses(session.life_context_statuses)
      : null,
    session.life_context_status_note,
    session.participant_gender,
    session.participant_age,
    session.consent_accepted_at,
    session.consent_version,
    session.boundaries_ack ? JSON.stringify(session.boundaries_ack) : null,
    session.risk_q1,
    session.risk_q2,
    session.risk_follow_up_confirmed,
    session.risk_level,
    session.risk_action,
    session.risk_screen_at,
    session.presenting_concern_raw,
    session.presenting_concern_user_words,
    session.reflection_llm_text,
    session.passive_ratings.length > 0 ? JSON.stringify(session.passive_ratings) : null,
    session.rating_follow_ups.length > 0 ? JSON.stringify(session.rating_follow_ups) : null,
    session.dimensions ? JSON.stringify(session.dimensions) : null,
    session.formulation_draft ? JSON.stringify(session.formulation_draft) : null,
    session.formulation_approved ? JSON.stringify(session.formulation_approved) : null,
    session.user_edited_formulation ? 1 : 0,
    session.formulation_approved_at,
    session.coach_handoff ? JSON.stringify(session.coach_handoff) : null,
    session.suggested_domain,
    session.created_goal_id,
    session.checkin_prefill ? JSON.stringify(session.checkin_prefill) : null,
    JSON.stringify(session.phases_skipped ?? []),
    session.prior_question_key,
    session.prior_question_answer,
    session.prior_question_answers.length > 0
      ? JSON.stringify(session.prior_question_answers)
      : null,
    session.llm_exploration_questions.length > 0
      ? JSON.stringify(session.llm_exploration_questions)
      : null,
    session.llm_exploration_answers.length > 0
      ? JSON.stringify(session.llm_exploration_answers)
      : null,
    session.last_ai_action,
    session.last_ai_tokens,
    session.last_ai_model,
    session.last_ai_duration_ms,
    session.started_at,
    session.completed_at,
    session.updated_at,
    session.duration_sec,
  ];
}

export function insertFormulationSession(session: FormulationSession): void {
  const columns = FORMULATION_SESSION_INSERT_COLUMNS.join(', ');
  const placeholders = FORMULATION_SESSION_INSERT_COLUMNS.map(() => '?').join(', ');
  const values = formulationSessionInsertValues(session);
  if (values.length !== FORMULATION_SESSION_INSERT_COLUMNS.length) {
    throw new Error(
      `formulation_sessions INSERT: ${values.length} values for ${FORMULATION_SESSION_INSERT_COLUMNS.length} columns`
    );
  }
  getDb()
    .prepare(`INSERT INTO formulation_sessions (${columns}) VALUES (${placeholders})`)
    .run(...values);
}

function sanitizeFormulationSessionForUpdate(session: FormulationSession): void {
  if (session.created_goal_id) {
    const goalExists = dbGet<{ok: number}>(
      `SELECT 1 AS ok FROM goals WHERE id = ? AND user_id = ?`,
      [session.created_goal_id, session.user_id]
    );
    if (!goalExists) {
      session.created_goal_id = null;
    }
  }

  if (
    session.suggested_domain &&
    !(LIFE_DOMAINS as readonly string[]).includes(session.suggested_domain)
  ) {
    session.suggested_domain = null;
  }

  if (
    session.risk_level &&
    !(RISK_LEVELS as readonly string[]).includes(session.risk_level)
  ) {
    session.risk_level = null;
  }

  if (
    session.risk_action &&
    !(RISK_ACTIONS as readonly string[]).includes(session.risk_action)
  ) {
    session.risk_action = null;
  }

  if (!(FORMULATION_SESSION_STATUSES as readonly string[]).includes(session.status)) {
    session.status = 'draft';
  }

  if (!(FORMULATION_PHASES as readonly string[]).includes(session.current_phase)) {
    session.current_phase = 'consent';
  }

  if (session.locale !== 'he' && session.locale !== 'en') {
    session.locale = 'he';
  }
}

export function updateFormulationSession(session: FormulationSession): void {
  sanitizeFormulationSessionForUpdate(session);

  getDb()
    .prepare(
      `UPDATE formulation_sessions SET
        locale = ?, status = ?, current_phase = ?,
        life_context_status = ?, life_context_statuses_json = ?, life_context_status_note = ?,
        participant_gender = ?, participant_age = ?,
        consent_accepted_at = ?, consent_version = ?, boundaries_ack_json = ?,
        risk_q1 = ?, risk_q2 = ?, risk_follow_up_confirmed = ?,
        risk_level = ?, risk_action = ?, risk_screen_at = ?,
        presenting_concern_raw = ?, presenting_concern_user_words = ?, reflection_llm_text = ?,
        passive_ratings_json = ?, rating_follow_ups_json = ?,
        dimensions_json = ?, formulation_draft_json = ?, formulation_approved_json = ?,
        user_edited_formulation = ?, formulation_approved_at = ?, coach_handoff_json = ?,
        suggested_domain = ?, created_goal_id = ?,
        checkin_prefill_json = ?, phases_skipped_json = ?,
        prior_question_key = ?, prior_question_answer = ?, prior_question_answers_json = ?,
        llm_exploration_questions_json = ?, llm_exploration_answers_json = ?,
        last_ai_action = ?, last_ai_tokens = ?, last_ai_model = ?, last_ai_duration_ms = ?,
        completed_at = ?, updated_at = ?, duration_sec = ?
      WHERE id = ? AND user_id = ?`
    )
    .run(
      session.locale,
      session.status,
      session.current_phase,
      session.life_context_status,
      session.life_context_statuses.length > 0
        ? serializeLifeContextStatuses(session.life_context_statuses)
        : null,
      session.life_context_status_note,
      session.participant_gender,
      session.participant_age,
      session.consent_accepted_at,
      session.consent_version,
      session.boundaries_ack ? JSON.stringify(session.boundaries_ack) : null,
      session.risk_q1,
      session.risk_q2,
      session.risk_follow_up_confirmed,
      session.risk_level,
      session.risk_action,
      session.risk_screen_at,
      session.presenting_concern_raw,
      session.presenting_concern_user_words,
      session.reflection_llm_text,
      session.passive_ratings.length > 0 ? JSON.stringify(session.passive_ratings) : null,
      session.rating_follow_ups.length > 0 ? JSON.stringify(session.rating_follow_ups) : null,
      session.dimensions ? JSON.stringify(session.dimensions) : null,
      session.formulation_draft ? JSON.stringify(session.formulation_draft) : null,
      session.formulation_approved ? JSON.stringify(session.formulation_approved) : null,
      session.user_edited_formulation ? 1 : 0,
      session.formulation_approved_at,
      session.coach_handoff ? JSON.stringify(session.coach_handoff) : null,
      session.suggested_domain,
      session.created_goal_id,
      session.checkin_prefill ? JSON.stringify(session.checkin_prefill) : null,
      JSON.stringify(session.phases_skipped ?? []),
      session.prior_question_key,
      session.prior_question_answer,
      session.prior_question_answers.length > 0
        ? JSON.stringify(session.prior_question_answers)
        : null,
      session.llm_exploration_questions.length > 0
        ? JSON.stringify(session.llm_exploration_questions)
        : null,
      session.llm_exploration_answers.length > 0
        ? JSON.stringify(session.llm_exploration_answers)
        : null,
      session.last_ai_action,
      session.last_ai_tokens,
      session.last_ai_model,
      session.last_ai_duration_ms,
      session.completed_at,
      session.updated_at,
      session.duration_sec,
      session.id,
      session.user_id
    );
}
