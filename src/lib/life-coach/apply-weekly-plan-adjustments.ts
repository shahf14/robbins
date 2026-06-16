import type {AdaptiveTaskCount} from '@/lib/life-coach/adaptive-task-count';
import type {PersonalDifficultyCalibration} from '@/lib/life-coach/personal-difficulty-calibration';
import type {ShortTermContext} from '@/lib/coach-memory';
import type {
  StructuredDailyBabyStep,
  WeeklyPlanAdjustments,
} from '@/lib/life-coach/types';

export function applyWeeklyPlanAdjustmentsToCalibration(
  calibration: PersonalDifficultyCalibration,
  adjustments: WeeklyPlanAdjustments
): PersonalDifficultyCalibration {
  return {
    ...calibration,
    max_minutes: Math.min(calibration.max_minutes, adjustments.max_minutes_per_task),
    target_minutes: Math.min(calibration.target_minutes, adjustments.max_minutes_per_task),
    difficulty_ceiling: adjustments.easy_only_bias ? 'easy' : calibration.difficulty_ceiling,
  };
}

export function applyWeeklyPlanAdjustmentsToTaskCount(
  adaptive: AdaptiveTaskCount,
  adjustments: WeeklyPlanAdjustments,
  shortTerm: ShortTermContext | null | undefined
): AdaptiveTaskCount {
  let max_steps = adaptive.max_steps;
  let easy_only = adaptive.easy_only;

  if (adjustments.cap_tasks != null) {
    max_steps = Math.min(max_steps, adjustments.cap_tasks);
  }

  const lowEnergyToday =
    shortTerm?.latest_energy != null && shortTerm.latest_energy < 5;

  if (adjustments.easy_only_bias && lowEnergyToday) {
    easy_only = true;
    max_steps = Math.min(max_steps, 1);
  }

  return {
    ...adaptive,
    max_steps,
    easy_only,
  };
}

export function applyWeeklyPlanAdjustmentsToSteps(
  steps: StructuredDailyBabyStep[],
  adjustments: WeeklyPlanAdjustments
): StructuredDailyBabyStep[] {
  return steps
    .filter((step) => !adjustments.deemphasize_domains.includes(step.domain))
    .map((step) => ({
      ...step,
      estimated_minutes: Math.min(step.estimated_minutes, adjustments.max_minutes_per_task),
      difficulty: adjustments.easy_only_bias ? ('easy' as const) : step.difficulty,
    }))
    .sort((a, b) => {
      const aBoost = adjustments.emphasize_domains.includes(a.domain) ? 1 : 0;
      const bBoost = adjustments.emphasize_domains.includes(b.domain) ? 1 : 0;
      return bBoost - aBoost;
    });
}
