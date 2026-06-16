import type {AppLocale} from '@/i18n/config';
import {stepActionWindow} from '@/lib/behavior-profile/skip-windows';
import {filterStepsInPeriod} from '@/lib/life-coach/weekly-review-emotional';
import {
  buildBarrierPlanBStrategy,
  type PlanBBarrierKind,
} from '@/lib/formulation/plan-b-routing';
import type {
  DailyBabyStep,
  DailyReflection,
  FormulationSession,
  LifeContextStatus,
  ReflectionBlockerReason,
  RiskLevel,
  StructuredDailyBabyStep,
} from '@/lib/life-coach/types';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import type {SkipCoachAction, SkipCoachAdjustmentPayload} from '@/lib/skip-coach-loop/types';

const STOP_WORDS =
  /^(של|עם|את|על|זה|מה|איך|לא|גם|כי|the|and|for|with|that|this|from|your|you|are|was|were|have|has)$/i;

const BLOCKER_TO_PLAN_B: Record<ReflectionBlockerReason, PlanBBarrierKind> = {
  low_energy: 'low_energy',
  no_time: 'no_time',
  family_chaos: 'general',
  unclear_task: 'general',
  forgot: 'general',
  emotional_resistance: 'avoidance',
  other: 'general',
};

type SkipClassification = 'known_barrier' | 'new_barrier' | 'none';

export type SkipAdaptationContext = {
  locale: AppLocale;
  anticipated_barrier: string | null;
  plan_b: string | null;
  maintaining_factors: string[];
  risk_level: RiskLevel | null;
  life_context_statuses: LifeContextStatus[];
  primary_barrier: PlanBBarrierKind;
};

export type SkipEventInput = {
  status: 'skipped' | 'partial';
  blocker_reason: ReflectionBlockerReason | null;
  reflection_text?: string | null;
  actual_minutes?: number | null;
  value_feedback?: DailyBabyStep['value_feedback'];
  energy_score?: number | null;
  mood_score?: number | null;
  step_title: string;
  step_estimated_minutes: number;
  scheduled_date: string;
};

export type SkipAdaptationOutcome = {
  classification: SkipClassification;
  matches_anticipated: boolean;
  coach_action: SkipCoachAction;
  adjustment: SkipCoachAdjustmentPayload;
};

export type ReturningBarrierWeek = {
  barrier_label: string;
  skip_count: number;
  matches_formulation: boolean;
  headline: string;
  detail: string;
};

export const SKIP_ADAPTATION_PROMPT_BLOCK = [
  '## Skip adaptation (formulation + execution):',
  'When skip_adaptation is present, adapt tomorrow — do not repeat what failed.',
  '- known_barrier + formulation plan_b → prefer Plan B shape (2–5 min, first move only).',
  '- new_barrier low_energy + evening skip → NO evening steps; cap at 5 minutes; easy only.',
  '- new_barrier no_time → max 1–2 steps, 5 min each.',
  '- Avoid step titles/patterns similar to skip_adaptation.skipped_step_title.',
  '- Tie reasoning to anticipated_barrier or the skip reason — not generic motivation.',
].join('\n');

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function significantTokens(text: string, minLen = 3): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,.;:·\-–—/|()]+/)
        .map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').trim())
        .filter((w) => w.length >= minLen && !STOP_WORDS.test(w))
    ),
  ];
}

function textMatchesAnchor(blob: string, anchor: string | null | undefined): boolean {
  const trimmed = anchor?.trim();
  if (!trimmed) return false;
  const normalizedBlob = normalizeText(blob);
  const normalizedAnchor = normalizeText(trimmed);
  if (normalizedAnchor.length >= 8 && normalizedBlob.includes(normalizedAnchor)) return true;
  const tokens = significantTokens(trimmed, trimmed.length <= 12 ? 2 : 3);
  if (tokens.length === 0) return false;
  const hits = tokens.filter((token) => normalizedBlob.includes(normalizeText(token))).length;
  if (tokens.length <= 2) return hits >= 1;
  return hits >= 2 || hits / tokens.length >= 0.34;
}

