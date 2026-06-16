import type {AdaptiveTaskCount} from '@/lib/life-coach/adaptive-task-count';
import type {PersonalDifficultyCalibration} from '@/lib/life-coach/personal-difficulty-calibration';
import type {StructuredDailyBabyStep} from '@/lib/life-coach/types';
import type {ReflectionPlanAdjustments} from './types';

export function applyReflectionAdjustmentsToTaskCount(
  adaptive: AdaptiveTaskCount,
  adjustments: ReflectionPlanAdjustments
): AdaptiveTaskCount {
  let max_steps = Math.min(adaptive.max_steps, adjustments.max_tasks);
  let easy_only = adaptive.easy_only || adjustments.easy_only;

  if (adjustments.risk_signal === 'high') {
    max_steps = 1;
    easy_only = true;
  }

  return {...adaptive, max_steps, easy_only};
}

export function applyReflectionAdjustmentsToCalibration(
  calibration: PersonalDifficultyCalibration,
  adjustments: ReflectionPlanAdjustments
): PersonalDifficultyCalibration {
  const cap = adjustments.max_minutes_per_task;
  return {
    ...calibration,
    max_minutes: Math.min(calibration.max_minutes, cap),
    target_minutes: Math.min(calibration.target_minutes, cap),
    difficulty_ceiling:
      adjustments.easy_only || adjustments.risk_signal === 'high'
        ? 'easy'
        : calibration.difficulty_ceiling,
  };
}

export function applyReflectionAdjustmentsToSteps(
  steps: StructuredDailyBabyStep[],
  adjustments: ReflectionPlanAdjustments
): StructuredDailyBabyStep[] {
  return steps
    .slice(0, adjustments.max_tasks)
    .map((step) => ({
      ...step,
      estimated_minutes: Math.min(step.estimated_minutes, adjustments.max_minutes_per_task),
      difficulty:
        adjustments.easy_only || adjustments.risk_signal === 'high'
          ? ('easy' as const)
          : step.difficulty,
    }));
}
