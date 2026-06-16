import type {AppLocale} from '@/i18n/config';
import type {AdaptiveTaskCount} from '@/lib/life-coach/adaptive-task-count';
import type {PersonalDifficultyCalibration} from '@/lib/life-coach/personal-difficulty-calibration';
import type {
  FormulationSession,
  LifeContextStatus,
  RiskLevel,
  StructuredDailyBabyStep,
  WeeklyPlanAdjustments,
} from '@/lib/life-coach/types';

type BehaviorLoadRisk = 'low' | 'moderate' | 'high' | 'critical';

type BreakingPointKind =
  | 'high_intensity'
  | 'elevated_risk'
  | 'time_barrier'
  | 'avoidance_maintaining'
  | 'skipped_clarification'
  | 'over_committed_frequency'
  | 'life_context_overload'
  | 'cognitive_overload';

export type LoadAdaptationContext = {
  locale: AppLocale;
  behavior_load_risk: BehaviorLoadRisk;
  intensity_0_10: number;
  risk_level: RiskLevel | null;
  breaking_points: BreakingPointKind[];
  max_steps_cap: number;
  easy_only_bias: boolean;
  max_minutes_cap: number;
  opening_only_steps: boolean;
  reduce_content_depth: boolean;
  anticipated_barrier: string | null;
  frequency_per_week: number | null;
  energy_changed: boolean;
  life_context_statuses: LifeContextStatus[];
  hide_personalized_challenge: boolean;
  survival_mode_soft: boolean;
  adaptation_rules: string[];
  signals_used: string[];
};

function resolveIntensity(session: FormulationSession): number {
  const fromApproved = session.formulation_approved?.intensity_0_10;
  if (typeof fromApproved === 'number' && fromApproved >= 0) {
    return Math.min(10, Math.max(0, fromApproved));
  }
  const fromDimensions = session.dimensions?.intensity_0_10;
  if (typeof fromDimensions === 'number' && fromDimensions >= 0) {
    return Math.min(10, Math.max(0, fromDimensions));
  }
  return 5;
}

function hasAvoidanceMaintaining(maintaining: string[]): boolean {
  return maintaining.some((f) => /avoid|הימנע|procrastin|דחי|postpon/i.test(f));
}

function hasTimeBarrier(text: string): boolean {
  return /time|busy|עמוס|no time|אין זמן|לוח|schedule|זמן/i.test(text);
}

function hasHeavyLifeContext(statuses: LifeContextStatus[]): boolean {
  return statuses.some((s) => s === 'new_parent' || s === 'caregiver');
}

function hasEnergyChanged(session: FormulationSession): boolean {
  return session.dimensions?.mind_body?.energy_changed === true;
}

function computeBehaviorLoadRisk(input: {
  breaking_points: BreakingPointKind[];
  intensity_0_10: number;
  risk_level: RiskLevel | null;
  energy_changed: boolean;
  life_context_statuses: LifeContextStatus[];
}): BehaviorLoadRisk {
  const {breaking_points, intensity_0_10, risk_level, energy_changed, life_context_statuses} = input;

  if (
    risk_level === 'crisis' ||
    risk_level === 'elevated' ||
    breaking_points.includes('elevated_risk')
  ) {
    return 'critical';
  }

  const lifeContextOverload =
    intensity_0_10 >= 6 &&
    energy_changed &&
    hasHeavyLifeContext(life_context_statuses);
  const cognitiveOverload = breaking_points.includes('cognitive_overload');

  if (
    lifeContextOverload ||
    cognitiveOverload ||
    (intensity_0_10 >= 8 && breaking_points.length >= 2) ||
    (intensity_0_10 >= 6 && breaking_points.length >= 3)
  ) {
    return 'high';
  }

  if (
    intensity_0_10 >= 6 ||
    breaking_points.includes('high_intensity') ||
    breaking_points.includes('life_context_overload') ||
    breaking_points.length >= 2
  ) {
    return 'moderate';
  }

  return 'low';
}

export function shouldHidePersonalizedChallenge(ctx: LoadAdaptationContext | null): boolean {
  if (!ctx) return false;
  return ctx.hide_personalized_challenge;
}

export function isSoftSurvivalMode(ctx: LoadAdaptationContext | null): boolean {
  if (!ctx) return false;
  return ctx.survival_mode_soft;
}

