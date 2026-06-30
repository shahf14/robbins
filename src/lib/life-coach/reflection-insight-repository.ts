import {randomUUID} from 'crypto';
import {dbAll, dbGet, dbRun, getDb} from '@/lib/db/sqlite';
import {refreshUserBehaviorProfile} from '@/lib/behavior-profile/repository';
import {upsertWeeklyReviewProjection} from '@/lib/db/repositories/insights';
import {saveReflectionAnalysis} from '@/lib/reflection-analysis/repository';
import type {ReflectionAnalysis} from '@/lib/reflection-analysis/types';
import {rowToInsight, rowToReflection} from './repository-mappers';
import type {AiCoachingInsight, DailyReflection} from './types';
export async function upsertDailyReflection(
  userId: string,
  input: Omit<DailyReflection, 'id' | 'user_id' | 'created_at'>
): Promise<DailyReflection> {
  const now = new Date().toISOString();
  let rowId: string = randomUUID();

  getDb().transaction(() => {
    const existing = dbGet<Record<string, unknown>>(
      `SELECT * FROM daily_reflections WHERE user_id = ? AND date = ?`,
      [userId, input.date]
    );
    rowId = (existing?.id as string) ?? rowId;
    const created_at = (existing?.created_at as string) ?? now;
    const reflectionText = mergeReflectionText(
      (existing?.reflection_text as string) ?? null,
      input.reflection_text
    );

    dbRun(
      `INSERT INTO daily_reflections
        (id, user_id, date, mood_score, energy_score, reflection_text, blocker_reason,
         writing_duration_sec, reflection_word_count, self_blame_language, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(user_id, date) DO UPDATE SET
         mood_score=excluded.mood_score,
         energy_score=excluded.energy_score,
         reflection_text=excluded.reflection_text,
         blocker_reason=excluded.blocker_reason,
         writing_duration_sec=excluded.writing_duration_sec,
         reflection_word_count=excluded.reflection_word_count,
         self_blame_language=excluded.self_blame_language`,
      [
        rowId,
        userId,
        input.date,
        input.mood_score ?? existing?.mood_score ?? null,
        input.energy_score ?? existing?.energy_score ?? null,
        reflectionText,
        input.blocker_reason ?? existing?.blocker_reason ?? null,
        input.writing_duration_sec ?? existing?.writing_duration_sec ?? null,
        countWords(reflectionText),
        input.self_blame_language || !!existing?.self_blame_language ? 1 : 0,
        created_at,
      ]
    );
    refreshUserBehaviorProfile(userId);
  })();

  const row = dbGet<Record<string, unknown>>(`SELECT * FROM daily_reflections WHERE id = ?`, [rowId]);
  return rowToReflection(row!);
}

function mergeReflectionText(existing: string | null, incoming: string | null): string | null {
  const previous = existing?.trim() ?? '';
  const next = incoming?.trim() ?? '';
  if (!next || next === previous || previous.includes(next)) return previous || null;
  if (next.includes(previous)) return next;
  if (!previous) return next;
  return `${previous}\n${next}`;
}

function countWords(text: string | null): number | null {
  if (!text) return null;
  return text.split(/\s+/).filter(Boolean).length;
}

export async function getDailyReflectionForDate(
  userId: string,
  date: string
): Promise<DailyReflection | null> {
  const row = dbGet<Record<string, unknown>>(
    `SELECT * FROM daily_reflections WHERE user_id = ? AND date = ?`,
    [userId, date]
  );
  return row ? rowToReflection(row) : null;
}

export async function listRecentReflections(limit = 14, userId?: string): Promise<DailyReflection[]> {
  const rows = dbAll<Record<string, unknown>>(
    userId
      ? `SELECT * FROM daily_reflections WHERE user_id = ? ORDER BY date DESC LIMIT ?`
      : `SELECT * FROM daily_reflections ORDER BY date DESC LIMIT ?`,
    userId ? [userId, limit] : [limit]
  );
  return rows.map(rowToReflection);
}

// ---------------------------------------------------------------------------
// AI insights
// ---------------------------------------------------------------------------

