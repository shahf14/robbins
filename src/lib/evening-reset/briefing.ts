import type {AppLocale} from '@/i18n/config';
import type {EveningResetSession} from '@/lib/evening-reset-types';

type EveningEnergyForecast = 'low' | 'medium' | 'high';

export type EveningBriefingFields = {
  tomorrow_constraint: string | null;
  what_worked: string | null;
  what_failed: string | null;
  energy_forecast: EveningEnergyForecast | null;
  tasks_too_big: boolean;
};

const TOO_BIG_HE = /גדול(?:ה)?\s*מדי|כבד(?:ה)?\s*מדי|ארוך(?:ה)?\s*מדי|הרבה\s*מדי|יותר\s*מדי|לא\s*הספקתי/i;
const TOO_BIG_EN = /too\s+(?:big|large|long|heavy|much)|overwhelming|didn'?t\s+have\s+time|not\s+enough\s+time/i;
const TASK_CONTEXT = /משימ|צעד|task|step|עבוד|work/i;

function detectsTasksTooBig(...texts: Array<string | null | undefined>): boolean {
  const combined = texts.filter(Boolean).join(' ').trim();
  if (!combined) return false;

  const hasSizeSignal = TOO_BIG_HE.test(combined) || TOO_BIG_EN.test(combined);
  const hasTimeSignal =
    /אין\s*זמן|לא\s*היה\s*זמן|זמן|time/i.test(combined) &&
    (/ארוך|long|הספק|finish|complete/i.test(combined) || TASK_CONTEXT.test(combined));

  return hasSizeSignal || (hasTimeSignal && TASK_CONTEXT.test(combined));
}

function deriveEnergyForecast(
  dayMood?: number | null,
  emotionalDump?: string | null
): EveningEnergyForecast | null {
  if (dayMood != null && dayMood >= 1 && dayMood <= 5) {
    if (dayMood <= 2) return 'low';
    if (dayMood === 3) return 'medium';
    return 'high';
  }

  const words = emotionalDump?.trim().split(/\s+/).filter(Boolean).length ?? 0;
  if (words >= 45) return 'low';
  return null;
}

function deriveTomorrowConstraint(
  input: {
    blockers: string;
    tomorrowsWin: string;
    locale: AppLocale;
    tasksTooBig: boolean;
  }
): string | null {
  const parts: string[] = [];

  if (input.tasksTooBig) {
    parts.push(
      input.locale === 'he'
        ? 'אתמול המשימות היו גדולות מדי — מחר רק צעדים קטנים (עד 10 דקות).'
        : 'Yesterday\'s tasks were too big — tomorrow only small steps (max 10 minutes).'
    );
  }

  const blockers = input.blockers.trim();
  if (blockers) parts.push(blockers.slice(0, 240));

  const win = input.tomorrowsWin.trim();
  if (win) parts.push(win.slice(0, 240));

  return parts.length > 0 ? parts.join(' ') : null;
}

export function buildEveningBriefingFields(input: {
  locale: AppLocale;
  successFactors: string;
  blockers: string;
  biggestWin: string;
  emotionalDump: string;
  tomorrowsWin: string;
  dayMood?: number | null;
}): EveningBriefingFields {
  const what_worked = input.successFactors.trim() || input.biggestWin.trim() || null;
  const what_failed = input.blockers.trim() || null;
  const tasks_too_big = detectsTasksTooBig(
    input.blockers,
    input.emotionalDump,
    input.successFactors
  );
  const energy_forecast = deriveEnergyForecast(input.dayMood, input.emotionalDump);

  return {
    tomorrow_constraint: deriveTomorrowConstraint({
      blockers: input.blockers,
      tomorrowsWin: input.tomorrowsWin,
      locale: input.locale,
      tasksTooBig: tasks_too_big,
    }),
    what_worked,
    what_failed,
    energy_forecast,
    tasks_too_big,
  };
}

export function briefingFieldsFromSession(
  session: EveningResetSession
): EveningBriefingFields {
  if (
    session.tomorrow_constraint != null ||
    session.what_worked != null ||
    session.what_failed != null ||
    session.energy_forecast != null ||
    session.tasks_too_big != null
  ) {
    return {
      tomorrow_constraint: session.tomorrow_constraint ?? null,
      what_worked: session.what_worked ?? null,
      what_failed: session.what_failed ?? null,
      energy_forecast: session.energy_forecast ?? null,
      tasks_too_big: session.tasks_too_big ?? false,
    };
  }

  const locale = (session.language === 'en' ? 'en' : 'he') as AppLocale;
  return buildEveningBriefingFields({
    locale,
    successFactors: session.successFactors,
    blockers: session.blockers,
    biggestWin: session.biggestWin,
    emotionalDump: session.emotionalDump,
    tomorrowsWin: session.tomorrowsWin,
    dayMood: session.dayMood,
  });
}
