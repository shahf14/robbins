import {jsonError, jsonMutation} from '@/lib/life-coach/server';
import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {
  appendClientLogEntrySync,
  ClientLogQuotaExceededError,
  MAX_LOG_BYTES_PER_USER_DAY,
} from '@/lib/client-log-storage';
import {redactLogFields, sanitizeLogLine} from '@/lib/log-redaction';
import {parseJsonObjectOr} from '@/lib/safe-json';

type ClientLogPayload = {
  type?: unknown;
  message?: unknown;
  stack?: unknown;
  source?: unknown;
  line?: unknown;
  column?: unknown;
  url?: unknown;
  userAgent?: unknown;
  timestamp?: unknown;
};

const MAX_LOG_BODY_BYTES = 32_768;
const MAX_LOG_FIELD_LENGTH = 8_192;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX_REQUESTS = 60;
const logRateLimit = new Map<string, {count: number; resetAt: number}>();

export async function POST(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  if (!checkRateLimit(current.user.id)) {
    return jsonError('Too many log requests', 429);
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_LOG_BODY_BYTES) {
    return jsonError('Log payload is too large', 413);
  }

  let payload: ClientLogPayload;

  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_LOG_BODY_BYTES) {
      return jsonError('Log payload is too large', 413);
    }
    payload = parseJsonObjectOr<ClientLogPayload>(raw, {});
  } catch {
    payload = {
      type: 'invalid-log-payload',
      message: 'Could not parse client log payload.',
      timestamp: new Date().toISOString(),
    };
  }

  const logLine = sanitizeLogLine(buildLogLine(payload));

  try {
    appendClientLogEntrySync(current.user.id, logLine);
  } catch (error) {
    if (error instanceof ClientLogQuotaExceededError) {
      return jsonError('Daily log quota exceeded', 413);
    }
    throw error;
  }

  return jsonMutation();
}

function checkRateLimit(userId: string) {
  const now = Date.now();
  const entry = logRateLimit.get(userId);

  if (!entry || entry.resetAt <= now) {
    pruneRateLimit(now);
    logRateLimit.set(userId, {count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS});
    return true;
  }

  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX_REQUESTS;
}

function pruneRateLimit(now: number) {
  if (logRateLimit.size < 1000) return;
  for (const [key, entry] of logRateLimit) {
    if (entry.resetAt <= now) logRateLimit.delete(key);
  }
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.slice(0, MAX_LOG_FIELD_LENGTH) : undefined;
}

function buildLogLine(payload: ClientLogPayload) {
  const redacted = redactLogFields({
    message: stringValue(payload.message),
    stack: stringValue(payload.stack),
    url: stringValue(payload.url),
    userAgent: stringValue(payload.userAgent),
  });

  return (
    JSON.stringify({
      timestamp: stringValue(payload.timestamp) || new Date().toISOString(),
      type: stringValue(payload.type) || 'client-log',
      message: redacted.message,
      stack: redacted.stack,
      source: stringValue(payload.source),
      line: payload.line,
      column: payload.column,
      url: redacted.url,
      userAgent: redacted.userAgent,
    }) + '\n'
  );
}

export {MAX_LOG_BYTES_PER_USER_DAY};
