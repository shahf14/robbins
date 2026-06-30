import {jsonError, jsonOk} from '@/lib/api-response';
import {dateToYMD, daysBetweenYMD, todayYMD} from '@/lib/date-utils';
import {defaultLocale, isLocale, type AppLocale} from '@/i18n/config';
import {getLifeCoachCronSecret} from '@/lib/life-coach/env';
import {JSON_BODY_LIMITS, readJsonBody} from '@/lib/read-json-body';
import type {z} from 'zod';

export {jsonError, jsonOk, jsonMutation, jsonNoContent} from '@/lib/api-response';
export type {MutationSuccess} from '@/lib/api-response';
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

export function resolveLocale(input?: string | null): AppLocale {
  return input && isLocale(input) ? input : defaultLocale;
}

export function parseLocaleQueryParam(
  value: string | null,
  fallback: AppLocale = defaultLocale
):
  | {ok: true; locale: AppLocale}
  | {ok: false; response: ReturnType<typeof jsonError>} {
  if (value === null || value === '') {
    return {ok: true, locale: fallback};
  }
  if (!isLocale(value)) {
    return {ok: false, response: jsonError('Invalid locale. Expected en or he.', 400)};
  }
  return {ok: true, locale: value};
}

export const MAX_DAILY_STEPS_DATE_RANGE_DAYS = 90;

export function isDailyStepsDateRangeWithinLimit(start: string, end: string): boolean {
  return daysBetweenYMD(start, end) <= MAX_DAILY_STEPS_DATE_RANGE_DAYS;
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
