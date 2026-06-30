import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';
import type {DailyFocusContext} from '@/lib/daily-focus-context';
import {getPersonalDayPhase, type PersonalDayPhase} from '@/lib/schedule-content';

type HomeNowActionKind =
  | 'morning_ritual'
  | 'daily_step'
  | 'daily_focus'
  | 'evening_reset'
  | 'generate_steps'
  | 'set_goal'
  | 'day_complete';

export type HomeNowAction = {
  kind: HomeNowActionKind;
  reasonKey: string;
  ctaKey: string;
  step?: DailyBabyStepResponse;
  stepIndex?: number;
  stepCount?: number;
  estimatedMinutes?: number;
  dailyFocusSuggestion?: NonNullable<DailyFocusContext['suggestedAction']>;
};

export type HomeNowActionInput = {
  hasTodayRitual: boolean;
  hasEveningToday: boolean;
  hasGoals: boolean;
  todaySteps: DailyBabyStepResponse[];
  primaryStep: DailyBabyStepResponse | null;
  primaryStepIndex: number;
  dailyFocus?: DailyFocusContext | null;
  wakeTime: string;
  sleepTime: string;
  energy?: number | null;
  now?: Date;
};

function isEveningPhase(phase: PersonalDayPhase): boolean {
  return phase === 'evening' || phase === 'night';
}

function isMorningPhase(phase: PersonalDayPhase): boolean {
  return phase === 'pre_wake' || phase === 'morning';
}

export function resolveHomeNowAction(input: HomeNowActionInput): HomeNowAction {
  const phase = getPersonalDayPhase(input.wakeTime, input.sleepTime, input.now);
  const allDone =
    input.todaySteps.length > 0 && input.todaySteps.every((s) => s.status !== 'pending');
  const hasStepsToday = input.todaySteps.length > 0;

  if (!input.hasGoals) {
    return {
      kind: 'set_goal',
      reasonKey: 'home.nowAction.reasons.setGoal',
      ctaKey: 'home.nowAction.cta.setGoal',
    };
  }

  if (!input.hasTodayRitual && isMorningPhase(phase)) {
    return {
      kind: 'morning_ritual',
      reasonKey: 'home.nowAction.reasons.morningRitual',
      ctaKey: 'home.nowAction.cta.morningRitual',
    };
  }

  if (!hasStepsToday) {
    if (input.dailyFocus?.suggestedAction && !input.dailyFocus.linkedStepId) {
      return {
        kind: 'daily_focus',
        reasonKey: 'home.nowAction.reasons.dailyFocus',
        ctaKey: 'home.nowAction.cta.dailyFocus',
        dailyFocusSuggestion: input.dailyFocus.suggestedAction,
        estimatedMinutes: input.dailyFocus.suggestedAction.estimatedMinutes,
      };
    }

    return {
      kind: 'generate_steps',
      reasonKey: 'home.nowAction.reasons.generateSteps',
      ctaKey: 'home.nowAction.cta.generateSteps',
    };
  }

  const focusStep = input.dailyFocus?.linkedStepId
    ? input.todaySteps.find((step) => step.id === input.dailyFocus?.linkedStepId && step.status === 'pending')
    : null;

  if (focusStep) {
    return {
      kind: 'daily_step',
      reasonKey: 'home.nowAction.reasons.dailyFocusLinked',
      ctaKey: 'home.nowAction.cta.dailyStep',
      step: focusStep,
      stepIndex: input.todaySteps.findIndex((step) => step.id === focusStep.id),
      stepCount: input.todaySteps.length,
      estimatedMinutes: focusStep.estimated_minutes,
    };
  }

  if (input.dailyFocus?.suggestedAction && !input.dailyFocus.linkedStepId) {
    return {
      kind: 'daily_focus',
      reasonKey: 'home.nowAction.reasons.dailyFocus',
      ctaKey: 'home.nowAction.cta.dailyFocus',
      dailyFocusSuggestion: input.dailyFocus.suggestedAction,
      estimatedMinutes: input.dailyFocus.suggestedAction.estimatedMinutes,
    };
  }

  if (input.primaryStep) {
    return {
      kind: 'daily_step',
      reasonKey: isEveningPhase(phase)
        ? 'home.nowAction.reasons.dailyStepEvening'
        : 'home.nowAction.reasons.dailyStep',
      ctaKey: 'home.nowAction.cta.dailyStep',
      step: input.primaryStep,
      stepIndex: input.primaryStepIndex,
      stepCount: input.todaySteps.length,
      estimatedMinutes: input.primaryStep.estimated_minutes,
    };
  }

  if (allDone && !input.hasEveningToday && isEveningPhase(phase)) {
    return {
      kind: 'evening_reset',
      reasonKey: 'home.nowAction.reasons.eveningReset',
      ctaKey: 'home.nowAction.cta.eveningReset',
    };
  }

  if (!input.hasEveningToday && isEveningPhase(phase)) {
    return {
      kind: 'evening_reset',
      reasonKey: 'home.nowAction.reasons.eveningPending',
      ctaKey: 'home.nowAction.cta.eveningReset',
    };
  }

  return {
    kind: 'day_complete',
    reasonKey: isEveningPhase(phase)
      ? 'home.nowAction.reasons.allDoneEvening'
      : 'home.nowAction.reasons.allDoneDay',
    ctaKey: 'home.nowAction.cta.viewSteps',
  };
}
