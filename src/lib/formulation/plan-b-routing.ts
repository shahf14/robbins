import type {AppLocale} from '@/i18n/config';
import {buildFormulationInsights} from '@/lib/formulation/formulation-insights';
import {
  detectCentralBlocker,
  type MindsetBlockerKind,
} from '@/lib/formulation/mindset-exercises';
import {
  parseHabitTriggerFromTitle,
} from '@/lib/formulation/habit-trigger-routing';
import {distressWeight} from '@/lib/formulation/passive-ratings';
import {buildDefaultPlanB, type PlanBFields} from '@/lib/life-coach/plan-b';
import type {FormulationSession, StructuredDailyBabyStep} from '@/lib/life-coach/types';

export type PlanBBarrierKind =
  | 'no_time'
  | 'low_energy'
  | 'fear_of_failure'
  | 'self_criticism'
  | 'avoidance'
  | 'worry'
  | 'general';

export type BarrierPlanBStrategy = {
  locale: AppLocale;
  primary_barrier: PlanBBarrierKind;
  secondary_barriers: PlanBBarrierKind[];
  coach_plan_b: string | null;
  anticipated_barrier: string | null;
  fallback_minutes: number;
  fallback_style: string;
  title_pattern: string;
  description_tone: string;
  signals_used: string[];
};

const BARRIER_PRIORITY: PlanBBarrierKind[] = [
  'self_criticism',
  'avoidance',
  'fear_of_failure',
  'low_energy',
  'no_time',
  'worry',
  'general',
];

const STYLE_BY_BARRIER: Record<
  PlanBBarrierKind,
  {he: {style: string; pattern: string; tone: string}; en: {style: string; pattern: string; tone: string}; minutes: number}
> = {
  no_time: {
    minutes: 2,
    he: {
      style: 'גרסת 2 דקות בלבד — רק ההתחלה',
      pattern: '2 דק׳: [פעולה]',
      tone: 'קצר וברור — מספיק 2 דקות, בלי להשלים את הגרסה המלאה.',
    },
    en: {
      style: '2-minute version only — just the start',
      pattern: '2 min: [action]',
      tone: 'Short and clear — 2 minutes is enough, no need to finish the full version.',
    },
  },
  low_energy: {
    minutes: 3,
    he: {
      style: 'גרסה פסיבית/קלה — בלי דרישה להשלים',
      pattern: 'גרסה קלה: [פעולה]',
      tone: 'פעולה שאפשר לעשות בישיבה/במינימום מאמץ — לא חייבים לסיים.',
    },
    en: {
      style: 'Passive/light version — no need to complete',
      pattern: 'Light version: [action]',
      tone: 'Can be done seated or with minimal effort — finishing is optional.',
    },
  },
  fear_of_failure: {
    minutes: 2,
    he: {
      style: 'רק להתחיל, לא לסיים',
      pattern: 'רק להתחיל: [פעולה]',
      tone: 'לא צריך לסיים — רק לפתוח/להתחיל ולעצור מותר.',
    },
    en: {
      style: 'Just start, do not finish',
      pattern: 'Just start: [action]',
      tone: "You don't need to finish — opening or starting is enough.",
    },
  },
  self_criticism: {
    minutes: 2,
    he: {
      style: 'ניסוח רך — בלי אשמה',
      pattern: '2 דק׳ בעדינות: [פעולה]',
      tone: 'בלי אשמה — כל התחלה קטנה נספרת, גם אם לא מושלמת.',
    },
    en: {
      style: 'Soft wording — no guilt',
      pattern: '2 min, gently: [action]',
      tone: 'No guilt — any small start counts, even if imperfect.',
    },
  },
  avoidance: {
    minutes: 2,
    he: {
      style: '2 דקות — רק התחלה',
      pattern: '2 דק׳ — רק התחלה: [פעולה]',
      tone: 'רק לפתוח/להתחיל — לא חייבים להמשיך אחרי 2 דקות.',
    },
    en: {
      style: '2 minutes — start only',
      pattern: '2 min — start only: [action]',
      tone: 'Just open or begin — you can stop after 2 minutes.',
    },
  },
  worry: {
    minutes: 2,
    he: {
      style: 'צעד קטן אחד — בלי לפתור הכל',
      pattern: 'צעד קטן: [פעולה]',
      tone: 'חתיכה אחת קטנה — לא צריך לסגור את כל הדאגה היום.',
    },
    en: {
      style: 'One small piece — not solving everything',
      pattern: 'Small step: [action]',
      tone: 'One tiny piece — you do not need to resolve all the worry today.',
    },
  },
  general: {
    minutes: 2,
    he: {
      style: 'Plan B — רק הצעד הראשון',
      pattern: '2 דק׳: [פעולה]',
      tone: 'גרסת Plan B — רק הצעד הראשון, בלי שלמות.',
    },
    en: {
      style: 'Plan B — just the first move',
      pattern: '2 min: [action]',
      tone: 'Plan B — just the first move, not perfection.',
    },
  },
};

