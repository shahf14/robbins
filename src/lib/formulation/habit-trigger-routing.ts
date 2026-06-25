import type {AppLocale} from '@/i18n/config';
import {resolveGenderedDeep, resolveGenderedHebrewText, resolveParticipantGender} from '@/lib/gendered-copy';
import {activeLifeContexts} from '@/lib/life-context-content';
import type {
  FormulationSession,
  LifeContextStatus,
  StructuredDailyBabyStep,
} from '@/lib/life-coach/types';
import type {PreferredActionWindow} from '@/lib/user-preferences';

export type HabitTriggerContext = {
  locale: AppLocale;
  primary_trigger: string;
  secondary_triggers: string[];
  life_context_statuses: LifeContextStatus[];
  difficulty_contexts: string[];
  micro_goal_week: string | null;
  anticipated_barrier: string | null;
  preferred_action_window: PreferredActionWindow | null;
  wake_time: string | null;
  /** Where the trigger came from — for prompt transparency */
  trigger_source: 'life_context' | 'difficulty_context' | 'action_window' | 'default';
};

type TriggerCopy = {he: string; en: string};

const LIFE_CONTEXT_TRIGGERS: Partial<Record<LifeContextStatus, TriggerCopy>> = {
  new_parent: {
    he: 'אחרי שהילד/ה נרדם/ה',
    en: 'After your child falls asleep',
  },
  student: {
    he: 'לפני שפותח/ת את הלפטופ ללימודים',
    en: 'Before opening your laptop for studies',
  },
  manager: {
    he: 'אחרי הפגישה הראשונה של היום',
    en: 'After your first meeting of the day',
  },
  between_jobs: {
    he: 'אחרי הקפה של הבוקר',
    en: 'After your morning coffee',
  },
  caregiver: {
    he: 'אחרי שסיימת/ה את משימת הטיפול הראשונה של היום',
    en: 'After finishing your first caregiving task of the day',
  },
  other: {
    he: 'אחרי הקפה של הבוקר',
    en: 'After your morning coffee',
  },
};

const CONTEXT_KEY_TRIGGERS: Record<string, TriggerCopy> = {
  morning: {
    he: 'אחרי שקמת/ה ושתית/ה את המשקה הראשון של הבוקר',
    en: 'After you wake up and have your first morning drink',
  },
  after_work: {
    he: 'אחרי שסגרת/ה את יום העבודה',
    en: 'After you close out your workday',
  },
  evening: {
    he: 'כשהערב מתחיל ויש רגע שקט',
    en: 'When the evening starts and you have a quiet moment',
  },
  alone: {
    he: 'ברגע שיש לך דקה לבד',
    en: 'When you have a minute alone',
  },
  with_people: {
    he: 'אחרי אינטראקציה משמעותית עם אנשים',
    en: 'After a meaningful interaction with people',
  },
  weekend: {
    he: 'אחרי הקפה/ארוחת הבוקר בסוף השבוע',
    en: 'After your weekend morning coffee or breakfast',
  },
};

const WINDOW_TRIGGERS: Record<PreferredActionWindow, TriggerCopy> = {
  morning: {
    he: 'אחרי שגרת הבוקר הראשונה',
    en: 'After your first morning routine',
  },
  midday: {
    he: 'אחרי הפסקת הצהריים',
    en: 'After your lunch break',
  },
  evening: {
    he: 'כשמתחיל הערב',
    en: 'When your evening begins',
  },
  flexible: {
    he: 'אחרי הרגע הראשון הפנוי ביום',
    en: 'After the first free moment in your day',
  },
};

const LIFE_CONTEXT_PRIORITY: LifeContextStatus[] = [
  'new_parent',
  'caregiver',
  'student',
  'manager',
  'between_jobs',
  'other',
];

const CONTEXT_KEY_PRIORITY = [
  'after_work',
  'evening',
  'morning',
  'weekend',
  'alone',
  'with_people',
] as const;

function pickCopy(copy: TriggerCopy, locale: AppLocale, gender?: string | null): string {
  const text = locale === 'he' ? copy.he : copy.en;
  return locale === 'he' ? resolveGenderedHebrewText(text, gender) : text;
}

function resolveDifficultyContexts(session: FormulationSession): string[] {
  const fromDimensions = session.dimensions?.contexts ?? [];
  const fromApproved = session.formulation_approved?.contexts ?? [];
  return [...new Set([...fromDimensions, ...fromApproved].filter(Boolean))];
}

