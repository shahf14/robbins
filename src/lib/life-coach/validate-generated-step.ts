import type {AppLocale} from '@/i18n/config';
import {isFirstWinStep} from '@/lib/formulation/first-win-routing';
import {
  applyRealLifeAlignmentRepair,
  evaluateRealLifeAlignment,
  type RealLifeAlignmentContext,
} from '@/lib/formulation/real-life-alignment-routing';
import type {RecurringBlockerPattern} from '@/lib/blocker-patterns/types';
import {ensurePlanBFields} from '@/lib/life-coach/plan-b';
import type {PersonalDifficultyCalibration} from '@/lib/life-coach/personal-difficulty-calibration';
import {
  buildFallbackStepContract,
  hasClearAction,
  isValidPainAddressed,
  stepContractToStructured,
} from '@/lib/life-coach/step-contract';
import {detectFakeProgress} from '@/lib/life-coach/no-fluff';
import {
  clarifyStepIfVague,
  detectVagueTask,
  rewriteVagueStep,
} from '@/lib/life-coach/vague-task-detection';
import {
  applyValueGateRepair,
  evaluateValueGate,
  type ValueGateProfile,
} from '@/lib/life-coach/value-gate';
import {
  LIFE_DOMAINS,
  type DailyReflection,
  type Goal,
  type LifeDomain,
  type LifeDomainState,
  type ReflectionBlockerReason,
  type StructuredDailyBabyStep,
} from '@/lib/life-coach/types';

type StepValidationIssue =
  | 'not_actionable'
  | 'vague_language'
  | 'time_out_of_range'
  | 'time_too_long'
  | 'missing_fallback'
  | 'invalid_domain'
  | 'orphan_goal'
  | 'domain_goal_mismatch'
  | 'value_gate_failed'
  | 'missing_pain_addressed'
  | 'missing_real_life_alignment'
  | 'fake_progress';

type StepValidationResult = {
  valid: boolean;
  issues: StepValidationIssue[];
  value_gate_score?: number;
};

export type StepValidationProfile = {
  locale: AppLocale;
  goals: Array<Pick<Goal, 'id' | 'domain' | 'title' | 'description'>>;
  domainStates: Array<Pick<LifeDomainState, 'domain' | 'available_time_per_day' | 'main_blockers'>>;
  calibration: PersonalDifficultyCalibration;
  strict_clarity: boolean;
  recurringBlockers?: RecurringBlockerPattern[];
  recentReflections?: Array<Pick<DailyReflection, 'blocker_reason' | 'date'>>;
  worstBlocker?: ReflectionBlockerReason | null;
  real_life_alignment?: RealLifeAlignmentContext | null;
};

export type StepValidationRunMetrics = {
  checked: number;
  passed_first_pass: number;
  passed_after_regenerate: number;
  fallback_repaired: number;
  value_gate_failed: number;
  value_gate_repaired: number;
  regenerated: boolean;
};

const VAGUE_LANGUAGE_PATTERNS = [
  /\b(better|more|improve|mindset|consistent|motivation|productive|healthier|successful|positive|mindful)\b/i,
  /\b(work on your|focus on being|try to be|get better at|be more|think about|be better)\b/i,
  /\bwork on\b/i,
  /(יותר טוב|לשפר|מוטיבציה|עקביות|מיינדסט|להיות יותר|לעבוד על|להתמקד ב|להשתפר|לחשוב על)/,
];

function isLifeDomain(value: string): value is LifeDomain {
  return (LIFE_DOMAINS as readonly string[]).includes(value);
}

function domainBudget(
  domain: LifeDomain,
  profile: StepValidationProfile
): number {
  const state = profile.domainStates.find((d) => d.domain === domain);
  return state?.available_time_per_day ?? profile.calibration.max_minutes;
}

function hasVagueLanguage(title: string, description = ''): boolean {
  const combined = `${title} ${description}`.trim();
  return detectVagueTask(title, description) ||
    VAGUE_LANGUAGE_PATTERNS.some((pattern) => pattern.test(combined));
}

function hasValidFallback(step: StructuredDailyBabyStep): boolean {
  return !!(
    step.fallback_title?.trim() &&
      step.fallback_description?.trim() &&
      step.fallback_title.trim().length >= 4 &&
      step.fallback_description.trim().length >= 8 &&
      step.fallback_estimated_minutes != null &&
      step.fallback_estimated_minutes >= 1 &&
      step.fallback_estimated_minutes <= 5
  );
}

