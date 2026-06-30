import {assignSuggestedStepTimes} from '@/lib/schedule-content';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';

type Prefs = {
  wake_time: string;
  sleep_time: string;
  preferred_action_window: PreferredActionWindow;
};

const ANCHOR_BY_WINDOW: Record<PreferredActionWindow, string> = {
  morning: 'morningRoutine',
  midday: 'lunchBreak',
  evening: 'eveningWindDown',
  flexible: 'morningRoutine',
};

export function buildImplementationIntention(
  step: DailyBabyStepResponse,
  prefs: Prefs,
  stepIndex = 0,
  totalSteps = 1
): {anchorKey: string; anchorValue?: string; action: string; minutes: number} {
  const times = assignSuggestedStepTimes(
    totalSteps,
    prefs.wake_time,
    prefs.sleep_time,
    prefs.preferred_action_window
  );
  const suggestedTime = times[stepIndex];

  if (suggestedTime) {
    return {
      anchorKey: 'afterTime',
      anchorValue: suggestedTime,
      action: step.title,
      minutes: step.estimated_minutes,
    };
  }

  return {
    anchorKey: ANCHOR_BY_WINDOW[prefs.preferred_action_window],
    anchorValue: prefs.preferred_action_window === 'morning' ? prefs.wake_time : undefined,
    action: step.title,
    minutes: step.estimated_minutes,
  };
}
