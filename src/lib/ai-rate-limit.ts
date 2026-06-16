import {NextResponse} from 'next/server';

type RateLimitOptions = {
  action: string;
  userId: string;
  limit?: number;
  windowMs?: number;
};

type Bucket = {
  count: number;
  resetAt: number;
};

const DEFAULT_LIMIT = parsePositiveInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS, 20);
const DEFAULT_WINDOW_MS =
  parsePositiveInt(process.env.AI_RATE_LIMIT_WINDOW_SECONDS, 60 * 60) * 1000;

const buckets = new Map<string, Bucket>();

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function bucketKey({action, userId}: Pick<RateLimitOptions, 'action' | 'userId'>) {
  return `${userId}:${action}`;
}

function pruneExpiredBuckets(now: number) {
  if (buckets.size < 1000) return;

  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) {
      buckets.delete(key);
    }
  }
}

export function enforceAiRateLimit({
  action,
  userId,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
}: RateLimitOptions): NextResponse | null {
  const now = Date.now();
  pruneExpiredBuckets(now);

  const key = bucketKey({action, userId});
  const existing = buckets.get(key);
  const bucket =
    existing && existing.resetAt > now
      ? existing
      : {count: 0, resetAt: now + windowMs};

  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count <= limit) {
    return null;
  }

  const retryAfterSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

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
        'X-RateLimit-Reset': String(Math.ceil(bucket.resetAt / 1000)),
      },
    }
  );
}
