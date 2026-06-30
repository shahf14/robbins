import type {AdaptiveTaskCount} from '@/lib/life-coach/adaptive-task-count';
import type {PersonalDifficultyCalibration} from '@/lib/life-coach/personal-difficulty-calibration';
import {getPlanBContent} from '@/lib/life-coach/plan-b';
import type {StructuredDailyBabyStep} from '@/lib/life-coach/types';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import type {SkipCoachAdjustment} from './types';

function clipPlanBTitle(text: string, locale: 'he' | 'en'): string {
  const trimmed = text.trim();
  if (trimmed.length <= 72) return trimmed;
  return `${trimmed.slice(0, 69).trim()}…`;
}

export function applySkipCoachToTaskCount(
  adaptive: AdaptiveTaskCount,
  adjustment: SkipCoachAdjustment
): AdaptiveTaskCount {
  const payload = adjustment.adjustment;
  return {
    ...adaptive,
    max_steps: Math.min(adaptive.max_steps, payload.max_tasks),
    easy_only: adaptive.easy_only || payload.easy_only,
    reason: 'skip_coach_recovery',
  };
}

export function applySkipCoachToCalibration(
  calibration: PersonalDifficultyCalibration,
  adjustment: SkipCoachAdjustment
): PersonalDifficultyCalibration {
  const cap = adjustment.adjustment.max_minutes_per_task;
  return {
    ...calibration,
    max_minutes: Math.min(calibration.max_minutes, cap),
    target_minutes: Math.min(calibration.target_minutes, cap),
    difficulty_ceiling: adjustment.adjustment.easy_only
      ? 'easy'
      : calibration.difficulty_ceiling,
  };
}

export function applySkipCoachToSteps(
  steps: StructuredDailyBabyStep[],
  adjustment: SkipCoachAdjustment,
  locale: 'he' | 'en' = 'he'
): StructuredDailyBabyStep[] {
  const payload = adjustment.adjustment;
  return steps
    .slice(0, payload.max_tasks)
    .map((step) => {
      let next: StructuredDailyBabyStep = {
        ...step,
        estimated_minutes: Math.min(step.estimated_minutes, payload.max_minutes_per_task),
        difficulty: payload.easy_only ? ('easy' as const) : step.difficulty,
      };

      if (payload.prefer_plan_b) {
        const planB = payload.formulation_plan_b?.trim()
          ? {
              title: clipPlanBTitle(payload.formulation_plan_b, locale),
              description: payload.formulation_plan_b,
              estimated_minutes: Math.min(
                payload.max_minutes_per_task,
                payload.formulation_plan_b.length > 80 ? 3 : payload.max_minutes_per_task
              ),
            }
          : getPlanBContent(
              {
                ...step,
                id: 'temp',
                scheduled_date: '',
                status: 'pending',
                generated_by_ai: true,
                is_general: step.is_general ?? !step.goal_id,
                created_at: '',
              },
              locale
            );
        next = {
          ...next,
          title: planB.title,
          description: planB.description,
          estimated_minutes: Math.min(planB.estimated_minutes, payload.max_minutes_per_task),
          difficulty: 'easy',
          reasoning:
            locale === 'he'
              ? payload.formulation_plan_b
                ? 'נבחר כי אותו חסם מההבהרה חזר — Plan B מההבהרה.'
                : 'נבחר כי אתמול דילגת — מחר Plan B בלבד.'
              : payload.formulation_plan_b
                ? 'Chosen because the same clarification barrier returned — formulation Plan B.'
                : 'Chosen because you skipped yesterday — Plan B only tomorrow.',
        };
      }

      return next;
    });
}

export function resolveSkipCoachTimeWindow(
  base: PreferredActionWindow,
  adjustment: SkipCoachAdjustment | null
): PreferredActionWindow {
  return adjustment?.adjustment.time_window ?? base;
}
