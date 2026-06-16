import type {AppLocale} from '@/i18n/config';
import type {RecurringBlockerPattern} from '@/lib/blocker-patterns/types';
import {
  pickActionPatternForProfile,
  structuredStepFromActionPattern,
} from '@/lib/life-coach/action-patterns';
import {hasClearAction, isValidPainAddressed} from '@/lib/life-coach/step-contract';
import {detectFakeProgress, hasRealDeliverable} from '@/lib/life-coach/no-fluff';
import {detectVagueTask, VAGUE_TASK_PATTERNS} from '@/lib/life-coach/vague-task-detection';
import type {Goal, LifeDomain, StructuredDailyBabyStep} from '@/lib/life-coach/types';

const VALUE_GATE_CRITERIA = [
  'goal_linked',
  'addresses_blocker',
  'visible_outcome',
  'doable_today',
  'not_generic',
] as const;

type ValueGateCriterion = (typeof VALUE_GATE_CRITERIA)[number];

type ValueGateScores = Record<ValueGateCriterion, boolean>;

export type ValueGateResult = {
  passed: boolean;
  score: number;
  criteria: ValueGateScores;
  failed: ValueGateCriterion[];
};

export type ValueGateProfile = {
  locale: AppLocale;
  goals: Array<Pick<Goal, 'id' | 'domain' | 'title' | 'description'>>;
  domainBlockers?: Array<{domain: LifeDomain; main_blockers: string[]}>;
  recurringBlockers?: RecurringBlockerPattern[];
  recentReflections?: Array<{blocker_reason: string | null; date: string}>;
  worstBlocker?: string | null;
};

export const VALUE_GATE_PROMPT_BLOCK = [
  '## Value Gate (REQUIRED — reject and replace weak steps):',
  'Before returning each step, score it mentally on ALL five criteria. If any fail, REPLACE the step before output.',
  '1. goal_linked — directly advances an active goal, weekly_focus, or today_theme (not a random wellness tip).',
  '2. addresses_blocker — names or adapts to a real friction (low energy, no time, avoidance) via expected_resistance or description.',
  '3. visible_outcome — success_signal names a real deliverable today (decision, message sent, short list, physical action, environmental change, specific choice, measurement, or timed minutes).',
  '4. doable_today — one clear action completable in 5-20 minutes today; not "this month" or "think about".',
  '5. not_generic — no fluff-only steps (think/read/feel/imagine/write vaguely/plan to improve) unless a deliverable is explicit. Must include pain_addressed naming the friction reduced.',
  'WEAK (reject): "Think about your health." / "תחשוב על הבריאות שלך."',
  'STRONG (pass): "Write 3 simple meals you will eat this week and pick one to shop for today." / "רשום 3 ארוחות פשוטות ובחר אחת לקנות לה מצרכים היום."',
  'If a step fails Value Gate, replace it with a concrete list+choice or verb+deliverable tied to the user goal.',
].join('\n');

const BLOCKER_SIGNAL_PATTERNS = [
  /\b(energy|time|avoid|resist|block|overwhelm|tired|friction|low energy|no time)\b/i,
  /\b(אנרגיה|זמן|עייפות|התנגדות|חסם|עומס|קושי|לחץ)\b/,
];

const GENERIC_LANGUAGE_PATTERNS = [
  /\b(better|more|improve|mindset|consistent|motivation|productive|healthier|successful|positive|mindful)\b/i,
  /\b(work on your|focus on being|try to be|get better at|be more|think about|be better)\b/i,
  /(יותר טוב|לשפר|מוטיבציה|עקביות|מיינדסט|להיות יותר|לעבוד על|להתמקד ב|להשתפר|לחשוב על)/,
];

const DEFERRED_ACTION_PATTERNS = [
  /\b(next week|next month|someday|eventually|later this month)\b/i,
  /\b(השבוע הבא|בחודש|מתישהו|בהמשך|יום אחד)\b/,
];

const GENERIC_RESISTANCE_PATTERNS = [
  /^fatigue or overload\b/i,
  /^עייפות או עומס\b/,
];

function resolveGoal(
  step: StructuredDailyBabyStep,
  goals: ValueGateProfile['goals']
): Pick<Goal, 'id' | 'domain' | 'title' | 'description'> | null {
  if (step.goal_id) {
    const linked = goals.find((g) => g.id === step.goal_id);
    if (linked) return linked;
  }
  return goals.find((g) => g.domain === step.domain) ?? goals[0] ?? null;
}

function significantWords(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.:;!?\-–—]+/)
    .filter((word) => word.length > 3);
}

function scoreGoalLinked(step: StructuredDailyBabyStep, profile: ValueGateProfile): boolean {
  const goal = resolveGoal(step, profile.goals);
  if (!goal) return profile.goals.length === 0;

  const blob = `${step.title} ${step.description} ${step.reasoning ?? ''}`.toLowerCase();
  const goalWords = significantWords(goal.title);
  const matched = goalWords.filter((word) => blob.includes(word)).length;

  if (step.goal_id === goal.id && matched >= 1) return true;
  if (matched >= 2) return true;

  const goalSnippet = goal.title.toLowerCase().slice(0, Math.min(16, goal.title.length));
  if (goalSnippet.length >= 4 && blob.includes(goalSnippet)) return true;

  const reasoning = step.reasoning ?? '';
  if (/\b(מיקוד|מטרה|focus|weekly|שבוע|goal|נבחר כי|chosen because)\b/i.test(reasoning)) {
    return true;
  }

  const descWords = significantWords(goal.description ?? '');
  if (descWords.filter((word) => blob.includes(word)).length >= 1 && hasClearAction(step.title, step.description)) {
    return true;
  }

  return false;
}