function hasValidDomainGoal(
  step: StructuredDailyBabyStep,
  profile: StepValidationProfile
): {valid: boolean; issues: Array<'invalid_domain' | 'orphan_goal' | 'domain_goal_mismatch'>} {
  const issues: Array<'invalid_domain' | 'orphan_goal' | 'domain_goal_mismatch'> = [];

  if (!isLifeDomain(step.domain)) {
    issues.push('invalid_domain');
    return {valid: false, issues};
  }

  if (!step.goal_id) {
    return {valid: true, issues};
  }

  const goal = profile.goals.find((g) => g.id === step.goal_id);
  if (!goal) {
    issues.push('orphan_goal');
    return {valid: false, issues};
  }
  if (goal.domain !== step.domain) {
    issues.push('domain_goal_mismatch');
    return {valid: false, issues};
  }

  return {valid: true, issues};
}

function isAppropriateTime(
  step: StructuredDailyBabyStep,
  profile: StepValidationProfile
): {valid: boolean; issues: Array<'time_out_of_range' | 'time_too_long'>} {
  const issues: Array<'time_out_of_range' | 'time_too_long'> = [];
  const minutes = step.estimated_minutes;

  if (!Number.isFinite(minutes) || minutes < 5 || minutes > 20) {
    issues.push('time_out_of_range');
  }

  const budget = domainBudget(step.domain, profile);
  const maxAllowed = Math.min(profile.calibration.max_minutes, budget);

  if (minutes > maxAllowed) {
    issues.push('time_too_long');
  }

  return {valid: issues.length === 0, issues};
}

function valueGateProfileFrom(profile: StepValidationProfile): ValueGateProfile {
  return {
    locale: profile.locale,
    goals: profile.goals,
    domainBlockers: profile.domainStates.map((state) => ({
      domain: state.domain,
      main_blockers: state.main_blockers ?? [],
    })),
    recurringBlockers: profile.recurringBlockers,
    recentReflections: profile.recentReflections,
    worstBlocker: profile.worstBlocker ?? null,
  };
}

/** Pre-save quality gate for AI-generated daily steps. */
function validateGeneratedStep(
  step: StructuredDailyBabyStep,
  profile: StepValidationProfile
): StepValidationResult {
  const issues: StepValidationIssue[] = [];

  if (!hasClearAction(step.title, step.description ?? '')) {
    issues.push('not_actionable');
  }

  if (detectFakeProgress(step.title, step.description ?? '', step.success_signal ?? '')) {
    issues.push('fake_progress');
  }

  if (hasVagueLanguage(step.title, step.description ?? '')) {
    if (profile.strict_clarity || !hasClearAction(step.title, step.description ?? '')) {
      issues.push('vague_language');
    }
  }

  const timeCheck = isAppropriateTime(step, profile);
  issues.push(...timeCheck.issues);

  if (!hasValidFallback(step)) {
    issues.push('missing_fallback');
  }

  const domainGoalCheck = hasValidDomainGoal(step, profile);
  issues.push(...domainGoalCheck.issues);

  if (!isValidPainAddressed(step.pain_addressed)) {
    issues.push('missing_pain_addressed');
  }

  const valueGate = evaluateValueGate(step, valueGateProfileFrom(profile));
  if (!valueGate.passed) {
    issues.push('value_gate_failed');
  }

  if (
    profile.real_life_alignment &&
    !isFirstWinStep(step) &&
    !evaluateRealLifeAlignment(step, profile.real_life_alignment).passed
  ) {
    issues.push('missing_real_life_alignment');
  }

  return {
    valid: issues.length === 0,
    issues,
    value_gate_score: valueGate.score,
  };
}

function resolveGoalForStep(
  step: StructuredDailyBabyStep,
  profile: StepValidationProfile
): Pick<Goal, 'id' | 'domain' | 'title'> | null {
  if (step.goal_id) {
    const linked = profile.goals.find((g) => g.id === step.goal_id);
    if (linked) return linked;
  }

  const domainGoal = profile.goals.find((g) => g.domain === step.domain);
  if (domainGoal) return domainGoal;

  return profile.goals[0] ?? null;
}

