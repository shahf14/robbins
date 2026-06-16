import {dbGet, dbRun} from '@/lib/db/sqlite';
import {parseJsonOr} from '@/lib/safe-json';
import type {ToneEffectiveness} from './types';

export function getToneEffectiveness(userId: string): ToneEffectiveness | null {
  const row = dbGet<{tone_effectiveness: string | null}>(
    `SELECT tone_effectiveness FROM user_behavior_profile WHERE user_id = ?`,
    [userId]
  );
  if (!row?.tone_effectiveness) return null;
  return parseJsonOr<ToneEffectiveness | null>(row.tone_effectiveness, null);
}

export function saveToneEffectiveness(
  userId: string,
  effectiveness: ToneEffectiveness
): void {
  const payload = JSON.stringify(effectiveness);
  const existing = dbGet<{user_id: string}>(
    `SELECT user_id FROM user_behavior_profile WHERE user_id = ?`,
    [userId]
  );

  if (existing) {
    dbRun(
      `UPDATE user_behavior_profile SET tone_effectiveness = ?, updated_at = ? WHERE user_id = ?`,
      [payload, new Date().toISOString(), userId]
    );
    return;
  }

  dbRun(
    `INSERT INTO user_behavior_profile (user_id, tone_effectiveness, updated_at)
     VALUES (?, ?, ?)`,
    [userId, payload, new Date().toISOString()]
  );
}
