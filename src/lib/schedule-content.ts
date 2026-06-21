import type {AppLocale} from '@/i18n/config';
import {defaultEveningMode} from '@/lib/life-context-content';
import type {EveningMode} from '@/lib/evening-reset-types';
import type {LifeContextStatus} from '@/lib/life-coach/types';
import type {HealthAnchorHabit} from '@/lib/life-coach/types';
import type {PreferredActionWindow} from '@/lib/user-preferences';

export type PersonalDayPhase = 'pre_wake' | 'morning' | 'afternoon' | 'evening' | 'night';
export type ToolsBarFocus = 'morning' | 'daytime' | 'evening' | 'night';

const DEFAULT_WAKE = '07:00';
const DEFAULT_SLEEP = '22:30';

export function parseTimeToMinutes(time: string): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + (m ?? 0);
}

function formatMinutesToTime(minutes: number): string {
  const normalized = ((minutes % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(normalized / 60);
  const m = normalized % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isBeforeWakeTime(wakeTime = DEFAULT_WAKE, now = new Date()): boolean {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  return currentMinutes < parseTimeToMinutes(wakeTime);
}

export function getPersonalDayPhase(
  wakeTime = DEFAULT_WAKE,
  sleepTime = DEFAULT_SLEEP,
  now = new Date()
): PersonalDayPhase {
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  const wake = parseTimeToMinutes(wakeTime);
  const sleep = parseTimeToMinutes(sleepTime);
  const windDownStart = sleep - 90;

  if (currentMinutes < wake) {
    return 'pre_wake';
  }
  if (currentMinutes < wake + 4 * 60) {
    return 'morning';
  }
  if (currentMinutes < wake + 8 * 60) {
    return 'afternoon';
  }
  if (currentMinutes < windDownStart) {
    return 'evening';
  }
  if (currentMinutes < sleep) {
    return 'evening';
  }
  return 'night';
}

export function personalDashboardSubtitleKey(phase: PersonalDayPhase, beforeWake: boolean): string {
  if (beforeWake) {
    return 'schedule.dashboard.subtitle.beforeWake';
  }
  const phaseKey =
    phase === 'pre_wake' ? 'preWake'
    : phase === 'morning' ? 'morning'
    : phase === 'afternoon' ? 'afternoon'
    : phase === 'evening' ? 'evening'
    : 'night';
  return `schedule.dashboard.subtitle.${phaseKey}`;
}

export function assignSuggestedStepTimes(
  stepCount: number,
  wakeTime = DEFAULT_WAKE,
  sleepTime = DEFAULT_SLEEP,
  preferredActionWindow: PreferredActionWindow = 'flexible'
): string[] {
  if (stepCount <= 0) {
    return [];
  }

  const wake = parseTimeToMinutes(wakeTime);
  const sleep = parseTimeToMinutes(sleepTime);
  const windDown = sleep - 90;
  const activeEnd = sleep - 60;

  const clamp = (minutes: number) =>
    formatMinutesToTime(Math.min(Math.max(minutes, wake + 15), activeEnd));

  let rawTimes: number[];

  if (preferredActionWindow === 'morning') {
    rawTimes = [wake + 30, wake + 120, wake + 210];
  } else if (preferredActionWindow === 'midday') {
    rawTimes = [wake + 180, wake + 270, wake + 360];
  } else if (preferredActionWindow === 'evening') {
    rawTimes = [Math.max(wake + 600, windDown - 60), windDown, windDown + 30];
  } else if (stepCount === 1) {
    rawTimes = [wake + 30];
  } else if (stepCount === 2) {
    rawTimes = [wake + 30, Math.min(wake + 4 * 60, windDown)];
  } else {
    rawTimes = [wake + 30, wake + 4 * 60, windDown];
  }

  return rawTimes.slice(0, stepCount).map(clamp);
}

export function addMinutesToTime(time: string, deltaMinutes: number): string {
  return formatMinutesToTime(parseTimeToMinutes(time) + deltaMinutes);
}

export type ToolsBarToolId = 'morning' | 'evening' | 'coach';

const DEFAULT_TOOL_ORDER: Record<ToolsBarFocus, ToolsBarToolId[]> = {
  morning: ['morning', 'coach'],
  daytime: ['morning', 'coach'],
  evening: ['evening', 'coach'],
  night: [],
};

const CONTEXT_TOOL_ORDER: Partial<
  Record<LifeContextStatus, Partial<Record<ToolsBarFocus, ToolsBarToolId[]>>>
> = {
  new_parent: {
    morning: ['morning', 'coach'],
    daytime: ['coach', 'morning'],
    evening: ['evening', 'coach'],
  },
  manager: {
    morning: ['morning', 'coach'],
    daytime: ['coach', 'morning'],
    evening: ['evening', 'coach'],
  },
  student: {
    morning: ['morning', 'coach'],
    daytime: ['coach', 'morning'],
    evening: ['evening', 'coach'],
  },
  between_jobs: {
    morning: ['morning', 'coach'],
    daytime: ['coach', 'morning'],
    evening: ['evening', 'coach'],
  },
  caregiver: {
    morning: ['morning', 'coach'],
    evening: ['evening', 'coach'],
  },
};

export function getToolsBarOrder(
  focus: ToolsBarFocus,
  lifeContexts?: LifeContextStatus[] | null
): ToolsBarToolId[] {
  const fallback = DEFAULT_TOOL_ORDER[focus] ?? DEFAULT_TOOL_ORDER.morning;
  const active = (lifeContexts ?? []).filter(
    (s) => s !== 'prefer_not' && s in CONTEXT_TOOL_ORDER
  ) as LifeContextStatus[];
  if (active.length === 0 || focus === 'night') {
    return fallback;
  }

  const merged: ToolsBarToolId[] = [];
  const seen = new Set<ToolsBarToolId>();
  for (const ctx of active) {
    for (const tool of CONTEXT_TOOL_ORDER[ctx]?.[focus] ?? fallback) {
      if (!seen.has(tool)) {
        seen.add(tool);
        merged.push(tool);
      }
    }
  }
  for (const tool of fallback) {
    if (!seen.has(tool)) {
      merged.push(tool);
    }
  }
  return merged.slice(0, 3);
}

export function getToolsBarFocus(
  wakeTime = DEFAULT_WAKE,
  sleepTime = DEFAULT_SLEEP,
  now = new Date()
): ToolsBarFocus {
  const phase = getPersonalDayPhase(wakeTime, sleepTime, now);
  if (phase === 'pre_wake' || phase === 'morning') {
    return 'morning';
  }
  if (phase === 'afternoon') {
    return 'daytime';
  }
  if (phase === 'evening') {
    return 'evening';
  }
  return 'night';
}

function isLateSleepTime(sleepTime = DEFAULT_SLEEP): boolean {
  return parseTimeToMinutes(sleepTime) >= 23 * 60 + 30;
}

export function getEveningScheduleDefaults(sleepTime = DEFAULT_SLEEP, locale: AppLocale = 'he') {
  const screenOffTime = addMinutesToTime(sleepTime, -30);
  const sleepTarget =
    locale === 'he'
      ? `אני הולך/ת לישון ב-${sleepTime}`
      : `I'm going to sleep at ${sleepTime}`;
  const screenOffSuggestion =
    locale === 'he'
      ? `כיבוי מסכים ב-${screenOffTime}`
      : `Screens off at ${screenOffTime}`;
  return {
    sleepTarget,
    screenOffTime,
    screenOffSuggestion,
    suggestQuickMode: isLateSleepTime(sleepTime),
  };
}

export function suggestedEveningModeFromSchedule(
  sleepTime: string,
  lifeContexts: LifeContextStatus[] | null | undefined
): EveningMode {
  if (isLateSleepTime(sleepTime)) {
    return 'quick';
  }
  return defaultEveningMode(lifeContexts);
}

export function suggestedEveningModeScheduleKey(sleepTime: string): string | null {
  return isLateSleepTime(sleepTime) ? 'schedule.evening.suggestLateSleep' : null;
}

function getAwakeDurationMinutes(
  wakeTime = DEFAULT_WAKE,
  sleepTime = DEFAULT_SLEEP
): number {
  const wake = parseTimeToMinutes(wakeTime);
  const sleep = parseTimeToMinutes(sleepTime);
  let diff = sleep - wake;
  if (diff <= 0) {
    diff += 24 * 60;
  }
  return diff;
}

export function isShortAwakeDay(
  wakeTime = DEFAULT_WAKE,
  sleepTime = DEFAULT_SLEEP
): boolean {
  return getAwakeDurationMinutes(wakeTime, sleepTime) < 7 * 60;
}

export function inferPreferredActionWindow(
  wakeTime = DEFAULT_WAKE,
  sleepTime = DEFAULT_SLEEP
): PreferredActionWindow {
  const wake = parseTimeToMinutes(wakeTime);
  const sleep = parseTimeToMinutes(sleepTime);

  if (wake <= 6 * 60 + 30 && sleep <= 22 * 60) {
    return 'morning';
  }
  if (wake >= 9 * 60 && (sleep <= 3 * 60 || sleep >= 23 * 60)) {
    return 'evening';
  }
  if (wake >= 7 * 60 && wake <= 8 * 60 + 30 && sleep >= 22 * 60 + 30) {
    return 'midday';
  }
  return 'flexible';
}

export function defaultAnchorTimeForHabit(
  habit: HealthAnchorHabit,
  wakeTime = DEFAULT_WAKE,
  sleepTime = DEFAULT_SLEEP
): string {
  const wake = parseTimeToMinutes(wakeTime);
  const sleep = parseTimeToMinutes(sleepTime);

  switch (habit) {
    case 'morning_coffee':
      return formatMinutesToTime(wake + 20);
    case 'before_shower':
      return formatMinutesToTime(wake + 45);
    case 'commute':
      return formatMinutesToTime(wake + 60);
    case 'lunch_break':
      return formatMinutesToTime(wake + 5 * 60);
    case 'after_kids_school':
      return formatMinutesToTime(wake + 8 * 60);
    case 'after_work':
      return formatMinutesToTime(Math.min(wake + 9 * 60, sleep - 120));
    case 'before_evening_meal':
      return formatMinutesToTime(Math.max(wake + 10 * 60, sleep - 150));
    case 'before_sleep':
      return formatMinutesToTime(sleep - 30);
    default:
      return formatMinutesToTime(wake + 30);
  }
}

export function isPastWakeTimeInTimezone(
  wakeTime = DEFAULT_WAKE,
  timezone = 'UTC',
  now = new Date()
): boolean {
  const formatter = new Intl.DateTimeFormat('en-GB', {
    timeZone: timezone,
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = formatter.formatToParts(now);
  const hour = Number(parts.find((p) => p.type === 'hour')?.value ?? 0);
  const minute = Number(parts.find((p) => p.type === 'minute')?.value ?? 0);
  const current = hour * 60 + minute;
  return current >= parseTimeToMinutes(wakeTime);
}