function concreteTitleForGoal(
  goal: Pick<Goal, 'title' | 'domain'> | null,
  domain: LifeDomain,
  locale: AppLocale
): string {
  const he = locale === 'he';
  const label = goal?.title?.trim() || domain;

  if (he) {
    return `בצע צעד אחד קטן לקראת: ${label}`.slice(0, 180);
  }
  return `Take one small action toward: ${label}`.slice(0, 180);
}

/** Replace or repair a step that failed validation. */
function applyValidationFallbackTemplate(
  step: StructuredDailyBabyStep,
  profile: StepValidationProfile,
  issues: StepValidationIssue[]
): StructuredDailyBabyStep {
  if (
    issues.includes('missing_real_life_alignment') &&
    profile.real_life_alignment
  ) {
    const aligned = applyRealLifeAlignmentRepair(step, profile.real_life_alignment);
    const recheck = validateGeneratedStep(aligned, profile);
    if (recheck.valid || !recheck.issues.includes('missing_real_life_alignment')) {
      return {...aligned, validation_fallback_applied: true};
    }
  }

  if (issues.includes('value_gate_failed') || issues.includes('missing_pain_addressed')) {
    const gate = evaluateValueGate(step, valueGateProfileFrom(profile));
    const repaired = applyValueGateRepair(step, valueGateProfileFrom(profile), gate);
    const recheck = validateGeneratedStep(repaired, profile);
    if (recheck.valid) return repaired;
    if (
      !recheck.issues.includes('invalid_domain') &&
      !recheck.issues.includes('orphan_goal') &&
      !recheck.issues.includes('domain_goal_mismatch')
    ) {
      return repaired;
    }
  }

  const goal = resolveGoalForStep(step, profile);
  const domain = goal?.domain ?? (isLifeDomain(step.domain) ? step.domain : 'mind');
  const goalId = goal?.id ?? step.goal_id ?? null;
  const budget = Math.min(domainBudget(domain, profile), profile.calibration.target_minutes);
  const needsVagueRewrite =
    issues.includes('not_actionable') ||
    issues.includes('vague_language') ||
    issues.includes('fake_progress') ||
    issues.includes('missing_pain_addressed') ||
    detectVagueTask(step.title, step.description ?? '');

  if (needsVagueRewrite) {
    const rewritten = rewriteVagueStep(
      {...step, domain, goal_id: goalId},
      {
        locale: profile.locale,
        goals: profile.goals,
        calibration: profile.calibration,
      }
    );
    const recheck = validateGeneratedStep(rewritten, profile);
    if (recheck.valid) {
      return {...rewritten, validation_fallback_applied: true};
    }
    if (
      !issues.includes('invalid_domain') &&
      !issues.includes('orphan_goal') &&
      !issues.includes('domain_goal_mismatch')
    ) {
      return {...rewritten, validation_fallback_applied: true};
    }
  }

  const needsFullTemplate =
    issues.includes('invalid_domain') ||
    issues.includes('orphan_goal') ||
    issues.includes('domain_goal_mismatch');

  if (needsFullTemplate) {
    const contract = buildFallbackStepContract({
      title: concreteTitleForGoal(goal, domain, profile.locale),
      description:
        profile.locale === 'he'
          ? 'פעולה אחת ברורה — מתחילים עכשיו, בלי שלמות.'
          : 'One clear action — start now, not perfection.',
      estimated_minutes: budget,
      difficulty: 'easy',
      locale: profile.locale,
      why:
        step.reasoning ??
        (profile.locale === 'he'
          ? 'צעד מוגדר מחדש כדי שיהיה ברור מה לעשות.'
          : 'Step rewritten so the first action is obvious.'),
      pain:
        step.pain_addressed ??
        (profile.locale === 'he'
          ? 'מקטין עומס ומאפשר התחלה גם כשהכול נראה גדול מדי.'
          : 'Shrinks overload so starting is possible when everything feels too big.'),
    });

    return {
      ...stepContractToStructured(contract, {domain, goal_id: goalId}),
      validation_fallback_applied: true,
    };
  }

  let repaired: StructuredDailyBabyStep = {...step, domain, goal_id: goalId};

  if (issues.includes('missing_fallback')) {
    repaired = ensurePlanBFields(repaired, profile.locale);
  }

  if (issues.includes('time_out_of_range') || issues.includes('time_too_long')) {
    repaired = {
      ...repaired,
      estimated_minutes: Math.max(5, Math.min(20, budget)),
      difficulty: 'easy',
    };
  }

  return {...repaired, validation_fallback_applied: true};
}

