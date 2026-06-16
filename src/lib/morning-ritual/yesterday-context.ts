import {dateToYMD} from '@/lib/date-utils';
import {
  defaultBreathingType,
  defaultMorningRitualMode,
  morningMissionPlaceholderKey,
} from '@/lib/life-context-content';
import type {LifeContextStatus, LifeDomain} from '@/lib/life-coach/types';
import type {BreathingType, RitualMode} from '@/lib/morning-ritual-types';

export type MorningRitualTone = 'restart_gently' | 'steady' | 'high_performance';

export type MorningRitualYesterdayContext = {
  yesterday_date: string;
  yesterday_completed_count: number;
  yesterday_skip_count: number;
  yesterday_total_steps: number;
  evening_mood: number | null;
  main_blocker: string | null;
  tone: MorningRitualTone;
  active_goal_domain: LifeDomain | null;
  today_energy: number | null;
  today_mood_tag: string | null;
  /** What the user explicitly committed to do today (from last night's evening reset). */
  tomorrows_win: string | null;
  /** Concrete one-action takeaway from last night's evening reset. */
  tomorrow_takeaway: string | null;
};

export function localDateStr(d: Date): string {
  return dateToYMD(d);
}

export function yesterdayIsoDate(from = new Date()): string {
  const d = new Date(from);
  d.setDate(d.getDate() - 1);
  return localDateStr(d);
}

export function dateFromIso(iso: string): string {
  return localDateStr(new Date(iso));
}

export function buildMorningRitualYesterdayContext(input: {
  yesterdayDate: string;
  steps: Array<{status: string}>;
  reflection: {mood_score?: number | null; blocker_reason?: string | null} | null;
  eveningSession: {
    dayMood?: number;
    blockerMentioned?: boolean;
    blockers?: string;
    tomorrowsWin?: string | null;
    tomorrow_takeaway?: string | null;
  } | null;
}): MorningRitualYesterdayContext {
  const completed = input.steps.filter((step) => step.status === 'completed').length;
  const skips = input.steps.filter(
    (step) => step.status === 'skipped' || step.status === 'partial'
  ).length;
  const total = input.steps.length;

  const evening_mood =
    input.eveningSession?.dayMood ?? input.reflection?.mood_score ?? null;
  const main_blocker =
    input.reflection?.blocker_reason ??
    (input.eveningSession?.blockerMentioned ? 'other' : null);

  const weakDay =
    skips >= 1 ||
    (total > 0 && completed === 0) ||
    (evening_mood != null && evening_mood <= 2) ||
    (input.reflection?.mood_score != null &&
      input.reflection.mood_score <= 4 &&
      (skips >= 1 || total === 0));

  const strongDay =
    total > 0 &&
    completed === total &&
    skips === 0 &&
    (evening_mood == null || evening_mood >= 4);

  let tone: MorningRitualTone = 'steady';
  if (weakDay) tone = 'restart_gently';
  else if (strongDay) tone = 'high_performance';

  return {
    yesterday_date: input.yesterdayDate,
    yesterday_completed_count: completed,
    yesterday_skip_count: skips,
    yesterday_total_steps: total,
    evening_mood,
    main_blocker,
    tone,
    active_goal_domain: null,
    today_energy: null,
    today_mood_tag: null,
    tomorrows_win: input.eveningSession?.tomorrowsWin?.trim() || null,
    tomorrow_takeaway: input.eveningSession?.tomorrow_takeaway?.trim() || null,
  };
}

export function suggestedMorningModeForContext(
  lifeContexts: LifeContextStatus[] | null | undefined,
  tone: MorningRitualTone
): RitualMode {
  if (tone === 'restart_gently') return 'quick';
  const base = defaultMorningRitualMode(lifeContexts);
  if (tone === 'high_performance' && base === 'quick') return 'standard';
  return base;
}

