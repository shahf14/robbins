import {isSqliteUniqueConstraintError} from '@/lib/goal-create-idempotency';
import {dbGet, dbRun} from '@/lib/db/sqlite';

export type ApiIdempotencyScope = 'daily-step-status';

export function findStoredIdempotencyPayload(
  userId: string,
  scope: ApiIdempotencyScope,
  key: string
): string | null {
  const row = dbGet<{response_json: string}>(
    `SELECT response_json FROM api_idempotency_records
     WHERE user_id = ? AND scope = ? AND idempotency_key = ?`,
    [userId, scope, key]
  );
  return row?.response_json ?? null;
}

export function storeIdempotencyPayload(
  userId: string,
  scope: ApiIdempotencyScope,
  key: string,
  resourceId: string | null,
  payload: unknown
): void {
  const responseJson = JSON.stringify(payload);
  try {
    dbRun(
      `INSERT INTO api_idempotency_records
        (user_id, scope, idempotency_key, resource_id, response_json, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [userId, scope, key, resourceId, responseJson]
    );
  } catch (error) {
    if (!isSqliteUniqueConstraintError(error)) throw error;
    const existing = findStoredIdempotencyPayload(userId, scope, key);
    if (existing && existing !== responseJson) {
      throw new Error('Idempotency key reused with a different request payload.');
    }
  }
}
