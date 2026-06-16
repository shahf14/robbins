import type {AppLocale} from '@/i18n/config';
import {buildReflectionNextBestAction} from '@/lib/next-best-action';
import type {ReflectionBlockerReason} from '@/lib/life-coach/types';
import {
  BLOCKER_REFLECTION_HINTS,
  type ReflectionAnalysis,
} from './types';

export function buildReflectionAnalysisFallback(input: {
  locale: AppLocale;
  blocker_reason: ReflectionBlockerReason | null;
}): ReflectionAnalysis {
  const blocker = input.blocker_reason ?? 'other';
  const he = input.locale === 'he';
  const hints = BLOCKER_REFLECTION_HINTS[blocker][he ? 'he' : 'en'];

  const BLOCKER_MAX_MINUTES: Partial<Record<typeof blocker, number>> = {
    family_chaos: 5,
    emotional_resistance: 5,
    low_energy: 8,
  };
  const maxMinutes = BLOCKER_MAX_MINUTES[blocker] ?? 10;
  const maxTasks = hints.risk_signal === 'high' || blocker === 'no_time' ? 1 : 2;

  return {
    patterns: [
      he
        ? blocker === 'low_energy'
          ? 'בימים עם פחות אנרגיה צריך משימות קטנות יותר ופחות מעברים.'
          : `דפוס: ${hints.trigger} מוביל ל-${hints.blocker}.`
        : blocker === 'low_energy'
          ? 'Lower-energy days need smaller tasks and less switching.'
          : `Pattern: ${hints.trigger} leads to ${hints.blocker}.`,
    ],
    recommendations: [hints.recommended_adjustment],
    primary_emotion: hints.primary_emotion,
    trigger: hints.trigger,
    blocker: hints.blocker,
    need: hints.need,
    recommended_adjustment: hints.recommended_adjustment,
    risk_signal: hints.risk_signal,
    next_day_adjustments: {
      max_tasks: maxTasks,
      max_minutes_per_task: maxMinutes,
      easy_only: hints.risk_signal !== 'low',
    },
    next_best_action: buildReflectionNextBestAction({
      locale: input.locale,
      blocker_reason: input.blocker_reason,
      recommended_adjustment: hints.recommended_adjustment,
      easy_only: hints.risk_signal !== 'low',
    }),
  };
}