function selectLifeContextTrigger(
  statuses: LifeContextStatus[],
  locale: AppLocale,
  gender?: string | null
): {phrase: string; status: LifeContextStatus} | null {
  const active = activeLifeContexts(statuses);
  if (active.length === 0) return null;

  for (const status of LIFE_CONTEXT_PRIORITY) {
    if (!active.includes(status)) continue;
    const copy = LIFE_CONTEXT_TRIGGERS[status];
    if (!copy) continue;
    return {phrase: pickCopy(copy, locale, gender), status};
  }
  return null;
}

function selectContextKeyTrigger(
  contextKeys: string[],
  locale: AppLocale,
  gender?: string | null
): {phrase: string; key: string} | null {
  for (const key of CONTEXT_KEY_PRIORITY) {
    if (!contextKeys.includes(key)) continue;
    const copy = CONTEXT_KEY_TRIGGERS[key];
    if (!copy) continue;
    return {phrase: pickCopy(copy, locale, gender), key};
  }
  return null;
}

function barrierPrefersEvening(anticipated: string | null | undefined): boolean {
  if (!anticipated?.trim()) return false;
  return /עייפ|fatigue|tired|exhaust|sleep|שינה|late|מאוחר|evening|ערב/i.test(anticipated);
}

function buildSecondaryTriggers(
  statuses: LifeContextStatus[],
  contextKeys: string[],
  locale: AppLocale,
  exclude: string,
  gender?: string | null
): string[] {
  const out: string[] = [];
  for (const status of activeLifeContexts(statuses)) {
    const copy = LIFE_CONTEXT_TRIGGERS[status];
    if (!copy) continue;
    const phrase = pickCopy(copy, locale, gender);
    if (phrase !== exclude) out.push(phrase);
  }
  for (const key of CONTEXT_KEY_PRIORITY) {
    if (!contextKeys.includes(key)) continue;
    const phrase = pickCopy(CONTEXT_KEY_TRIGGERS[key], locale, gender);
    if (phrase !== exclude && !out.includes(phrase)) out.push(phrase);
  }
  return out.slice(0, 3);
}

export function buildHabitTriggerContext(
  session: FormulationSession,
  locale: AppLocale,
  prefs?: {
    wake_time?: string;
    sleep_time?: string;
    preferred_action_window?: PreferredActionWindow;
  }
): HabitTriggerContext | null {
  const difficultyContexts = resolveDifficultyContexts(session);
  const handoff = session.coach_handoff;
  const statuses = session.life_context_statuses;
  const active = activeLifeContexts(statuses);

  if (
    active.length === 0 &&
    difficultyContexts.length === 0 &&
    !handoff?.micro_goal_week?.trim()
  ) {
    return null;
  }

  const gender = resolveParticipantGender(session.participant_gender);
  const lifeTrigger = selectLifeContextTrigger(statuses, locale, gender);
  const contextTrigger = selectContextKeyTrigger(difficultyContexts, locale, gender);
  const window = prefs?.preferred_action_window ?? null;

  let primary_trigger: string;
  let trigger_source: HabitTriggerContext['trigger_source'];

  if (lifeTrigger) {
    primary_trigger = lifeTrigger.phrase;
    trigger_source = 'life_context';
    if (
      contextTrigger &&
      (contextTrigger.key === 'after_work' || contextTrigger.key === 'evening') &&
      barrierPrefersEvening(handoff?.anticipated_barrier)
    ) {
      primary_trigger = contextTrigger.phrase;
      trigger_source = 'difficulty_context';
    } else if (
      contextTrigger &&
      contextTrigger.key === 'after_work' &&
      lifeTrigger.status === 'manager'
    ) {
      primary_trigger = contextTrigger.phrase;
      trigger_source = 'difficulty_context';
    }
  } else if (contextTrigger) {
    primary_trigger = contextTrigger.phrase;
    trigger_source = 'difficulty_context';
  } else if (window && window !== 'flexible') {
    primary_trigger = pickCopy(WINDOW_TRIGGERS[window], locale, gender);
    trigger_source = 'action_window';
  } else {
    primary_trigger = pickCopy(WINDOW_TRIGGERS.flexible, locale, gender);
    trigger_source = 'default';
  }

  return {
    locale,
    primary_trigger,
    secondary_triggers: buildSecondaryTriggers(
      statuses,
      difficultyContexts,
      locale,
      primary_trigger,
      gender
    ),
    life_context_statuses: active,
    difficulty_contexts: difficultyContexts,
    micro_goal_week: handoff?.micro_goal_week?.trim() || null,
    anticipated_barrier: handoff?.anticipated_barrier?.trim() || null,
    preferred_action_window: window,
    wake_time: prefs?.wake_time ?? null,
    trigger_source,
  };
}