function blockerSemanticMatch(
  anticipated: string,
  blocker: ReflectionBlockerReason | null
): boolean {
  if (!blocker) return false;
  const blob = normalizeText(anticipated);

  if (blocker === 'low_energy') {
    return /עייפ|energy|tired|fatigue|אנרג|motivation|מוטיב|exhaust|sleep|שינה|burnout|עומס/i.test(
      blob
    );
  }
  if (blocker === 'no_time') {
    return /זמן|time|busy|עומס|work|לחץ|deadline|meeting|ישיב/i.test(blob);
  }
  if (blocker === 'family_chaos') {
    return /משפח|family|ילד|parent|הורה|בית|chaos|כאוס/i.test(blob);
  }
  if (blocker === 'emotional_resistance') {
    return /avoid|הימנע|procrast|דחי|fear|פחד|resist|התנגד/i.test(blob);
  }
  if (blocker === 'unclear_task') {
    return /לא ברור|unclear|confus|מבולבל|vague/i.test(blob);
  }
  return false;
}

export function buildSkipAdaptationContext(
  session: FormulationSession,
  locale: AppLocale
): SkipAdaptationContext | null {
  const handoff = session.coach_handoff;
  const approved = session.formulation_approved;
  if (!handoff && !approved) return null;

  const strategy = buildBarrierPlanBStrategy(session, locale);

  return {
    locale,
    anticipated_barrier: handoff?.anticipated_barrier?.trim() || strategy.anticipated_barrier,
    plan_b: handoff?.plan_b?.trim() || strategy.coach_plan_b,
    maintaining_factors: (approved?.maintaining_factors ?? []).filter(Boolean).slice(0, 5),
    risk_level: session.risk_level,
    life_context_statuses: session.life_context_statuses,
    primary_barrier: strategy.primary_barrier,
  };
}

function classifySkipAgainstFormulation(
  ctx: SkipAdaptationContext,
  input: SkipEventInput
): SkipClassification {
  const anticipated = ctx.anticipated_barrier?.trim();
  if (!anticipated && !input.blocker_reason) return 'none';

  const reflectionBlob = normalizeText(
    [input.reflection_text ?? '', input.step_title].join(' ')
  );

  if (anticipated) {
    if (textMatchesAnchor(reflectionBlob, anticipated)) return 'known_barrier';
    if (blockerSemanticMatch(anticipated, input.blocker_reason)) return 'known_barrier';
    if (
      input.blocker_reason &&
      BLOCKER_TO_PLAN_B[input.blocker_reason] === ctx.primary_barrier &&
      ctx.primary_barrier !== 'general'
    ) {
      return 'known_barrier';
    }
    for (const factor of ctx.maintaining_factors) {
      if (textMatchesAnchor(reflectionBlob, factor)) return 'known_barrier';
    }
  }

  if (input.blocker_reason) return 'new_barrier';
  return 'none';
}

function resolveAvoidWindow(
  input: SkipEventInput,
  classification: SkipClassification
): PreferredActionWindow | undefined {
  if (classification !== 'new_barrier') return undefined;
  if (input.blocker_reason !== 'low_energy') return undefined;
  const pseudoStep = {
    scheduled_date: input.scheduled_date,
    created_at: `${input.scheduled_date}T12:00:00.000Z`,
    updated_at: `${input.scheduled_date}T12:00:00.000Z`,
  } as DailyBabyStep;
  const window = stepActionWindow(pseudoStep);
  return window === 'evening' ? 'morning' : undefined;
}

