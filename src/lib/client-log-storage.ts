import {randomUUID} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {join, relative, resolve} from 'node:path';
import {formatJerusalemLogDate, isValidLogDate, type ClientLogLine} from '@/lib/client-logs';
import {dbAll, dbGet, dbRun, getDb} from '@/lib/db/sqlite';

export const MAX_LOG_BYTES_PER_USER_DAY = 512_000;

export class ClientLogQuotaExceededError extends Error {
  constructor() {
    super('Daily log quota exceeded');
    this.name = 'ClientLogQuotaExceededError';
  }
}

export function resolveClientLogFilePath(
  date: string,
  logsRoot = join(process.cwd(), 'logs')
): string {
  if (!isValidLogDate(date)) {
    throw new Error('Invalid log date.');
  }

  const fileName = `${date}.log`;
  if (fileName.includes('/') || fileName.includes('\\') || fileName.includes('..')) {
    throw new Error('Invalid log file name.');
  }

  const resolvedRoot = resolve(logsRoot);
  const resolvedPath = resolve(resolvedRoot, fileName);
  const relativePath = relative(resolvedRoot, resolvedPath);
  if (relativePath.startsWith('..') || relativePath.includes('..')) {
    throw new Error('Log path escapes logs directory.');
  }

  return resolvedPath;
}

function parseLogLine(line: string): ClientLogLine {
  try {
    const parsed = JSON.parse(line) as ClientLogLine;
    return parsed && typeof parsed === 'object' ? parsed : {raw: line};
  } catch {
    return {raw: line};
  }
}

export function appendClientLogEntrySync(userId: string, logLine: string): void {
  const logDate = formatJerusalemLogDate();
  const normalizedLine = logLine.endsWith('\n') ? logLine.slice(0, -1) : logLine;
  const bytes = Buffer.byteLength(`${normalizedLine}\n`, 'utf8');

  getDb().transaction(() => {
    const row = dbGet<{bytes_written: number}>(
      `SELECT bytes_written FROM client_log_usage WHERE user_id = ? AND log_date = ?`,
      [userId, logDate]
    );
    const currentBytes = row?.bytes_written ?? 0;
    if (currentBytes + bytes > MAX_LOG_BYTES_PER_USER_DAY) {
      throw new ClientLogQuotaExceededError();
    }

    dbRun(
      `INSERT INTO client_log_entries (id, user_id, log_date, line_json, bytes, created_at)
       VALUES (?, ?, ?, ?, ?, datetime('now'))`,
      [randomUUID(), userId, logDate, normalizedLine, bytes]
    );
    dbRun(
      `INSERT INTO client_log_usage (user_id, log_date, bytes_written)
       VALUES (?, ?, ?)
       ON CONFLICT(user_id, log_date) DO UPDATE SET
         bytes_written = client_log_usage.bytes_written + excluded.bytes_written`,
      [userId, logDate, bytes]
    );
  })();
}

async function readLegacyLogLines(date: string, limit: number): Promise<ClientLogLine[]> {
  const filePath = resolveClientLogFilePath(date);
  try {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n').filter((line) => line.trim().length > 0);
    return lines.slice(-limit).map(parseLogLine).reverse();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function readDatabaseLogLines(date: string, limit: number): ClientLogLine[] {
  const rows = dbAll<{line_json: string}>(
    `SELECT line_json FROM client_log_entries
     WHERE log_date = ?
     ORDER BY created_at DESC
     LIMIT ?`,
    [date, limit]
  );
  return rows.map((row) => parseLogLine(row.line_json));
}

export async function readClientLogLines(date: string, limit: number): Promise<ClientLogLine[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const dbLines = readDatabaseLogLines(date, safeLimit);
  if (dbLines.length > 0) {
    return dbLines;
  }
  return readLegacyLogLines(date, safeLimit);
}