export function habitTriggerForPrompt(
  ctx: HabitTriggerContext | null
): Record<string, unknown> | null {
  if (!ctx) return null;
  return {
    primary_trigger: ctx.primary_trigger,
    secondary_triggers: ctx.secondary_triggers,
    life_context_statuses: ctx.life_context_statuses,
    difficulty_contexts: ctx.difficulty_contexts,
    micro_goal_week: ctx.micro_goal_week,
    anticipated_barrier: ctx.anticipated_barrier,
    preferred_action_window: ctx.preferred_action_window,
    trigger_source: ctx.trigger_source,
  };
}

export function habitTriggerPromptBlock(locale: AppLocale): string {
  return locale === 'he'
    ? [
        '## עיגון הרגל (habit_trigger):',
        'אל תציע רק "עשה X" — עגן כל צעד בטריגר קיים מהחיים.',
        'התחל title בטריגר + פעולה: "אחרי שהילד נרדם, כתוב משפט אחד…", "לפני פתיחת הלפטופ ללימודים…".',
        'אם קיים habit_trigger.primary_trigger — השתמש בו או ב-secondary_triggers; אל תמציא טריגר שלא מתאים למצב.',
        'הצעד חייב לקדם micro_goal_week כשקיים; כבד anticipated_barrier (עייפות → טריגר שקט/ערב).',
        'fallback_step.title גם מעוגן באותו טריגר, בגרסה של 1–2 דקות.',
      ].join('\n')
    : [
        '## Habit trigger anchoring (habit_trigger):',
        'Do not suggest bare "do X" — anchor each step to an existing life trigger.',
        'Start title with trigger + action: "After your child falls asleep, write one sentence…", "Before opening your laptop for studies…".',
        'When habit_trigger.primary_trigger exists — use it or secondary_triggers; do not invent mismatched triggers.',
        'Steps should advance micro_goal_week when present; respect anticipated_barrier (fatigue → quiet/evening trigger).',
        'fallback_step.title uses the same trigger in a 1–2 minute version.',
      ].join('\n');
}

const ANCHOR_PREFIX_HE = /^(אחרי|לפני|כש|ברגע)\s/i;
const ANCHOR_PREFIX_EN = /^(after|before|when)\s/i;

function stepAlreadyAnchored(title: string, locale: AppLocale): boolean {
  const trimmed = title.trim();
  if (!trimmed) return false;
  return locale === 'he'
    ? ANCHOR_PREFIX_HE.test(trimmed)
    : ANCHOR_PREFIX_EN.test(trimmed);
}

function lowerFirstChar(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function clipTitle(text: string, max = 180): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function anchorStepToTrigger(
  step: StructuredDailyBabyStep,
  ctx: HabitTriggerContext | null
): StructuredDailyBabyStep {
  if (!ctx?.primary_trigger) return step;

  const sep = ctx.locale === 'he' ? ', ' : ', ';
  const next: StructuredDailyBabyStep = {...step};

  if (!stepAlreadyAnchored(step.title, ctx.locale)) {
    next.title = clipTitle(`${ctx.primary_trigger}${sep}${lowerFirstChar(step.title)}`);
  }

  if (
    step.fallback_title &&
    !stepAlreadyAnchored(step.fallback_title, ctx.locale)
  ) {
    next.fallback_title = clipTitle(
      `${ctx.primary_trigger}${sep}${lowerFirstChar(step.fallback_title)}`
    );
  }

  return next;
}

export function anchorStepsToTriggers(
  steps: StructuredDailyBabyStep[],
  ctx: HabitTriggerContext | null
): StructuredDailyBabyStep[] {
  if (!ctx) return steps;
  return steps.map((step) => anchorStepToTrigger(step, ctx));
}

export function parseHabitTriggerFromTitle(
  title: string,
  locale: AppLocale
): {trigger: string; action: string} | null {
  const trimmed = title.trim();
  if (!stepAlreadyAnchored(trimmed, locale)) return null;

  const split = trimmed.match(/^(.+?)(?:,\s*| — | - )(.+)$/);
  if (!split) return null;

  const trigger = split[1]?.trim();
  const action = split[2]?.trim();
  if (!trigger || !action || action.length < 3) return null;

  return {trigger, action};
}