function ratingDistress(session: FormulationSession, key: string): number {
  const rating = session.passive_ratings.find((r) => r.key === key);
  return rating ? distressWeight(rating.key, rating.score) : 0;
}

function mapMindsetToPlanB(blocker: MindsetBlockerKind): PlanBBarrierKind {
  if (blocker === 'guilt') return 'self_criticism';
  if (blocker === 'low_control') return 'worry';
  return blocker;
}

function rankBarriers(scores: Map<PlanBBarrierKind, number>): PlanBBarrierKind[] {
  return [...scores.entries()]
    .filter(([, weight]) => weight > 0)
    .sort((a, b) => {
      if (b[1] !== a[1]) return b[1] - a[1];
      return BARRIER_PRIORITY.indexOf(a[0]) - BARRIER_PRIORITY.indexOf(b[0]);
    })
    .map(([kind]) => kind);
}

function detectPlanBBarrier(
  session: FormulationSession,
  locale: AppLocale
): BarrierPlanBStrategy {
  const insights = buildFormulationInsights(session, locale);
  const scores = new Map<PlanBBarrierKind, number>();
  const signals: string[] = [];

  const add = (barrier: PlanBBarrierKind, weight: number, signal: string) => {
    if (weight <= 0) return;
    scores.set(barrier, (scores.get(barrier) ?? 0) + weight);
    signals.push(signal);
  };

  const handoff = session.coach_handoff;
  const maintaining = session.formulation_approved?.maintaining_factors ?? [];
  const blob = [
    handoff?.anticipated_barrier,
    handoff?.plan_b,
    ...maintaining,
    session.formulation_approved?.presenting_concern_user_words,
  ]
    .filter(Boolean)
    .join(' ');

  if (/time|busy|עמוס|no time|לוח|schedule|זמן/i.test(blob)) {
    add('no_time', 4, 'anticipated_barrier.time');
  }
  if (ratingDistress(session, 'work_pressure') >= 4) {
    add('no_time', 2, 'passive_ratings.work_pressure');
  }

  if (session.dimensions?.mind_body?.energy_changed) {
    add('low_energy', 5, 'dimensions.mind_body.energy_changed');
  }
  if (ratingDistress(session, 'motivation') >= 4) {
    add('low_energy', 4, 'passive_ratings.motivation');
  }
  if (ratingDistress(session, 'day_energy') >= 4) {
    add('low_energy', 3, 'passive_ratings.day_energy');
  }
  if (/fatigue|tired|עייפ|exhaust|אנרג|sleep|שינה/i.test(blob)) {
    add('low_energy', 2, 'maintaining_or_barrier.fatigue');
  }

  if (/fail|כישלון|mistake|טעות|not good enough|לא מספיק|perfect|מושל/i.test(blob)) {
    add('fear_of_failure', 4, 'maintaining_factors.fear_of_failure');
  }

  if (ratingDistress(session, 'worry_load') >= 4) {
    add('worry', 5, 'passive_ratings.worry_load');
  }
  if (ratingDistress(session, 'student_exam_anxiety') >= 4) {
    add('worry', 3, 'passive_ratings.student_exam_anxiety');
  }

  const central = detectCentralBlocker(session, locale);
  if (central.dominant_blocker) {
    add(mapMindsetToPlanB(central.dominant_blocker), 5, `central_blocker.${central.dominant_blocker}`);
  }
  for (const entry of central.scores.slice(1, 3)) {
    add(mapMindsetToPlanB(entry.blocker), 2, `central_blocker.${entry.blocker}`);
  }

  for (const theme of insights.burning_now_themes) {
    if (theme.id === 'avoidance') add('avoidance', 2, 'burning_now.avoidance');
    if (theme.id === 'self_criticism') add('self_criticism', 2, 'burning_now.self_criticism');
    if (theme.id === 'worry_load' || theme.id === 'student_exam_anxiety') {
      add('worry', 2, `burning_now.${theme.id}`);
    }
    if (theme.id === 'day_energy' || theme.id === 'motivation') {
      add('low_energy', 2, `burning_now.${theme.id}`);
    }
    if (theme.id === 'work_pressure') add('no_time', 2, 'burning_now.work_pressure');
  }

  const ranked = rankBarriers(scores);
  const primary = ranked[0] ?? 'general';
  const copy = STYLE_BY_BARRIER[primary][locale === 'he' ? 'he' : 'en'];

  return {
    locale,
    primary_barrier: primary,
    secondary_barriers: ranked.slice(1, 3),
    coach_plan_b: handoff?.plan_b?.trim() || null,
    anticipated_barrier: handoff?.anticipated_barrier?.trim() || null,
    fallback_minutes: STYLE_BY_BARRIER[primary].minutes,
    fallback_style: copy.style,
    title_pattern: copy.pattern,
    description_tone: copy.tone,
    signals_used: signals,
  };
}

