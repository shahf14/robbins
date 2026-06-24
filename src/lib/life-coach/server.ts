import {dateToYMD, todayYMD} from '@/lib/date-utils';
import {NextResponse} from 'next/server';
import {isLocale, type AppLocale} from '@/i18n/config';
import {getLifeCoachCronSecret} from '@/lib/life-coach/env';
import {JSON_BODY_LIMITS, readJsonBody} from '@/lib/read-json-body';
import type {z} from 'zod';

export {JSON_BODY_LIMITS, readJsonBody};

export async function parseLifeCoachJsonBody<T = unknown>(
  request: Request,
  schema?: z.ZodType<T>
) {
  return readJsonBody(request, {
    maxBytes: JSON_BODY_LIMITS.defaultApi,
    schema,
  });
}

export function jsonError(
  message: string,
  status = 400,
  details?: unknown,
  options?: {exposeDetails?: boolean}
) {
  const payload: {error: string; details?: unknown} = {error: message};
  const shouldExpose =
    options?.exposeDetails === true ||
    (details !== undefined && process.env.NODE_ENV !== 'production');
  if (shouldExpose && details !== undefined) {
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

export function isIsoDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export const startOfToday = todayYMD;

/** Inclusive trailing 7-day window ending today (today-6 … today). Not a calendar ISO week. */
export function trailingSevenDayWindow() {
  const today = new Date();
  const end = dateToYMD(today);
  const start = new Date(today);
  start.setDate(start.getDate() - 6);

  return {
    start: dateToYMD(start),
    end,
  };
}
