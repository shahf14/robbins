import {dbGet, dbRun, getDb} from './db/sqlite.ts';

export type RateLimitCheckInput = {
  action: string;
  userId: string;
  limit: number;
  windowMs: number;
  globalLimit: number;
  globalWindowMs: number;
  now?: number;
};

export type RateLimitCheckResult =
  | {ok: true}
  | {ok: false; limit: number; reset_at: number};

const INCREMENT_BUCKET_SQL = `
  INSERT INTO ai_rate_limit_buckets (bucket_key, count, reset_at)
  VALUES (?, 1, ?)
  ON CONFLICT(bucket_key) DO UPDATE SET
    count = CASE
      WHEN ai_rate_limit_buckets.reset_at <= ? THEN 1
      ELSE ai_rate_limit_buckets.count + 1
    END,
    reset_at = CASE
      WHEN ai_rate_limit_buckets.reset_at <= ? THEN excluded.reset_at
      ELSE ai_rate_limit_buckets.reset_at
    END
  RETURNING count, reset_at
`;

function bucketKey(action: string, userId: string) {
  return `${userId}:${action}`;
}

function ensureRateLimitTable() {
  getDb().exec(`
    CREATE TABLE IF NOT EXISTS ai_rate_limit_buckets (
      bucket_key TEXT PRIMARY KEY,
      count INTEGER NOT NULL,
      reset_at INTEGER NOT NULL
    )
  `);
}

function pruneExpiredBuckets(now: number) {
  dbRun(`DELETE FROM ai_rate_limit_buckets WHERE reset_at <= ?`, [now]);
}

/** Atomically increment a bucket (or start a new window) and return the new count. */
export function incrementRateLimitBucket(
  key: string,
  windowMs: number,
  now: number
): {count: number; reset_at: number} {
  const resetAt = now + windowMs;
  const row = dbGet<{count: number; reset_at: number}>(INCREMENT_BUCKET_SQL, [
    key,
    resetAt,
    now,
    now,
  ]);
  if (!row) {
    throw new Error('AI rate limit bucket increment failed');
  }
  return row;
}

export function checkAndIncrementRateLimit({
  action,
  userId,
  limit,
  windowMs,
  globalLimit,
  globalWindowMs,
  now = Date.now(),
}: RateLimitCheckInput): RateLimitCheckResult {
  ensureRateLimitTable();
  const db = getDb();
  db.exec('BEGIN IMMEDIATE');
  try {
    pruneExpiredBuckets(now);

    const globalBucket = incrementRateLimitBucket(
      bucketKey('__global__', userId),
      globalWindowMs,
      now
    );
    if (globalBucket.count > globalLimit) {
      db.exec('COMMIT');
      return {ok: false, limit: globalLimit, reset_at: globalBucket.reset_at};
    }

    const actionBucket = incrementRateLimitBucket(bucketKey(action, userId), windowMs, now);
    if (actionBucket.count > limit) {
      db.exec('COMMIT');
      return {ok: false, limit, reset_at: actionBucket.reset_at};
    }

    db.exec('COMMIT');
    return {ok: true};
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}
