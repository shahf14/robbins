import {dateToYMD} from '@/lib/date-utils';
import {NextResponse} from 'next/server';
import {isLocale, type AppLocale} from '@/i18n/config';
import {getLifeCoachCronSecret} from '@/lib/life-coach/env';

export function jsonError(message: string, status = 400, details?: unknown) {
  const payload: {error: string; details?: unknown} = {error: message};
  if (details !== undefined && process.env.NODE_ENV !== 'production') {
    payload.details = details;
  }
  return NextResponse.json(payload, {status});
}

export function jsonOk(data: Record<string, unknown>, status = 200) {
  return NextResponse.json(data, {status});
}

export function resolveLocale(input?: string | null): AppLocale {
  return input && isLocale(input) ? input : 'en';
}

export function verifyCronRequest(request: Request) {
  const authorization = request.headers.get('authorization') ?? '';
  const expected = `Bearer ${getLifeCoachCronSecret()}`;

  if (authorization !== expected) {
    return jsonError('Unauthorized', 401);
  }

  return null;
}

function localDateStr(d: Date = new Date()): string {
  return dateToYMD(d);
}

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function startOfToday() {
  return localDateStr();
}

export function currentWeekWindow() {
  const today = new Date();
  const end = localDateStr(today);
  const start = new Date(today);
  start.setDate(start.getDate() - 6);

  return {
    start: localDateStr(start),
    end,
  };
}

export function openAiRequestSignal() {
  return AbortSignal.timeout(15_000);
}