function buildAdaptationRules(
  ctx: Omit<LoadAdaptationContext, 'adaptation_rules'>,
  locale: AppLocale
): string[] {
  const rules: string[] = [];
  const he = locale === 'he';

  if (ctx.breaking_points.includes('high_intensity')) {
    rules.push(
      he
        ? `עומס גבוה (${ctx.intensity_0_10}/10) — מקסימום ${ctx.max_steps_cap} צעדים, קלים יותר.`
        : `High load (${ctx.intensity_0_10}/10) — max ${ctx.max_steps_cap} steps, easier difficulty.`
    );
  }
  if (ctx.breaking_points.includes('elevated_risk')) {
    rules.push(
      he
        ? 'רמת סיכון מוגברת — קצב רך, בלי לחץ לביצוע.'
        : 'Elevated risk — gentle pacing, no performance pressure.'
    );
  }
  if (ctx.reduce_content_depth) {
    rules.push(
      he
        ? 'דילג על שלבי הבהרה — אל תעמיס תוכן או משימות מורכבות.'
        : 'Skipped clarification phases — do not overload with content or complex tasks.'
    );
  }
  if (ctx.breaking_points.includes('time_barrier')) {
    rules.push(
      he
        ? `חסם זמן — אין משימות מעל ${ctx.max_minutes_cap} דקות.`
        : `Time barrier — no tasks over ${ctx.max_minutes_cap} minutes.`
    );
  }
  if (ctx.opening_only_steps) {
    rules.push(
      he
        ? 'גורם מק sustaining: הימנעות — צעדי "פתיחה בלבד", לא סיום מלא.'
        : 'Maintaining factor: avoidance — opening-only steps, not full completion.'
    );
  }
  if (ctx.breaking_points.includes('over_committed_frequency')) {
    rules.push(
      he
        ? 'תדירות שבועית גבוהה + עומס — צמצם נפח יומי.'
        : 'High weekly frequency + load — shrink daily volume.'
    );
  }
  if (ctx.breaking_points.includes('life_context_overload')) {
    rules.push(
      he
        ? 'עומס גבוה: intensity + שינוי אנרגיה + טיפול/הורות — מקסימום 1–2 צעדים קצרים.'
        : 'High load: intensity + energy shift + caregiving/parenting — max 1–2 short steps.'
    );
  }
  if (ctx.breaking_points.includes('cognitive_overload')) {
    rules.push(
      he
        ? 'עומס קוגניטיבי: דילגת על שלבים + חסם זמן — משימות פשוטות בלבד, עד 10 דקות.'
        : 'Cognitive overload: skipped phases + time barrier — simple tasks only, up to 10 minutes.'
    );
  }
  if (ctx.hide_personalized_challenge) {
    rules.push(
      he
        ? 'אל תציג אתגר שבועי — עומס גבוה מדי לפני burnout.'
        : 'Do not surface weekly challenge — load too high before burnout.'
    );
  }
  return rules;
}

