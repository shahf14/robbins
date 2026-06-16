import type {AppLocale} from '@/i18n/config';
import type {CoachHistoryContext} from '@/lib/coach/history-context';
import {
  coachEasyOnlyForEmotionalStage,
  type EmotionalStageRouting,
} from '@/lib/formulation/emotional-stage-routing';
import type {ReflectionBlockerReason} from '@/lib/life-coach/types';
import type {NextBestAction} from './types';

export function buildReflectionNextBestAction(input: {
  locale: AppLocale;
  blocker_reason: ReflectionBlockerReason | null;
  recommended_adjustment: string;
  easy_only: boolean;
  pending_step_id?: string | null;
}): NextBestAction {
  const he = input.locale === 'he';
  if (input.pending_step_id) {
    return {
      label: he ? 'לסיים את הצעד של היום' : 'Finish today\'s step',
      action_type: 'complete_daily_step',
      target_id: input.pending_step_id,
      estimated_minutes: input.easy_only ? 3 : 5,
    };
  }
  if (input.easy_only || input.blocker_reason === 'low_energy') {
    return {
      label: he ? 'ליצור צעדים קלים להיום' : 'Generate easy steps for today',
      action_type: 'generate_daily_steps',
      estimated_minutes: 2,
    };
  }
  return {
    label: truncateLabel(input.recommended_adjustment, he ? 40 : 48) || (he ? 'צעד קטן מחר' : 'One small step tomorrow'),
    action_type: 'open_life_coach',
    estimated_minutes: 5,
  };
}

export function buildWeeklyReviewNextBestAction(input: {
  locale: AppLocale;
  recommended_adjustment: string;
  next_identity_action?: string | null;
}): NextBestAction {
  const he = input.locale === 'he';
  const label =
    truncateLabel(input.next_identity_action ?? input.recommended_adjustment, he ? 48 : 56) ||
    (he ? 'צעד זהות קטן השבוע' : 'One tiny identity step this week');
  return {
    label,
    action_type: 'generate_daily_steps',
    estimated_minutes: 5,
  };
}

export function buildGoalStructuringNextBestAction(input: {
  locale: AppLocale;
  first_step_title?: string | null;
  first_step_minutes?: number | null;
}): NextBestAction {
  const he = input.locale === 'he';
  const stepTitle = input.first_step_title?.trim();
  return {
    label: stepTitle
      ? truncateLabel(stepTitle, he ? 40 : 48)
      : he
        ? 'לשמור את המטרה'
        : 'Save this goal',
    action_type: 'save_goal',
    estimated_minutes: input.first_step_minutes ?? 5,
  };
}

export function buildCoachNextBestAction(input: {
  locale: AppLocale;
  emotionalState: string;
  escape: number;
  energy: number;
  context: CoachHistoryContext;
  emotional_stage?: EmotionalStageRouting | null;
}): NextBestAction {
  const he = input.locale === 'he';
  const pendingStep = input.context.today_steps.find((step) => step.status === 'pending');
  const easyOnly =
    coachEasyOnlyForEmotionalStage(input.emotional_stage ?? null) ||
    input.energy <= 4 ||
    input.escape >= 8;
  const maxMinutes = input.emotional_stage?.coach.max_estimated_minutes ?? 5;

  if (pendingStep) {
    return {
      label: truncateLabel(pendingStep.title, he ? 40 : 48) || (he ? 'לסיים צעד אחד' : 'Complete one step'),
      action_type: 'complete_daily_step',
      estimated_minutes: easyOnly ? Math.min(3, maxMinutes) : Math.min(5, maxMinutes),
    };
  }

  if (easyOnly) {
    return {
      label: he ? 'טקס בוקר קצר' : 'Morning ritual',
      action_type: 'open_morning_ritual',
      estimated_minutes: Math.min(3, maxMinutes),
    };
  }

  if (input.context.today_steps.length === 0) {
    return {
      label: he ? 'ליצור צעדים להיום' : 'Generate today\'s steps',
      action_type: 'generate_daily_steps',
      estimated_minutes: Math.min(2, maxMinutes),
    };
  }

  return {
    label: he ? 'לפתוח את יעדי החיים' : 'Open life coach goals',
    action_type: 'open_life_coach',
    estimated_minutes: maxMinutes,
  };
}

function truncateLabel(text: string, max: number): string {
  const clean = text.trim();
  if (!clean) return '';
  if (clean.length <= max) return clean;
  const slice = clean.slice(0, max);
  const lastSpace = slice.lastIndexOf(' ');
  return (lastSpace > max * 0.5 ? slice.slice(0, lastSpace) : slice).trim().replace(/[,;:]$/, '');
}
