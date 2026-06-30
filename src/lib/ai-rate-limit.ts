import {NextResponse} from 'next/server';
import {checkAndIncrementRateLimit} from '@/lib/ai-rate-limit-store';

export type RateLimitOptions = {
  action: string;
  userId: string;
  limit?: number;
  windowMs?: number;
};

export class AiRateLimitExceededError extends Error {
  constructor(
    readonly limit: number,
    readonly resetAt: number
  ) {
    super('AI rate limit exceeded.');
    this.name = 'AiRateLimitExceededError';
  }
}

const DEFAULT_LIMIT = parsePositiveInt(process.env.AI_RATE_LIMIT_MAX_REQUESTS, 20);
const DEFAULT_WINDOW_MS =
  parsePositiveInt(process.env.AI_RATE_LIMIT_WINDOW_SECONDS, 60 * 60) * 1000;

const GLOBAL_LIMIT = parsePositiveInt(process.env.AI_RATE_LIMIT_GLOBAL_MAX, 50);
const GLOBAL_WINDOW_MS =
  parsePositiveInt(process.env.AI_RATE_LIMIT_GLOBAL_WINDOW_SECONDS, 60 * 60) * 1000;

function parsePositiveInt(value: string | undefined, fallback: number) {
  if (!value) return fallback;
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
}

function rateLimitResponse(limit: number, resetAt: number, now: number): NextResponse {
  const retryAfterSeconds = Math.max(1, Math.ceil((resetAt - now) / 1000));
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
        'X-RateLimit-Reset': String(Math.ceil(resetAt / 1000)),
      },
    }
  );
}

/** Increment AI rate-limit buckets; throws when the user is over limit. */
export function consumeAiRateLimit({
  action,
  userId,
  limit = DEFAULT_LIMIT,
  windowMs = DEFAULT_WINDOW_MS,
}: RateLimitOptions): void {
  const now = Date.now();
  const result = checkAndIncrementRateLimit({
    action,
    userId,
    limit,
    windowMs,
    globalLimit: GLOBAL_LIMIT,
    globalWindowMs: GLOBAL_WINDOW_MS,
    now,
  });

  if (!result.ok) {
    throw new AiRateLimitExceededError(result.limit, result.reset_at);
  }
}

export function enforceAiRateLimit(options: RateLimitOptions): NextResponse | null {
  const now = Date.now();
  try {
    consumeAiRateLimit(options);
    return null;
  } catch (error) {
    if (error instanceof AiRateLimitExceededError) {
      return rateLimitResponse(error.limit, error.resetAt, now);
    }
    throw error;
  }
}