export function buildLoadAdaptationContext(
  session: FormulationSession,
  locale: AppLocale
): LoadAdaptationContext {
  const intensity = resolveIntensity(session);
  const risk = session.risk_level;
  const handoff = session.coach_handoff;
  const maintaining = session.formulation_approved?.maintaining_factors ?? [];
  const contexts = [
    ...(session.dimensions?.contexts ?? []),
    ...(session.formulation_approved?.contexts ?? []),
  ];
  const freq = session.dimensions?.frequency_per_week ?? null;
  const life_context_statuses =
    session.life_context_statuses.length > 0 ? session.life_context_statuses : [];
  const energy_changed = hasEnergyChanged(session);
  const breaking_points: BreakingPointKind[] = [];
  const signals: string[] = [];

  let max_steps_cap = 3;
  let easy_only_bias = false;
  let max_minutes_cap = 20;
  let opening_only_steps = false;
  let reduce_content_depth = false;

  if (intensity >= 8) {
    breaking_points.push('high_intensity');
    signals.push('intensity_0_10.high');
    max_steps_cap = 1;
    easy_only_bias = true;
    max_minutes_cap = 8;
  } else if (intensity >= 6) {
    breaking_points.push('high_intensity');
    signals.push('intensity_0_10.moderate_high');
    max_steps_cap = Math.min(max_steps_cap, 2);
    easy_only_bias = true;
    max_minutes_cap = Math.min(max_minutes_cap, 10);
  }

  if (risk === 'elevated' || risk === 'crisis') {
    breaking_points.push('elevated_risk');
    signals.push(`risk_level.${risk}`);
    max_steps_cap = 1;
    easy_only_bias = true;
    max_minutes_cap = Math.min(max_minutes_cap, 5);
  }

  if ((session.phases_skipped?.length ?? 0) > 0) {
    breaking_points.push('skipped_clarification');
    signals.push(`phases_skipped.${session.phases_skipped.join(',')}`);
    reduce_content_depth = true;
    max_steps_cap = Math.min(max_steps_cap, 2);
    easy_only_bias = true;
  }

  const barrierBlob = [handoff?.anticipated_barrier, ...maintaining, ...contexts]
    .filter(Boolean)
    .join(' ');
  if (hasTimeBarrier(barrierBlob)) {
    breaking_points.push('time_barrier');
    signals.push('anticipated_barrier.time');
    max_minutes_cap = Math.min(max_minutes_cap, 10);
  }

  if (hasAvoidanceMaintaining(maintaining)) {
    breaking_points.push('avoidance_maintaining');
    signals.push('maintaining_factors.avoidance');
    opening_only_steps = true;
    max_minutes_cap = Math.min(max_minutes_cap, 10);
    easy_only_bias = true;
  }

  if (typeof freq === 'number' && freq >= 5 && intensity >= 6) {
    breaking_points.push('over_committed_frequency');
    signals.push('frequency_per_week.high_with_intensity');
    max_steps_cap = Math.min(max_steps_cap, 1);
  }

  if (intensity >= 6 && energy_changed && hasHeavyLifeContext(life_context_statuses)) {
    breaking_points.push('life_context_overload');
    signals.push('intensity+energy_changed+life_context');
    max_steps_cap = Math.min(max_steps_cap, 2);
    easy_only_bias = true;
    max_minutes_cap = Math.min(max_minutes_cap, 10);
  }

  const anticipated = handoff?.anticipated_barrier?.trim() ?? '';
  if ((session.phases_skipped?.length ?? 0) > 0 && hasTimeBarrier(anticipated)) {
    breaking_points.push('cognitive_overload');
    signals.push('phases_skipped+anticipated_barrier.time');
    reduce_content_depth = true;
    max_steps_cap = Math.min(max_steps_cap, 2);
    easy_only_bias = true;
    max_minutes_cap = Math.min(max_minutes_cap, 10);
  }

  const behavior_load_risk = computeBehaviorLoadRisk({
    breaking_points,
    intensity_0_10: intensity,
    risk_level: risk,
    energy_changed,
    life_context_statuses,
  });

  if (behavior_load_risk === 'high') {
    max_steps_cap = Math.min(max_steps_cap, 2);
    max_minutes_cap = Math.min(max_minutes_cap, 10);
    easy_only_bias = true;
  } else if (behavior_load_risk === 'critical') {
    max_steps_cap = 1;
    max_minutes_cap = Math.min(max_minutes_cap, 5);
    easy_only_bias = true;
  }

  const hide_personalized_challenge =
    behavior_load_risk === 'high' || behavior_load_risk === 'critical';
  const survival_mode_soft =
    hide_personalized_challenge || breaking_points.includes('elevated_risk');

  const partial: Omit<
    LoadAdaptationContext,
    'adaptation_rules' | 'behavior_load_risk' | 'hide_personalized_challenge' | 'survival_mode_soft'
  > = {
    locale,
    intensity_0_10: intensity,
    risk_level: risk,
    breaking_points,
    max_steps_cap,
    easy_only_bias,
    max_minutes_cap,
    opening_only_steps,
    reduce_content_depth,
    anticipated_barrier: anticipated || null,
    frequency_per_week: typeof freq === 'number' ? freq : null,
    energy_changed,
    life_context_statuses,
    signals_used: signals,
  };

  return {
    behavior_load_risk,
    hide_personalized_challenge,
    survival_mode_soft,
    ...partial,
    adaptation_rules: buildAdaptationRules(
      {
        ...partial,
        hide_personalized_challenge,
        survival_mode_soft,
        behavior_load_risk,
      },
      locale
    ),
  };
}

