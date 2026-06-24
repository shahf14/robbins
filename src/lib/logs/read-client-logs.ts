import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export type ClientLogLine = {
  timestamp?: string;
  type?: string;
  message?: string;
  stack?: string;
  raw?: string;
};

export function isValidLogDate(date: string): boolean {
  return ISO_DATE_RE.test(date);
}

export async function readClientLogsForDate(date: string, limit = 200): Promise<ClientLogLine[]> {
  if (!isValidLogDate(date)) {
    throw new Error('Invalid date. Expected YYYY-MM-DD.');
  }

  const safeLimit = Math.min(500, Math.max(1, Math.round(limit) || 200));
  const filePath = join(process.cwd(), 'logs', `${date}.log`);

  let content: string;
  try {
    content = await readFile(filePath, 'utf8');
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }

  const lines = content.split('\n').filter(Boolean);
  const parsed: ClientLogLine[] = [];

  for (const line of lines.slice(-safeLimit)) {
    try {
      const value = JSON.parse(line) as Record<string, unknown>;
      parsed.push({
        timestamp: typeof value.timestamp === 'string' ? value.timestamp : undefined,
        type: typeof value.type === 'string' ? value.type : undefined,
        message: typeof value.message === 'string' ? value.message : undefined,
        stack: typeof value.stack === 'string' ? value.stack : undefined,
      });
    } catch {
      parsed.push({raw: line});
    }
  }

  return parsed.reverse();
}
