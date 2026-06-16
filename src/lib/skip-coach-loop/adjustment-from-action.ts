import type {AppLocale} from '@/i18n/config';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import type {SkipCoachAction, SkipCoachAdjustmentPayload} from './types';

const WINDOW_ROTATION: Record<PreferredActionWindow, PreferredActionWindow> = {
  morning: 'midday',
  midday: 'evening',
  evening: 'morning',
  flexible: 'morning',
};

export function buildSkipCoachAdjustment(
  action: SkipCoachAction,
  locale: AppLocale,
  currentWindow: PreferredActionWindow = 'flexible'
): SkipCoachAdjustmentPayload {
  const he = locale === 'he';

  if (action === 'shrink_tomorrow') {
    return {
      max_tasks: 1,
      max_minutes_per_task: 5,
      easy_only: true,
      prefer_plan_b: false,
      summary: he ? 'מחר: צעד אחד קצר יותר.' : 'Tomorrow: one shorter step.',
    };
  }

  if (action === 'change_time') {
    const nextWindow = WINDOW_ROTATION[currentWindow];
    return {
      max_tasks: 2,
      max_minutes_per_task: 10,
      easy_only: false,
      prefer_plan_b: false,
      time_window: nextWindow,
      summary: he
        ? `מחר: ננסה חלון זמן אחר (${nextWindow}).`
        : `Tomorrow: try a different time window (${nextWindow}).`,
    };
  }

  return {
    max_tasks: 1,
    max_minutes_per_task: 5,
    easy_only: true,
    prefer_plan_b: true,
    summary: he ? 'מחר: Plan B — רק הצעד הראשון.' : 'Tomorrow: Plan B — first move only.',
  };
}