export function buildBarrierPlanBStrategy(
  session: FormulationSession,
  locale: AppLocale
): BarrierPlanBStrategy {
  return detectPlanBBarrier(session, locale);
}

export function barrierPlanBForPrompt(
  strategy: BarrierPlanBStrategy | null
): Record<string, unknown> | null {
  if (!strategy) return null;
  return {
    primary_barrier: strategy.primary_barrier,
    secondary_barriers: strategy.secondary_barriers,
    coach_plan_b: strategy.coach_plan_b,
    anticipated_barrier: strategy.anticipated_barrier,
    fallback_minutes: strategy.fallback_minutes,
    fallback_style: strategy.fallback_style,
    title_pattern: strategy.title_pattern,
    description_tone: strategy.description_tone,
  };
}

export function barrierPlanBPromptBlock(locale: AppLocale): string {
  return locale === 'he'
    ? [
        '## Plan B מראש (plan_b_strategy + fallback_step):',
        'כל צעד חייב fallback_step מוכן מראש — לא רק אחרי כישלון.',
        'קרא plan_b_strategy.primary_barrier וייצר fallback_step שמתאים:',
        '- no_time → 2 דקות, title "2 דק׳: …"',
        '- low_energy → גרסה קלה/פסיבית, 2–3 דקות',
        '- fear_of_failure → "רק להתחיל: …" — בלי דרישת סיום',
        '- self_criticism → ניסוח רך, בלי אשמה',
        '- avoidance → 2 דקות התחלה בלבד',
        '- worry → צעד קטן אחד',
        'אם coach_plan_b קיים — השתמש בו כהשראה ל-fallback_step.description.',
        'fallback_step.estimated_minutes: 1–5 (לפי plan_b_strategy.fallback_minutes).',
        'fallback_step.title חייב להיות בר-התחלה תוך 30 שניות.',
      ].join('\n')
    : [
        '## Upfront Plan B (plan_b_strategy + fallback_step):',
        'Every step MUST include a ready fallback_step — not only after failure.',
        'Read plan_b_strategy.primary_barrier and shape fallback_step accordingly:',
        '- no_time → 2 minutes, title "2 min: …"',
        '- low_energy → light/passive version, 2–3 minutes',
        '- fear_of_failure → "Just start: …" — no finish requirement',
        '- self_criticism → soft wording, no guilt',
        '- avoidance → 2-minute start only',
        '- worry → one small piece',
        'If coach_plan_b exists — use it as inspiration for fallback_step.description.',
        'fallback_step.estimated_minutes: 1–5 (per plan_b_strategy.fallback_minutes).',
        'fallback_step.title must be startable in under 30 seconds.',
      ].join('\n');
}

function lowerFirstChar(text: string): string {
  if (!text) return text;
  return text.charAt(0).toLowerCase() + text.slice(1);
}

