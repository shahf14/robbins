import {readFile} from 'node:fs/promises';
import {join} from 'node:path';

const LOG_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export type ClientLogLine = {
  timestamp?: string;
  type?: string;
  message?: string;
  stack?: string;
  source?: string;
  line?: unknown;
  column?: unknown;
  url?: string;
  userAgent?: string;
  raw?: string;
};

export function formatJerusalemLogDate(value: Date = new Date()): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(value);

  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  return `${year}-${month}-${day}`;
}

export function isValidLogDate(value: string): boolean {
  if (!LOG_DATE_PATTERN.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function parseLogLine(line: string): ClientLogLine {
  try {
    const parsed = JSON.parse(line) as ClientLogLine;
    return parsed && typeof parsed === 'object' ? parsed : {raw: line};
  } catch {
    return {raw: line};
  }
}

export async function readClientLogLines(date: string, limit: number): Promise<ClientLogLine[]> {
  const safeLimit = Math.min(Math.max(Math.trunc(limit), 1), 500);
  const filePath = join(process.cwd(), 'logs', `${date}.log`);

  try {
    const content = await readFile(filePath, 'utf8');
    const lines = content.split('\n').filter((line) => line.trim().length > 0);
    return lines.slice(-safeLimit).map(parseLogLine).reverse();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}
