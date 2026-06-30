import {getDb} from '../db/sqlite.ts';

/** Tables with a `user_id` column, deleted before the users row (children first). */
const USER_OWNED_TABLES = [
  'weekly_reviews',
  'skip_coach_adjustments',
  'daily_steps',
  'milestones',
  'weekly_goal_focus',
  'formulation_sessions',
  'goals',
  'domain_assessments',
  'daily_reflections',
  'ai_insights',
  'streaks',
  'gamification_unlocks',
  'user_behavior_profile',
  'ritual_content',
  'morning_rituals',
  'evening_resets',
  'checkins',
  'client_log_entries',
  'client_log_usage',
  'api_idempotency_records',
] as const;

function tableExists(db: ReturnType<typeof getDb>, table: string): boolean {
  const row = db
    .prepare(`SELECT 1 AS ok FROM sqlite_master WHERE type = 'table' AND name = ?`)
    .get(table) as {ok: number} | undefined;
  return !!row?.ok;
}

/**
 * Deletes all persisted data for a user in dependency-safe order.
 * Uses an explicit wipe instead of relying only on SQLite cascades/triggers so
 * older local DB shapes (missing FKs) still reset cleanly.
 */
export function deleteUserAccountSync(userId: string): void {
  const db = getDb();

  db.pragma('foreign_keys = OFF');
  db.exec('BEGIN');
  try {
    if (tableExists(db, 'gratitude_entries')) {
      db.prepare(
        `DELETE FROM gratitude_entries
         WHERE user_id = ?
            OR ritual_id IN (SELECT id FROM morning_rituals WHERE user_id = ?)`
      ).run(userId, userId);
    }

    for (const table of USER_OWNED_TABLES) {
      if (!tableExists(db, table)) continue;
      db.prepare(`DELETE FROM ${table} WHERE user_id = ?`).run(userId);
    }

    db.prepare(`DELETE FROM users WHERE id = ?`).run(userId);
    db.exec('COMMIT');
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  } finally {
    db.pragma('foreign_keys = ON');
  }
}