export function buildAutoSkipCoachOutcome(
  ctx: SkipAdaptationContext,
  input: SkipEventInput,
  locale: AppLocale,
  currentWindow: PreferredActionWindow = 'flexible'
): SkipAdaptationOutcome {
  const classification = classifySkipAgainstFormulation(ctx, input);
  const he = locale === 'he';
  const avoidWindow = resolveAvoidWindow(input, classification);
  const lowEnergy = input.blocker_reason === 'low_energy' || input.energy_score != null && input.energy_score <= 4;

  if (classification === 'known_barrier') {
    const planBText = ctx.plan_b?.trim();
    return {
      classification,
      matches_anticipated: true,
      coach_action: 'plan_b',
      adjustment: {
        max_tasks: 1,
        max_minutes_per_task: lowEnergy ? 3 : 5,
        easy_only: true,
        prefer_plan_b: true,
        time_window: lowEnergy && avoidWindow ? avoidWindow : undefined,
        skip_classification: 'known_barrier',
        formulation_plan_b: planBText ?? null,
        anticipated_barrier: ctx.anticipated_barrier,
        skipped_step_title: clip(input.step_title, 120),
        summary: he
          ? planBText
            ? `מחר: Plan B מההבהרה — ${clip(planBText, 60)}`
            : 'מחר: Plan B — אותו חסם שחזר, רק הצעד הראשון.'
          : planBText
            ? `Tomorrow: Plan B from clarification — ${clip(planBText, 60)}`
            : 'Tomorrow: Plan B — same barrier returned, first move only.',
      },
    };
  }

  if (classification === 'new_barrier') {
    const nextWindow =
      avoidWindow ??
      (currentWindow === 'evening' && lowEnergy ? 'morning' : undefined);
    return {
      classification,
      matches_anticipated: false,
      coach_action: lowEnergy ? 'shrink_tomorrow' : 'change_time',
      adjustment: {
        max_tasks: lowEnergy ? 1 : 2,
        max_minutes_per_task: lowEnergy ? 3 : 5,
        easy_only: lowEnergy || input.status === 'partial',
        prefer_plan_b: false,
        time_window: nextWindow,
        skip_classification: 'new_barrier',
        formulation_plan_b: null,
        anticipated_barrier: ctx.anticipated_barrier,
        skipped_step_title: clip(input.step_title, 120),
        summary: he
          ? lowEnergy
            ? 'מחר: צעד קצר יותר — חסם חדש (אנרגיה נמוכה).'
            : 'מחר: ננסה חלון/צורה אחרת — חסם חדש.'
          : lowEnergy
            ? 'Tomorrow: shorter step — new barrier (low energy).'
            : 'Tomorrow: different window/shape — new barrier.',
      },
    };
  }

  return {
    classification: 'none',
    matches_anticipated: false,
    coach_action: input.status === 'partial' ? 'shrink_tomorrow' : 'shrink_tomorrow',
    adjustment: {
      max_tasks: 1,
      max_minutes_per_task: 5,
      easy_only: true,
      prefer_plan_b: false,
      skipped_step_title: clip(input.step_title, 120),
      summary: he ? 'מחר: צעד אחד קצר יותר.' : 'Tomorrow: one shorter step.',
    },
  };
}

function blockerLabel(blocker: ReflectionBlockerReason, locale: AppLocale): string {
  const he = locale === 'he';
  const labels: Record<ReflectionBlockerReason, {he: string; en: string}> = {
    low_energy: {he: 'אנרגיה נמוכה', en: 'low energy'},
    no_time: {he: 'חוסר זמן', en: 'no time'},
    family_chaos: {he: 'כאוס בבית', en: 'family chaos'},
    unclear_task: {he: 'משימה לא ברורה', en: 'unclear task'},
    forgot: {he: 'שכחתי', en: 'forgot'},
    emotional_resistance: {he: 'התנגדות רגשית', en: 'emotional resistance'},
    other: {he: 'חסם אחר', en: 'other blocker'},
  };
  return he ? labels[blocker].he : labels[blocker].en;
}

