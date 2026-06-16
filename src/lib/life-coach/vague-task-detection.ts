import type {AppLocale} from '@/i18n/config';
import type {RecurringBlockerPattern} from '@/lib/blocker-patterns/types';
import {
  pickActionPatternForProfile,
  structuredStepFromActionPattern,
} from '@/lib/life-coach/action-patterns';
import type {PersonalDifficultyCalibration} from '@/lib/life-coach/personal-difficulty-calibration';
import {detectFakeProgress} from '@/lib/life-coach/no-fluff';
import {hasClearAction} from '@/lib/life-coach/step-contract';
import type {
  DailyReflection,
  Goal,
  ReflectionBlockerReason,
  StructuredDailyBabyStep,
} from '@/lib/life-coach/types';

/** Problematic vague phrasing — triggers physical-action rewrite. */
export const VAGUE_TASK_PATTERNS: RegExp[] = [
  /\bwork on\b/i,
  /\bimprove\b/i,
  /\bthink about\b/i,
  /\bbe better\b/i,
  /\bbe more\b/i,
  /\bfocus on\b/i,
  /\btry to\b/i,
  /\bget better\b/i,
  /\bconsider\b/i,
  /\breflect on\b/i,
  /להשתפר/,
  /לעבוד על/,
  /לחשוב על/,
  /להיות יותר/,
  /לשפר/,
  /להתמקד ב/,
];

export function detectVagueTask(title: string, description = ''): boolean {
  const combined = `${title} ${description}`.trim();
  if (!combined) return false;
  return (
    detectFakeProgress(title, description) ||
    VAGUE_TASK_PATTERNS.some((pattern) => pattern.test(combined))
  );
}

function resolveGoal(
  step: StructuredDailyBabyStep,
  goals: Array<Pick<Goal, 'id' | 'domain' | 'title'>>
): Pick<Goal, 'id' | 'domain' | 'title'> | null {
  if (step.goal_id) {
    const linked = goals.find((g) => g.id === step.goal_id);
    if (linked) return linked;
  }
  return goals.find((g) => g.domain === step.domain) ?? goals[0] ?? null;
}

/**
 * Rewrite vague task into a physical, measurable action (≤10 minutes).
 * Prompt contract: "הפוך את זה לפעולה פיזית/מדידה של עד 10 דקות."
 */
export function rewriteVagueStep(
  step: StructuredDailyBabyStep,
  profile: {
    locale: AppLocale;
    goals: Array<Pick<Goal, 'id' | 'domain' | 'title'>>;
    calibration: PersonalDifficultyCalibration;
    recurringBlockers?: RecurringBlockerPattern[];
    recentReflections?: Array<Pick<DailyReflection, 'blocker_reason' | 'date'>>;
    worstBlocker?: ReflectionBlockerReason | null;
    mainBlockers?: string[];
  }
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
    mainBlockers: profile.mainBlockers,
  });

  const rewritten = structuredStepFromActionPattern(pattern, {
    goal_id: goalId,
    locale: profile.locale,
    why:
      step.reasoning ??
      (he
        ? 'המשימה המקורית הייתה מעורפלת — הוחלפה בתבנית פעולה מוכחת.'
        : 'Original task was vague — replaced with a proven action pattern.'),
  });

  return {
    ...rewritten,
    vague_task_rewritten: true,
    validation_fallback_applied: step.validation_fallback_applied,
  };
}

/** Detect vague phrasing and rewrite before save when needed. */
export function clarifyStepIfVague(
  step: StructuredDailyBabyStep,
  profile: {
    locale: AppLocale;
    goals: Array<Pick<Goal, 'id' | 'domain' | 'title'>>;
    calibration: PersonalDifficultyCalibration;
    recurringBlockers?: RecurringBlockerPattern[];
    recentReflections?: Array<Pick<DailyReflection, 'blocker_reason' | 'date'>>;
    worstBlocker?: ReflectionBlockerReason | null;
    mainBlockers?: string[];
  }
): StructuredDailyBabyStep {
  const vague =
    detectVagueTask(step.title, step.description ?? '') ||
    !hasClearAction(step.title, step.description ?? '');
  if (!vague) return step;
  return rewriteVagueStep(step, profile);
}
