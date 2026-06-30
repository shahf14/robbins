import {dateToYMD} from '@/lib/date-utils';
import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';
import type {StepValueFeedback} from '@/lib/life-coach/types';

const NEGATIVE_FEEDBACK = new Set<StepValueFeedback>([
  'too_small',
  'too_generic',
  'missed_problem',
]);

/** Ask value question only sometimes — not after every completion. */
export function shouldPromptStepValueFeedback(input: {
  step: Pick<DailyBabyStepResponse, 'id' | 'generated_by_ai' | 'value_feedback' | 'status'>;
  completedAiStepsToday: number;
  recentNegativeFeedbackCount: number;
}): boolean {
  if (!input.step.generated_by_ai) return false;
  if (input.step.status !== 'completed') return false;
  if (input.step.value_feedback) return false;

  if (input.recentNegativeFeedbackCount >= 2) return true;

  return input.completedAiStepsToday % 2 === 1;
}

export function countRecentNegativeValueFeedback(
  steps: DailyBabyStepResponse[],
  windowDays = 7
): number {
  const since = new Date();
  since.setDate(since.getDate() - windowDays);
  const sinceStr = dateToYMD(since);

  return steps.filter(
    (step) =>
      step.scheduled_date >= sinceStr &&
      step.status === 'completed' &&
      step.value_feedback != null &&
      NEGATIVE_FEEDBACK.has(step.value_feedback)
  ).length;
}