export function buildStepValidationProfile(input: {
  locale: AppLocale;
  goals: Array<Pick<Goal, 'id' | 'domain' | 'title' | 'description'>>;
  domainStates: Array<Pick<LifeDomainState, 'domain' | 'available_time_per_day' | 'main_blockers'>>;
  calibration: PersonalDifficultyCalibration;
  recurringBlockers?: RecurringBlockerPattern[];
  recentReflections?: Array<Pick<DailyReflection, 'blocker_reason' | 'date'>>;
  worstBlocker?: ReflectionBlockerReason | null;
  real_life_alignment?: RealLifeAlignmentContext | null;
}): StepValidationProfile {
  const unclearHistory = (input.recurringBlockers ?? []).some(
    (pattern) => pattern.blocker === 'unclear_task'
  );

  return {
    locale: input.locale,
    goals: input.goals,
    domainStates: input.domainStates,
    calibration: input.calibration,
    strict_clarity: unclearHistory,
    recurringBlockers: input.recurringBlockers,
    recentReflections: input.recentReflections,
    worstBlocker: input.worstBlocker ?? null,
    real_life_alignment: input.real_life_alignment ?? null,
  };
}

/**
 * Validate steps before DB insert.
 * On failure: regenerate the batch once, then apply per-step fallback templates.
 */
export async function qualifyGeneratedStepsBeforeSave(
  steps: StructuredDailyBabyStep[],
  profile: StepValidationProfile,
  options?: {
    regenerate?: () => Promise<StructuredDailyBabyStep[]>;
    /** Only these steps trigger a full regenerate (e.g. AI batch). */
    isRegenerateCandidate?: (step: StructuredDailyBabyStep) => boolean;
  }
): Promise<{steps: StructuredDailyBabyStep[]; metrics: StepValidationRunMetrics}> {
  const isCandidate = options?.isRegenerateCandidate ?? (() => true);

  const evaluate = (batch: StructuredDailyBabyStep[]) =>
    batch.map((step) => ({step, result: validateGeneratedStep(step, profile)}));

  let current = steps.map((step) =>
    isFirstWinStep(step)
      ? step
      : clarifyStepIfVague(step, {
      locale: profile.locale,
      goals: profile.goals,
      calibration: profile.calibration,
      recurringBlockers: profile.recurringBlockers,
      recentReflections: profile.recentReflections,
      worstBlocker: profile.worstBlocker,
      mainBlockers:
        profile.domainStates.find((state) => state.domain === step.domain)?.main_blockers ?? [],
    })
  );
  let evaluated = evaluate(current);
  const passedFirst = evaluated.filter((e) => e.result.valid).length;

  const needsRegenerate =
    evaluated.some((e) => !e.result.valid && isCandidate(e.step)) &&
    options?.regenerate != null;

  let regenerated = false;
  if (needsRegenerate) {
    regenerated = true;
    current = (await options?.regenerate?.()) ?? current;
    evaluated = evaluate(current);
  }

  const passedAfter = evaluated.filter((e) => e.result.valid).length;
  let fallbackRepaired = 0;
  let valueGateFailed = 0;
  let valueGateRepaired = 0;

  const finalSteps = evaluated.map(({step, result}) => {
    if (isFirstWinStep(step)) {
      return step;
    }
    if (result.valid) {
      return {
        ...step,
        value_gate_score: result.value_gate_score ?? step.value_gate_score,
      };
    }
    if (result.issues.includes('value_gate_failed')) valueGateFailed += 1;
    fallbackRepaired += 1;
    const repaired = applyValidationFallbackTemplate(step, profile, result.issues);
    if (repaired.value_gate_repaired) valueGateRepaired += 1;
    return repaired;
  });

  return {
    steps: finalSteps,
    metrics: {
      checked: finalSteps.length,
      passed_first_pass: passedFirst,
      passed_after_regenerate: passedAfter,
      fallback_repaired: fallbackRepaired,
      value_gate_failed: valueGateFailed,
      value_gate_repaired: valueGateRepaired,
      regenerated,
    },
  };
}
