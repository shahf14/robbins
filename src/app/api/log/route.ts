import {mkdir, appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {NextResponse} from 'next/server';
import {tooManyRequests, payloadTooLarge} from '@/lib/api-response';
import {requireCurrentUser} from '@/lib/auth/get-current-user';
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

  if (!checkRateLimit(request)) {
    return tooManyRequests('Too many log requests');
  }

  const declaredLength = Number(request.headers.get('content-length') ?? 0);
  if (declaredLength > MAX_LOG_BODY_BYTES) {
    return payloadTooLarge('Log payload is too large');
  }

  let payload: ClientLogPayload;

  try {
    const raw = await request.text();
    if (Buffer.byteLength(raw, 'utf8') > MAX_LOG_BODY_BYTES) {
      return payloadTooLarge('Log payload is too large');
    }
    payload = parseJsonObjectOr<ClientLogPayload>(raw, {});
  } catch {
    payload = {
      type: 'invalid-log-payload',
      message: 'Could not parse client log payload.',
      timestamp: new Date().toISOString()
    };
  }

  await writeClientLog(payload);

  return NextResponse.json({ok: true});
}

function checkRateLimit(request: Request) {
  const key = clientKey(request);
  const now = Date.now();
  const entry = logRateLimit.get(key);

  if (!entry || entry.resetAt <= now) {
    pruneRateLimit(now);
    logRateLimit.set(key, {count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS});
    return true;
  }

  entry.count += 1;
  return entry.count <= RATE_LIMIT_MAX_REQUESTS;
}

function clientKey(request: Request) {
  const forwardedFor = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = request.headers.get('x-real-ip')?.trim();
  return forwardedFor || realIp || 'local';
}

function pruneRateLimit(now: number) {
  if (logRateLimit.size < 1000) return;
  for (const [key, entry] of logRateLimit) {
    if (entry.resetAt <= now) logRateLimit.delete(key);
  }
}

async function writeClientLog(payload: ClientLogPayload) {
  const logsDir = join(process.cwd(), 'logs');
  const fileName = `${formatJerusalemDate(new Date())}.log`;
  const logLine =
    JSON.stringify({
      timestamp: stringValue(payload.timestamp) || new Date().toISOString(),
      type: stringValue(payload.type) || 'client-log',
      message: stringValue(payload.message),
      stack: stringValue(payload.stack),
      source: stringValue(payload.source),
      line: payload.line,
      column: payload.column,
      url: stringValue(payload.url),
      userAgent: stringValue(payload.userAgent)
    }) + '\n';

  await mkdir(logsDir, {recursive: true});
  await appendFile(join(logsDir, fileName), logLine, 'utf8');
}

function stringValue(value: unknown) {
  return typeof value === 'string' ? value.slice(0, MAX_LOG_FIELD_LENGTH) : undefined;
}

function formatJerusalemDate(value: Date) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(value);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}
