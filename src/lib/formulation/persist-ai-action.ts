import {PROMPT_VERSIONS} from '@/lib/ai-formulation/prompts';
import {getDb, dbGet} from '@/lib/db/sqlite';
import {updateFormulationSession, rowToFormulationSession} from '@/lib/db/repositories/formulation-sessions';
import {insertAiInsightRow} from '@/lib/life-coach/reflection-insight-repository';
import type {AiCoachingInsight, FormulationApproved, FormulationSession} from '@/lib/life-coach/types';

type FormulationAiMetrics = {
  action: string;
  tokens_used?: number;
  model_used?: string;
  generation_duration_ms?: number;
};

function getFormulationSessionSync(userId: string, id: string): FormulationSession {
  const row = dbGet<Record<string, unknown>>(
    `SELECT * FROM formulation_sessions WHERE id = ? AND user_id = ?`,
    [id, userId]
  );
  if (!row) throw new Error('Session not found.');
  return rowToFormulationSession(row);
}

function applyFormulationAiMetrics(session: FormulationSession, metrics: FormulationAiMetrics): void {
  session.last_ai_action = metrics.action;
  session.last_ai_tokens = metrics.tokens_used ?? null;
  session.last_ai_model = metrics.model_used ?? null;
  session.last_ai_duration_ms = metrics.generation_duration_ms ?? null;
  session.updated_at = new Date().toISOString();
}

export function persistFormulationExplorationAiResult(
  userId: string,
  sessionId: string,
  questions: FormulationSession['llm_exploration_questions'],
  metrics: FormulationAiMetrics,
  insight: Omit<AiCoachingInsight, 'id' | 'user_id' | 'created_at'>
): FormulationSession {
  return getDb().transaction(() => {
    const session = getFormulationSessionSync(userId, sessionId);
    session.llm_exploration_questions = questions;
    applyFormulationAiMetrics(session, metrics);
    updateFormulationSession(session);
    insertAiInsightRow(userId, insight);
    return session;
  })();
}

export function persistFormulationDraftAiResult(
  userId: string,
  sessionId: string,
  draft: FormulationApproved,
  metrics: FormulationAiMetrics,
  insight: Omit<AiCoachingInsight, 'id' | 'user_id' | 'created_at'>
): FormulationSession {
  return getDb().transaction(() => {
    const session = getFormulationSessionSync(userId, sessionId);
    session.formulation_draft = draft;
    applyFormulationAiMetrics(session, metrics);
    updateFormulationSession(session);
    insertAiInsightRow(userId, insight);
    return session;
  })();
}

export {PROMPT_VERSIONS};