export function insertAiInsightRow(
  userId: string,
  input: Omit<AiCoachingInsight, 'id' | 'user_id' | 'created_at'>
): AiCoachingInsight {
  const now = new Date().toISOString();
  const id = randomUUID();
  const planAppliedAt =
    input.plan_adjustments_applied_at ??
    (typeof input.metadata?.plan_adjustments_applied_at === 'string'
      ? input.metadata.plan_adjustments_applied_at
      : null);
  const insight = {
    id,
    user_id: userId,
    ...input,
    plan_adjustments_applied_at: planAppliedAt,
    created_at: now,
  };
  dbRun(
    `INSERT INTO ai_insights
      (id, user_id, insight_type, content, metadata,
       tokens_used, generation_duration_ms, model_used, plan_adjustments_applied_at, created_at)
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [id, userId, input.insight_type, input.content ?? null,
     JSON.stringify(input.metadata ?? {}),
     input.tokens_used ?? null, input.generation_duration_ms ?? null,
     input.model_used ?? null, planAppliedAt, now]
  );
  upsertWeeklyReviewProjection(insight);
  return insight;
}

/**
 * Synchronous core of {@link createAiInsight}. Because better-sqlite3
 * transactions must be synchronous, callers that need to insert an insight as
 * part of a larger transaction (e.g. reflection analysis) must use this rather
 * than the async wrapper, whose rejected promises would not roll the outer
 * transaction back. Safe to nest — better-sqlite3 turns the inner
 * `.transaction()` into a savepoint.
 */
export function createAiInsightSync(
  userId: string,
  input: Omit<AiCoachingInsight, 'id' | 'user_id' | 'created_at'>
): AiCoachingInsight {
  return getDb().transaction(() => insertAiInsightRow(userId, input))();
}

export async function createAiInsight(
  userId: string,
  input: Omit<AiCoachingInsight, 'id' | 'user_id' | 'created_at'>
): Promise<AiCoachingInsight> {
  return createAiInsightSync(userId, input);
}

/**
 * Persist a reflection analysis together with its derived pattern/recommendation
 * insights in a single transaction. Previously these three writes ran under
 * `Promise.all` (not a transaction), so a failure on the second/third write left
 * the analysis row and insight rows inconsistent.
 */
export function saveReflectionAnalysisWithInsights(
  userId: string,
  date: string,
  analysis: ReflectionAnalysis,
  metrics: {
    tokens_used?: number | null;
    generation_duration_ms?: number | null;
    model_used?: string | null;
  } = {}
): void {
  getDb().transaction(() => {
    saveReflectionAnalysis(userId, date, analysis);
    insertAiInsightRow(userId, {
      insight_type: 'pattern',
      content: analysis.patterns.join('\n'),
      metadata: analysis,
      tokens_used: metrics.tokens_used,
      generation_duration_ms: metrics.generation_duration_ms,
      model_used: metrics.model_used,
    });
    insertAiInsightRow(userId, {
      insight_type: 'recommendation',
      content: analysis.recommendations.join('\n'),
      metadata: analysis,
    });
  })();
}

export async function listInsights(
  type?: AiCoachingInsight['insight_type'],
  userId?: string,
  options?: {limit?: number; offset?: number}
): Promise<AiCoachingInsight[]> {
  let sql = `SELECT * FROM ai_insights WHERE 1=1`;
  const params: unknown[] = [];
  if (type) {
    sql += ` AND insight_type = ?`;
    params.push(type);
  }
  if (userId) {
    sql += ` AND user_id = ?`;
    params.push(userId);
  }
  sql += ` ORDER BY created_at DESC`;
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 200);
  const offset = Math.max(options?.offset ?? 0, 0);
  sql += ` LIMIT ? OFFSET ?`;
  params.push(limit, offset);
  const rows = dbAll<Record<string, unknown>>(sql, params);
  return rows.map(rowToInsight);
}

export async function getLatestWeeklyReview(userId?: string): Promise<AiCoachingInsight | null> {
  const row = dbGet<Record<string, unknown>>(
    userId
      ? `SELECT * FROM ai_insights WHERE insight_type = 'weekly_review' AND user_id = ? ORDER BY created_at DESC LIMIT 1`
      : `SELECT * FROM ai_insights WHERE insight_type = 'weekly_review' ORDER BY created_at DESC LIMIT 1`,
    userId ? [userId] : []
  );
  return row ? rowToInsight(row) : null;
}

export async function hasWeeklyReviewForPeriod(
  userId: string,
  periodStart: string,
  periodEnd: string
): Promise<boolean> {
  const row = dbGet<{count: number}>(
    `SELECT COUNT(*) as count FROM weekly_reviews
     WHERE user_id = ?
       AND period_start IS NOT NULL
       AND period_end IS NOT NULL
       AND period_start < ?
       AND period_end > ?`,
    [userId, periodEnd, periodStart]
  );
  return (row?.count ?? 0) > 0;
}

export async function markWeeklyPlanAdjustmentsApplied(
  insightId: string,
  userId: string
): Promise<void> {
  markWeeklyPlanAdjustmentsAppliedSync(insightId, userId);
}

export function markWeeklyPlanAdjustmentsAppliedSync(
  insightId: string,
  userId: string
): void {
  const now = new Date().toISOString();
  dbRun(
    `UPDATE ai_insights
     SET plan_adjustments_applied_at = ?,
         metadata = json_set(COALESCE(metadata, '{}'), '$.plan_adjustments_applied_at', ?)
     WHERE id = ? AND user_id = ? AND insight_type = 'weekly_review'
       AND plan_adjustments_applied_at IS NULL`,
    [now, now, insightId, userId]
  );
}
