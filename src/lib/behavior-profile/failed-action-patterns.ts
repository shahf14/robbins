import {stepActionWindow} from './skip-windows';
import type {DailyBabyStep, DailyReflection} from '@/lib/life-coach/types';
import {VAGUE_TASK_PATTERNS} from '@/lib/life-coach/vague-task-detection';
import type {PersonalDifficultyCalibration} from '@/lib/life-coach/personal-difficulty-calibration';
import type {StructuredDailyBabyStep} from '@/lib/life-coach/types';
import type {FailedActionPattern, FailedActionPatternKind} from './types';

const LONG_MINUTES_THRESHOLD = 15;
const MIN_PATTERN_SKIPS = 2;
const MIN_SAMPLE = 3;
const MIN_SKIP_RATE = 0.5;

function isTerminal(step: DailyBabyStep): boolean {
  return step.status === 'completed' || step.status === 'partial' || step.status === 'skipped';
}

function skipRate(skipped: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((skipped / total) * 100) / 100;
}

function detectDurationTooLong(steps: DailyBabyStep[]): FailedActionPattern | null {
  const longSteps = steps.filter(
    (s) => isTerminal(s) && (s.estimated_minutes ?? 0) >= LONG_MINUTES_THRESHOLD
  );
  const skippedLong = longSteps.filter((s) => s.status === 'skipped');
  if (skippedLong.length < MIN_PATTERN_SKIPS) return null;
  const rate = skipRate(skippedLong.length, longSteps.length);
  if (skippedLong.length >= MIN_PATTERN_SKIPS && (longSteps.length < MIN_SAMPLE || rate >= MIN_SKIP_RATE)) {
    return {
      kind: 'duration_too_long',
      failure_count: skippedLong.length,
      sample_size: longSteps.length,
      skip_rate: rate,
      recommendation:
        'Long steps (15+ min) are repeatedly skipped — cap new steps at 5-10 minutes with easy difficulty.',
    };
  }
  return null;
}

function detectEveningTasks(steps: DailyBabyStep[]): FailedActionPattern | null {
  let skipped = 0;
  let total = 0;
  for (const step of steps) {
    if (!isTerminal(step)) continue;
    const window = stepActionWindow(step);
    if (window !== 'evening') continue;
    total += 1;
    if (step.status === 'skipped') skipped += 1;
  }
  if (skipped < MIN_PATTERN_SKIPS || total < MIN_SAMPLE) return null;
  const rate = skipRate(skipped, total);
  if (rate < MIN_SKIP_RATE) return null;
  return {
    kind: 'evening_tasks',
    failure_count: skipped,
    sample_size: total,
    skip_rate: rate,
    recommendation:
      'Evening tasks fail often — schedule actionable steps in morning/midday, not evening.',
  };
}

function isVagueReflectionText(text: string | null | undefined): boolean {
  const trimmed = text?.trim() ?? '';
  if (trimmed.length < 8) return true;
  return VAGUE_TASK_PATTERNS.some((pattern) => pattern.test(trimmed));
}

function detectVagueReflection(
  steps: DailyBabyStep[],
  reflections: DailyReflection[]
): FailedActionPattern | null {
  let failures = 0;
  for (const reflection of reflections) {
    if (reflection.blocker_reason === 'unclear_task') failures += 1;
    if (isVagueReflectionText(reflection.reflection_text)) failures += 1;
  }
  for (const step of steps) {
    if (step.value_feedback === 'too_generic') failures += 1;
  }
  if (failures < MIN_PATTERN_SKIPS) return null;
  return {
    kind: 'vague_reflection',
    failure_count: failures,
    sample_size: reflections.length + steps.length,
    skip_rate: null,
    recommendation:
      'Vague reflections/steps fail — use concrete deliverables and imperative action titles.',
  };
}

function detectHardDifficulty(steps: DailyBabyStep[]): FailedActionPattern | null {
  const hardSteps = steps.filter((s) => isTerminal(s) && s.difficulty === 'hard');
  const skippedHard = hardSteps.filter((s) => s.status === 'skipped');
  if (skippedHard.length < MIN_PATTERN_SKIPS) return null;
  const rate = skipRate(skippedHard.length, hardSteps.length);
  if (hardSteps.length < MIN_SAMPLE && skippedHard.length < MIN_PATTERN_SKIPS) return null;
  if (rate < MIN_SKIP_RATE && skippedHard.length < MIN_PATTERN_SKIPS + 1) return null;
  return {
    kind: 'hard_difficulty',
    failure_count: skippedHard.length,
    sample_size: hardSteps.length,
    skip_rate: rate,
    recommendation:
      'Hard-difficulty steps are repeatedly skipped — default to easy steps until completion rises.',
  };
}

