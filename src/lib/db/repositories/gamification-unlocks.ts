import {randomUUID} from 'crypto';
import {dbAll, dbGet, dbRun} from '../sqlite';
import {parseJsonOr} from '@/lib/safe-json';

export type GamificationUnlockKind = 'mystery_unlock' | 'reflection_loot' | 'identity_title';

type GamificationUnlockRow = {
  id: string;
  user_id: string;
  kind: GamificationUnlockKind;
  reward_key: string;
  week_start: string | null;
  context_json: string | null;
  created_at: string;
};

export type GamificationUnlock = {
  id: string;
  kind: GamificationUnlockKind;
  reward_key: string;
  week_start: string | null;
  context: Record<string, unknown> | null;
  created_at: string;
};

function rowToUnlock(row: GamificationUnlockRow): GamificationUnlock {
  return {
    id: row.id,
    kind: row.kind,
    reward_key: row.reward_key,
    week_start: row.week_start,
    context: row.context_json ? parseJsonOr<Record<string, unknown> | null>(row.context_json, null) : null,
    created_at: row.created_at,
  };
}

/** Save a gamification unlock event. For `mystery_unlock`, dedupes on (kind, reward_key, week_start). */
export function saveGamificationUnlock(
  userId: string,
  input: {
    kind: GamificationUnlockKind;
    reward_key: string;
    week_start?: string | null;
    context?: Record<string, unknown> | null;
  }
): GamificationUnlock | null {
  if (input.kind === 'mystery_unlock' || input.kind === 'identity_title') {
    const existing = dbGet<{id: string}>(
      `SELECT id FROM gamification_unlocks
        WHERE user_id = ? AND kind = ? AND reward_key = ? AND COALESCE(week_start, '') = COALESCE(?, '')`,
      [userId, input.kind, input.reward_key, input.week_start ?? null]
    );
    if (existing) return null;
  }

  const id = randomUUID();
  const created_at = new Date().toISOString();
  dbRun(
    `INSERT INTO gamification_unlocks (id, user_id, kind, reward_key, week_start, context_json, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [
      id,
      userId,
      input.kind,
      input.reward_key,
      input.week_start ?? null,
      input.context ? JSON.stringify(input.context) : null,
      created_at,
    ]
  );

  return {
    id,
    kind: input.kind,
    reward_key: input.reward_key,
    week_start: input.week_start ?? null,
    context: input.context ?? null,
    created_at,
  };
}

export function listGamificationUnlocks(userId: string, limit = 50): GamificationUnlock[] {
  const rows = dbAll<GamificationUnlockRow>(
    `SELECT * FROM gamification_unlocks WHERE user_id = ? ORDER BY created_at DESC LIMIT ?`,
    [userId, limit]
  );
  return rows.map(rowToUnlock);
}

export function listGamificationUnlocksSince(userId: string, sinceDate: string): GamificationUnlock[] {
  const rows = dbAll<GamificationUnlockRow>(
    `SELECT * FROM gamification_unlocks WHERE user_id = ? AND created_at >= ? ORDER BY created_at DESC`,
    [userId, sinceDate]
  );
  return rows.map(rowToUnlock);
}
