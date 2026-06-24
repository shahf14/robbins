import {mkdir, appendFile} from 'node:fs/promises';
import {join} from 'node:path';
import {NextResponse} from 'next/server';
import {tooManyRequests, payloadTooLarge} from '@/lib/api-response';
import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {formatJerusalemLogDate} from '@/lib/client-logs';
import {dbGet, dbRun} from '@/lib/db/sqlite';
import {redactLogFields} from '@/lib/log-redaction';
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
const MAX_LOG_BYTES_PER_USER_DAY = 512_000;
const logRateLimit = new Map<string, {count: number; resetAt: number}>();

export async function POST(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  if (!checkRateLimit(current.user.id)) {
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
      timestamp: new Date().toISOString(),
    };
  }

  const logLine = buildLogLine(payload);
  if (!canWriteLogBytes(current.user.id, Buffer.byteLength(logLine, 'utf8'))) {
    return payloadTooLarge('Daily log quota exceeded');
  }

  await writeClientLog(current.user.id, logLine);

  return NextResponse.json({ok: true});
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

function canWriteLogBytes(userId: string, nextBytes: number) {
  const logDate = formatJerusalemLogDate();
  const row = dbGet<{bytes_written: number}>(
    `SELECT bytes_written FROM client_log_usage WHERE user_id = ? AND log_date = ?`,
    [userId, logDate]
  );
  const currentBytes = row?.bytes_written ?? 0;
  return currentBytes + nextBytes <= MAX_LOG_BYTES_PER_USER_DAY;
}

function recordLogBytes(userId: string, bytes: number) {
  const logDate = formatJerusalemLogDate();
  dbRun(
    `INSERT INTO client_log_usage (user_id, log_date, bytes_written)
     VALUES (?, ?, ?)
     ON CONFLICT(user_id, log_date) DO UPDATE SET
       bytes_written = client_log_usage.bytes_written + excluded.bytes_written`,
    [userId, logDate, bytes]
  );
}

async function writeClientLog(userId: string, logLine: string) {
  const logsDir = join(process.cwd(), 'logs');
  const fileName = `${formatJerusalemLogDate()}.log`;

  await mkdir(logsDir, {recursive: true});
  await appendFile(join(logsDir, fileName), logLine, 'utf8');
  recordLogBytes(userId, Buffer.byteLength(logLine, 'utf8'));
}