export function computeFailedActionPatterns(
  steps: DailyBabyStep[],
  reflections: DailyReflection[]
): FailedActionPattern[] {
  const patterns: FailedActionPattern[] = [];
  const duration = detectDurationTooLong(steps);
  const evening = detectEveningTasks(steps);
  const vague = detectVagueReflection(steps, reflections);
  const hard = detectHardDifficulty(steps);
  if (duration) patterns.push(duration);
  if (evening) patterns.push(evening);
  if (vague) patterns.push(vague);
  if (hard) patterns.push(hard);
  return patterns;
}

export function failedActionPatternsForPrompt(
  patterns: FailedActionPattern[]
): Array<Record<string, unknown>> {
  return patterns.map((pattern) => ({
    kind: pattern.kind,
    failure_count: pattern.failure_count,
    sample_size: pattern.sample_size,
    skip_rate: pattern.skip_rate,
    recommendation: pattern.recommendation,
  }));
}

function hasFailedPattern(
  patterns: FailedActionPattern[],
  kind: FailedActionPatternKind
): boolean {
  return patterns.some((pattern) => pattern.kind === kind);
}

export const FAILED_ACTION_PATTERNS_PROMPT_BLOCK = [
  '## Failed action patterns (mandatory when present):',
  'user_behavior_profile.failed_action_patterns lists patterns that repeatedly failed for this user.',
  'Do NOT repeat failed_action_patterns — change the plan shape, not the person.',
  'duration_too_long → max 5-10 minutes per step, easy only, one micro-deliverable.',
  'evening_tasks → no demanding evening steps; use morning/midday for action.',
  'vague_reflection → concrete imperative titles, no "work on" or "improve" phrasing.',
  'hard_difficulty → easy difficulty until completion rate improves.',
].join('\n');

export function applyFailedActionPatternsToCalibration(
  calibration: PersonalDifficultyCalibration,
  patterns: FailedActionPattern[]
): PersonalDifficultyCalibration {
  if (patterns.length === 0) return calibration;

  let next = {...calibration};

  if (hasFailedPattern(patterns, 'duration_too_long')) {
    next = {
      ...next,
      difficulty_ceiling: 'easy',
      target_minutes: Math.min(next.target_minutes, 8),
      max_minutes: Math.min(next.max_minutes, 10),
      ramp_mode: 'reduce',
    };
  }

  if (hasFailedPattern(patterns, 'hard_difficulty')) {
    next = {
      ...next,
      difficulty_ceiling: 'easy',
      ramp_mode: next.ramp_mode === 'raise' ? 'hold' : 'reduce',
    };
  }

  if (hasFailedPattern(patterns, 'evening_tasks')) {
    next = {
      ...next,
      target_minutes: Math.min(next.target_minutes, 10),
      max_minutes: Math.min(next.max_minutes, 12),
    };
  }

  return next;
}

type StepDurationDifficulty = Pick<
  StructuredDailyBabyStep,
  'estimated_minutes' | 'difficulty'
>;

export function enforceFailedActionPatternsOnSteps<T extends StepDurationDifficulty>(
  steps: T[],
  patterns: FailedActionPattern[]
): T[] {
  if (patterns.length === 0) return steps;

  const capLong = hasFailedPattern(patterns, 'duration_too_long');
  const capHard = hasFailedPattern(patterns, 'hard_difficulty');

  return steps.map((step) => {
    let estimated_minutes = step.estimated_minutes;
    let difficulty = step.difficulty;

    if (capLong) {
      estimated_minutes = Math.max(3, Math.min(10, estimated_minutes));
      difficulty = 'easy';
    }
    if (capHard) {
      difficulty = 'easy';
    }

    return estimated_minutes === step.estimated_minutes && difficulty === step.difficulty
      ? step
      : {...step, estimated_minutes, difficulty};
  });
}