export function analyzeReturningBarrierWeek(input: {
  context: SkipAdaptationContext | null;
  steps: DailyBabyStep[];
  reflections?: DailyReflection[];
  periodStart?: string;
  periodEnd?: string;
  locale: AppLocale;
}): ReturningBarrierWeek | null {
  const ctx = input.context;
  if (!ctx?.anticipated_barrier?.trim()) return null;

  const periodSteps =
    input.periodStart && input.periodEnd
      ? filterStepsInPeriod(input.steps, input.periodStart, input.periodEnd)
      : input.steps;

  const skipped = periodSteps.filter((s) => s.status === 'skipped' || s.status === 'partial');
  if (skipped.length === 0) return null;

  let matchCount = 0;
  let dominantBlocker: ReflectionBlockerReason | null = null;
  const blockerCounts = new Map<ReflectionBlockerReason, number>();

  for (const step of skipped) {
    const event: SkipEventInput = {
      status: step.status === 'partial' ? 'partial' : 'skipped',
      blocker_reason: step.blocker_reason ?? null,
      reflection_text: null,
      step_title: step.title,
      step_estimated_minutes: step.estimated_minutes,
      scheduled_date: step.scheduled_date,
    };
    const classification = classifySkipAgainstFormulation(ctx, event);
    if (classification === 'known_barrier') matchCount += 1;
    if (step.blocker_reason) {
      blockerCounts.set(step.blocker_reason, (blockerCounts.get(step.blocker_reason) ?? 0) + 1);
    }
  }

  if (blockerCounts.size > 0) {
    dominantBlocker = [...blockerCounts.entries()].sort((a, b) => b[1] - a[1])[0]![0];
  }

  if (matchCount === 0 && !dominantBlocker) return null;

  const he = input.locale === 'he';
  const anticipated = clip(ctx.anticipated_barrier, 70);
  const label = dominantBlocker
    ? blockerLabel(dominantBlocker, input.locale)
    : anticipated;

  return {
    barrier_label: label,
    skip_count: Math.max(matchCount, skipped.length),
    matches_formulation: matchCount > 0,
    headline: he
      ? matchCount > 0
        ? `החסם שחזר השבוע: ${anticipated}`
        : `החסם שחזר השבוע: ${label}`
      : matchCount > 0
        ? `The barrier that returned this week: ${anticipated}`
        : `The barrier that returned this week: ${label}`,
    detail: he
      ? matchCount > 0
        ? `${matchCount} דילוגים תואמים למה שציינת בהבהרה — מחר Plan B, לא אותה תבנית.`
        : `${skipped.length} דילוגים עם ${label} — נעדכן את ההתאמה לשבוע הבא.`
      : matchCount > 0
        ? `${matchCount} skips matched your clarification — tomorrow Plan B, not the same pattern.`
        : `${skipped.length} skips with ${label} — we'll adapt next week.`,
  };
}

export function skipAdaptationForPrompt(
  ctx: SkipAdaptationContext | null,
  adjustment: {adjustment: SkipCoachAdjustmentPayload; blocker_reason: ReflectionBlockerReason | null} | null
): Record<string, unknown> | null {
  if (!ctx && !adjustment) return null;
  return {
    anticipated_barrier: ctx?.anticipated_barrier ?? null,
    formulation_plan_b: ctx?.plan_b ?? adjustment?.adjustment.formulation_plan_b ?? null,
    maintaining_factors: ctx?.maintaining_factors ?? [],
    risk_level: ctx?.risk_level ?? null,
    life_context_statuses: ctx?.life_context_statuses ?? [],
    primary_barrier: ctx?.primary_barrier ?? null,
    latest_skip: adjustment
      ? {
          blocker_reason: adjustment.blocker_reason,
          classification: adjustment.adjustment.skip_classification ?? null,
          skipped_step_title: adjustment.adjustment.skipped_step_title ?? null,
          avoid_time_window: adjustment.adjustment.time_window ?? null,
          max_minutes: adjustment.adjustment.max_minutes_per_task,
        }
      : null,
  };
}

export function avoidSkippedPatternOnSteps(
  steps: StructuredDailyBabyStep[],
  skippedTitle: string | null | undefined
): StructuredDailyBabyStep[] {
  const skipped = skippedTitle?.trim();
  if (!skipped) return steps;
  const normalizedSkipped = normalizeText(skipped);
  if (normalizedSkipped.length < 8) return steps;

  return steps.filter((step) => {
    const normalized = normalizeText(step.title);
    if (normalized === normalizedSkipped) return false;
    if (normalized.includes(normalizedSkipped) || normalizedSkipped.includes(normalized)) {
      return false;
    }
    return true;
  });
}