function domainBlockersForStep(
  step: StructuredDailyBabyStep,
  profile: ValueGateProfile
): string[] {
  const state = profile.domainBlockers?.find((d) => d.domain === step.domain);
  return state?.main_blockers ?? [];
}

function scoreAddressesBlocker(step: StructuredDailyBabyStep, profile: ValueGateProfile): boolean {
  if (!isValidPainAddressed(step.pain_addressed)) return false;

  const resistance = step.expected_resistance?.trim() ?? '';
  const blob = `${step.description} ${step.reasoning ?? ''} ${resistance} ${step.pain_addressed ?? ''}`;
  const domainBlockers = domainBlockersForStep(step, profile);

  if (
    resistance.length >= 12 &&
    !GENERIC_RESISTANCE_PATTERNS.some((pattern) => pattern.test(resistance))
  ) {
    return true;
  }

  if (BLOCKER_SIGNAL_PATTERNS.some((pattern) => pattern.test(blob))) return true;

  if (domainBlockers.some((blocker) => blob.toLowerCase().includes(blocker.toLowerCase()))) {
    return true;
  }

  if ((profile.recurringBlockers?.length ?? 0) > 0) {
    if (/\b(plan b|קל יותר|קצר יותר|shorter|easier|adapt|התאם)\b/i.test(blob)) return true;
  }

  if (step.fallback_title?.trim() && step.fallback_description?.trim()) {
    return BLOCKER_SIGNAL_PATTERNS.some((pattern) =>
      pattern.test(`${step.fallback_title} ${step.fallback_description}`)
    );
  }

  return false;
}

function scoreVisibleOutcome(step: StructuredDailyBabyStep): boolean {
  const signal = step.success_signal?.trim() ?? '';
  if (signal.length < 8) return false;

  return hasRealDeliverable(step.title, step.description ?? '', signal);
}

function scoreDoableToday(step: StructuredDailyBabyStep): boolean {
  if (!hasClearAction(step.title, step.description ?? '')) return false;
  if (!Number.isFinite(step.estimated_minutes) || step.estimated_minutes < 5 || step.estimated_minutes > 20) {
    return false;
  }

  const blob = `${step.title} ${step.description}`;
  if (DEFERRED_ACTION_PATTERNS.some((pattern) => pattern.test(blob))) return false;

  return true;
}

function scoreNotGeneric(step: StructuredDailyBabyStep): boolean {
  const combined = `${step.title} ${step.description ?? ''}`.trim();
  return (
    isValidPainAddressed(step.pain_addressed) &&
    !detectFakeProgress(step.title, step.description ?? '', step.success_signal ?? '') &&
    !detectVagueTask(step.title, step.description ?? '') &&
    !VAGUE_TASK_PATTERNS.some((pattern) => pattern.test(combined)) &&
    !GENERIC_LANGUAGE_PATTERNS.some((pattern) => pattern.test(combined))
  );
}

export function evaluateValueGate(
  step: StructuredDailyBabyStep,
  profile: ValueGateProfile
): ValueGateResult {
  const criteria: ValueGateScores = {
    goal_linked: scoreGoalLinked(step, profile),
    addresses_blocker: scoreAddressesBlocker(step, profile),
    visible_outcome: scoreVisibleOutcome(step),
    doable_today: scoreDoableToday(step),
    not_generic: scoreNotGeneric(step),
  };

  const failed = VALUE_GATE_CRITERIA.filter((key) => !criteria[key]);
  const score = VALUE_GATE_CRITERIA.length - failed.length;

  return {
    passed: failed.length === 0,
    score,
    criteria,
    failed,
  };
}

export function applyValueGateRepair(
  step: StructuredDailyBabyStep,
  profile: ValueGateProfile,
  gate: ValueGateResult
): StructuredDailyBabyStep {
  const goal = resolveGoal(step, profile.goals);
  const domain = goal?.domain ?? step.domain;
  const goalId = goal?.id ?? step.goal_id ?? null;
  const he = profile.locale === 'he';

  const pattern = pickActionPatternForProfile({
    domain,
    locale: profile.locale,
    goalTitle: goal?.title,
    recurringBlockers: profile.recurringBlockers,
    recentReflections: profile.recentReflections,
    worstBlocker: profile.worstBlocker,
    mainBlockers: domainBlockersForStep(step, profile),
  });

  const repaired = structuredStepFromActionPattern(pattern, {
    goal_id: goalId,
    locale: profile.locale,
    why:
      step.reasoning ??
      (he
        ? 'נבחר כי המשימה המקורית לא עמדה ב-Value Gate — הוחלפה בתבנית פעולה מוכחת.'
        : 'Original step failed Value Gate — replaced with a proven action pattern.'),
  });

  return {
    ...repaired,
    validation_fallback_applied: true,
    value_gate_repaired: true,
    value_gate_score: gate.score,
  };
}