export function loadAdaptationForPrompt(
  ctx: LoadAdaptationContext | null
): Record<string, unknown> | null {
  if (!ctx || ctx.breaking_points.length === 0) return null;
  return {
    behavior_load_risk: ctx.behavior_load_risk,
    intensity_0_10: ctx.intensity_0_10,
    risk_level: ctx.risk_level,
    breaking_points: ctx.breaking_points,
    max_steps_cap: ctx.max_steps_cap,
    easy_only_bias: ctx.easy_only_bias,
    max_minutes_cap: ctx.max_minutes_cap,
    opening_only_steps: ctx.opening_only_steps,
    reduce_content_depth: ctx.reduce_content_depth,
    anticipated_barrier: ctx.anticipated_barrier,
    frequency_per_week: ctx.frequency_per_week,
    energy_changed: ctx.energy_changed,
    life_context_statuses: ctx.life_context_statuses,
    hide_personalized_challenge: ctx.hide_personalized_challenge,
    survival_mode_soft: ctx.survival_mode_soft,
    adaptation_rules: ctx.adaptation_rules,
  };
}

export function loadAdaptationPromptBlock(locale: AppLocale): string {
  return locale === 'he'
    ? [
        '## התאמת עומס — נקודת שבירה (load_adaptation):',
        'לפני יצירת צעדים — חשב behavior_load_risk מ-intensity, energy_changed, life_context, phases_skipped, anticipated_barrier, risk_level.',
        'behavior_load_risk=high/critical → 1–2 צעדים, max 5–10 דקות, easy_only, בלי personalized_challenge.',
        'intensity גבוה + energy_changed + caregiver/new_parent → life_context_overload.',
        'phases_skipped + חסם "אין זמן" → cognitive_overload.',
        'elevated_risk → קצב רך, בלי אתגרים חזקים.',
        'אם קיים load_adaptation — כבד breaking_points ו-adaptation_rules.',
        'intensity גבוה → פחות צעדים (max_steps_cap), difficulty easy, דקות קצרות.',
        'phases_skipped → אל תוסיף שכבות תוכן; משימה אחת פשוטה.',
        'time_barrier → estimated_minutes ≤ max_minutes_cap (לרוב ≤10).',
        'avoidance_maintaining → צעדי "פתיחה בלבד" (פתיחה/התחלה, לא סיום מלא).',
        'elevated_risk → קצב רך, בלי לחץ.',
      ].join('\n')
    : [
        '## Load adaptation — breaking point (load_adaptation):',
        'Before generating steps — compute behavior_load_risk from intensity, energy_changed, life_context, phases_skipped, anticipated_barrier, risk_level.',
        'behavior_load_risk=high/critical → 1–2 steps, max 5–10 minutes, easy_only, no personalized_challenge.',
        'High intensity + energy_changed + caregiver/new_parent → life_context_overload.',
        'phases_skipped + "no time" barrier → cognitive_overload.',
        'elevated_risk → gentle pacing, no strong challenges.',
        'When load_adaptation exists — honor breaking_points and adaptation_rules.',
        'High intensity → fewer steps (max_steps_cap), easy difficulty, short minutes.',
        'phases_skipped → no extra content layers; one simple task.',
        'time_barrier → estimated_minutes ≤ max_minutes_cap (usually ≤10).',
        'avoidance_maintaining → opening-only steps (start/open, not full finish).',
        'elevated_risk → gentle pacing, no pressure.',
      ].join('\n');
}

export function loadAdaptationWeeklyPromptBlock(locale: AppLocale): string {
  return locale === 'he'
    ? [
        '## התאמת עומס לשבוע הבא (load_adaptation):',
        'אם load_adaptation קיים — plan_adjustments/recommended_adjustment חייבים לכבד max_steps_cap ו-max_minutes_cap.',
        'אל תמליץ על יותר מ-2 משימות/יום כש-intensity≥6 או phases_skipped.',
        'עדיפות לשימור נוכחות על נפח.',
      ].join('\n')
    : [
        '## Weekly load adaptation (load_adaptation):',
        'When load_adaptation exists — plan_adjustments/recommended_adjustment must respect max_steps_cap and max_minutes_cap.',
        'Do not recommend more than 2 tasks/day when intensity≥6 or phases_skipped.',
        'Prioritize showing up over volume.',
      ].join('\n');
}

