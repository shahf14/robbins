import {NextResponse} from 'next/server';
import {dbGet, dbRun, getDb} from '@/lib/db/sqlite';

type RateLimitOptions = {
  action: string;
  userId: string;
  limit?: number;
  windowMs?: number;
};

const DEFAULT_LIMIT = parsePositiveInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS, 20);
const DEFAULT_WINDOW_MS =
  parsePositiveInt(process.env.AI_RATE_LIMIT_WINDOW_SECONDS, 60 * 60) * 1000;

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function bucketKey({action, userId}: Pick<RateLimitOptions, 'action' | 'userId'>) {
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

export function enforceAiRateLimit({
  action,
  userId,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
}: RateLimitOptions): NextResponse | null {
  ensureRateLimitTable();
  const now = Date.now();
  pruneExpiredBuckets(now);

  const key = bucketKey({action, userId});
  const existing = dbGet<{count: number; reset_at: number}>(
    `SELECT count, reset_at FROM ai_rate_limit_buckets WHERE bucket_key = ?`,
    [key]
  );

  const bucket =
    existing && existing.reset_at > now
      ? existing
      : {count: 0, reset_at: now + windowMs};

  const nextCount = bucket.count + 1;

  dbRun(
    `INSERT INTO ai_rate_limit_buckets (bucket_key, count, reset_at)
     VALUES (?, ?, ?)
     ON CONFLICT(bucket_key) DO UPDATE SET
       count = excluded.count,
       reset_at = excluded.reset_at`,
    [key, nextCount, bucket.reset_at]
  );

  if (nextCount <= limit) {
    return null;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.reset_at - now) / 1000));

  return NextResponse.json(
    {
      error: 'AI rate limit exceeded.',
      retry_after_seconds: retryAfterSeconds,
    },
    {
      status: 429,
      headers: {
        'Retry-After': String(retryAfterSeconds),
        'X-RateLimit-Limit': String(limit),
        'X-RateLimit-Remaining': '0',
        'X-RateLimit-Reset': String(Math.ceil(bucket.reset_at / 1000)),
      },
    }
  );
}
