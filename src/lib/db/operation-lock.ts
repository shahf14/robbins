import {getDb} from './sqlite';

function ensureLockTable(): void {
  getDb()
    .prepare(
      `CREATE TABLE IF NOT EXISTS cron_job_locks (
         job TEXT PRIMARY KEY,
         lock_expires_at INTEGER NOT NULL
       )`
    )
    .run();
}

/**
 * Try to acquire an exclusive lock. Returns true when this holder should proceed.
 * Uses INSERT OR IGNORE against a single-row-per-key table.
 */
export function tryAcquireOperationLock(lockKey: string, lockTtlMs: number): boolean {
  ensureLockTable();
  const now = Date.now();
  const expiresAt = now + lockTtlMs;
  const db = getDb();

  db.prepare(`DELETE FROM cron_job_locks WHERE job = ? AND lock_expires_at < ?`).run(lockKey, now);

  const result = db
    .prepare(`INSERT OR IGNORE INTO cron_job_locks (job, lock_expires_at) VALUES (?, ?)`)
    .run(lockKey, expiresAt);

  return result.changes > 0;
}

export function releaseOperationLock(lockKey: string): void {
  ensureLockTable();
  getDb().prepare(`DELETE FROM cron_job_locks WHERE job = ?`).run(lockKey);
}