function clipText(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function splitTitleForPlanB(
  title: string,
  locale: AppLocale
): {trigger: string | null; action: string} {
  const parsed = parseHabitTriggerFromTitle(title, locale);
  if (parsed) return {trigger: parsed.trigger, action: parsed.action};
  return {trigger: null, action: title.trim()};
}

function buildBarrierFallbackTitle(
  action: string,
  strategy: BarrierPlanBStrategy
): string {
  const he = strategy.locale === 'he';
  const core = action.length > 56 ? `${action.slice(0, 53).trim()}…` : action;

  switch (strategy.primary_barrier) {
    case 'no_time':
      return he ? `2 דק׳: ${core}` : `2 min: ${core}`;
    case 'low_energy':
      return he ? `גרסה קלה: ${core}` : `Light version: ${core}`;
    case 'fear_of_failure':
      return he ? `רק להתחיל: ${core}` : `Just start: ${core}`;
    case 'self_criticism':
      return he ? `2 דק׳ בעדינות: ${core}` : `2 min, gently: ${core}`;
    case 'avoidance':
      return he ? `2 דק׳ — רק התחלה: ${core}` : `2 min — start only: ${core}`;
    case 'worry':
      return he ? `צעד קטן: ${core}` : `Small step: ${core}`;
    default:
      return he ? `2 דק׳: ${core}` : `2 min: ${core}`;
  }
}

function composeFallbackTitle(
  stepTitle: string,
  fallbackCore: string,
  locale: AppLocale
): string {
  const {trigger} = splitTitleForPlanB(stepTitle, locale);
  if (!trigger) return clipText(fallbackCore, 180);
  const sep = locale === 'he' ? ', ' : ', ';
  return clipText(`${trigger}${sep}${lowerFirstChar(fallbackCore)}`, 180);
}

function buildBarrierFallbackFields(
  step: StructuredDailyBabyStep,
  strategy: BarrierPlanBStrategy
): PlanBFields {
  const {action} = splitTitleForPlanB(step.title, strategy.locale);
  const coreTitle = buildBarrierFallbackTitle(action, strategy);
  const description =
    strategy.coach_plan_b?.trim() ||
    step.fallback_description?.trim() ||
    strategy.description_tone;

  return {
    fallback_title: composeFallbackTitle(step.title, coreTitle, strategy.locale),
    fallback_description: clipText(description, 500),
    fallback_estimated_minutes: strategy.fallback_minutes,
  };
}

function isGenericFallback(step: StructuredDailyBabyStep, locale: AppLocale): boolean {
  if (!step.fallback_title?.trim()) return true;
  const defaultB = buildDefaultPlanB(step, locale);
  if (step.fallback_title.trim() === defaultB.fallback_title.trim()) return true;

  const desc = step.fallback_description?.trim() ?? '';
  if (
    desc === defaultB.fallback_description.trim() ||
    /Plan B — just the first move|גרסת Plan B — רק הצעד הראשון/.test(desc)
  ) {
    return true;
  }

  return false;
}

function fallbackMatchesBarrier(
  step: StructuredDailyBabyStep,
  strategy: BarrierPlanBStrategy
): boolean {
  const title = step.fallback_title?.trim() ?? '';
  if (!title) return false;

  const patterns: Record<PlanBBarrierKind, RegExp> = {
    no_time: /^(2 דק|2 min)/i,
    low_energy: /(גרסה קלה|Light version)/i,
    fear_of_failure: /(רק להתחיל|Just start)/i,
    self_criticism: /(בעדינות|gently)/i,
    avoidance: /(רק התחלה|start only)/i,
    worry: /(צעד קטן|Small step)/i,
    general: /^(2 דק|2 min)/i,
  };

  return patterns[strategy.primary_barrier].test(title);
}

/** Ensure every step has a barrier-specific Plan B stored upfront. */
function applyBarrierPlanBToStep(
  step: StructuredDailyBabyStep,
  strategy: BarrierPlanBStrategy | null
): StructuredDailyBabyStep {
  if (!strategy) return step;

  if (!isGenericFallback(step, strategy.locale) && fallbackMatchesBarrier(step, strategy)) {
    return {
      ...step,
      fallback_estimated_minutes:
        step.fallback_estimated_minutes ?? strategy.fallback_minutes,
    };
  }

  const planB = buildBarrierFallbackFields(step, strategy);
  return {...step, ...planB};
}

export function applyBarrierPlanBToSteps(
  steps: StructuredDailyBabyStep[],
  strategy: BarrierPlanBStrategy | null
): StructuredDailyBabyStep[] {
  if (!strategy) return steps;
  return steps.map((step) => applyBarrierPlanBToStep(step, strategy));
}