export function applyLoadAdaptationToTaskCount(
  adaptive: AdaptiveTaskCount,
  ctx: LoadAdaptationContext | null
): AdaptiveTaskCount {
  if (!ctx || ctx.breaking_points.length === 0) return adaptive;

  const max_steps = Math.min(adaptive.max_steps, ctx.max_steps_cap);
  const easy_only = adaptive.easy_only || ctx.easy_only_bias;
  const tightened = max_steps < adaptive.max_steps || (easy_only && !adaptive.easy_only);

  return {
    max_steps,
    easy_only,
    reason: tightened ? 'breaking_point' : adaptive.reason,
  };
}

export function applyLoadAdaptationToCalibration(
  calibration: PersonalDifficultyCalibration,
  ctx: LoadAdaptationContext | null
): PersonalDifficultyCalibration {
  if (!ctx || ctx.breaking_points.length === 0) return calibration;

  const max_minutes = Math.min(calibration.max_minutes, ctx.max_minutes_cap);
  const target_minutes = Math.min(calibration.target_minutes, max_minutes);
  const difficulty_ceiling = ctx.easy_only_bias
    ? 'easy'
    : calibration.difficulty_ceiling;

  return {
    ...calibration,
    max_minutes,
    target_minutes,
    difficulty_ceiling,
    ramp_mode: ctx.breaking_points.length > 0 ? 'reduce' : calibration.ramp_mode,
  };
}

const OPENING_ONLY_HE = /^(פתיחה בלבד|רק להתחיל|2 דק.*רק התחלה)/i;
const OPENING_ONLY_EN = /^(opening only|just start|2 min.*start only)/i;

function looksLikeOpeningOnly(title: string, locale: AppLocale): boolean {
  const t = title.trim();
  return locale === 'he' ? OPENING_ONLY_HE.test(t) : OPENING_ONLY_EN.test(t);
}

function applyLoadAdaptationToStep(
  step: StructuredDailyBabyStep,
  ctx: LoadAdaptationContext | null
): StructuredDailyBabyStep {
  if (!ctx || ctx.breaking_points.length === 0) return step;

  let next: StructuredDailyBabyStep = {
    ...step,
    estimated_minutes: Math.min(step.estimated_minutes, ctx.max_minutes_cap),
    difficulty: ctx.easy_only_bias ? 'easy' : step.difficulty,
  };

  if (ctx.opening_only_steps && !looksLikeOpeningOnly(next.title, ctx.locale)) {
    const he = ctx.locale === 'he';
    next = {
      ...next,
      title: he ? `פתיחה בלבד: ${next.title}` : `Opening only: ${next.title}`,
      estimated_minutes: Math.min(next.estimated_minutes, 10),
      difficulty: 'easy',
    };
  }

  if (next.fallback_estimated_minutes != null) {
    next.fallback_estimated_minutes = Math.min(
      next.fallback_estimated_minutes,
      ctx.max_minutes_cap
    );
  }

  return next;
}

export function applyLoadAdaptationToSteps(
  steps: StructuredDailyBabyStep[],
  ctx: LoadAdaptationContext | null
): StructuredDailyBabyStep[] {
  if (!ctx || ctx.breaking_points.length === 0) return steps;
  return steps.map((step) => applyLoadAdaptationToStep(step, ctx));
}

export function clampWeeklyPlanAdjustmentsWithLoadAdaptation(
  adjustments: WeeklyPlanAdjustments,
  ctx: LoadAdaptationContext | null
): WeeklyPlanAdjustments {
  if (!ctx || ctx.breaking_points.length === 0) return adjustments;

  return {
    ...adjustments,
    max_minutes_per_task: Math.min(adjustments.max_minutes_per_task, ctx.max_minutes_cap),
    easy_only_bias: adjustments.easy_only_bias || ctx.easy_only_bias,
    cap_tasks:
      adjustments.cap_tasks != null
        ? Math.min(adjustments.cap_tasks, ctx.max_steps_cap)
        : ctx.max_steps_cap,
    rationale: [adjustments.rationale, ...ctx.adaptation_rules].filter(Boolean).join(' '),
  };
}

/** Surface survival mode when formulation signals high dropout risk. */
export function shouldEmphasizeSurvivalMode(ctx: LoadAdaptationContext | null): boolean {
  if (!ctx) return false;
  return (
    ctx.behavior_load_risk === 'high' ||
    ctx.behavior_load_risk === 'critical' ||
    ctx.survival_mode_soft ||
    ctx.breaking_points.includes('elevated_risk') ||
    ctx.breaking_points.includes('high_intensity') ||
    (ctx.intensity_0_10 >= 7 && ctx.breaking_points.length >= 2)
  );
}
