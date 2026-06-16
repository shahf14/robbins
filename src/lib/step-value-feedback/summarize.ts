import {dateToYMD} from '@/lib/date-utils';
import type {DailyBabyStep, StepValueFeedback} from '@/lib/life-coach/types';

export type StepValueFeedbackSummary = {
  window_days: number;
  sample_size: number;
  felt_progress: number;
  too_small: number;
  too_generic: number;
  missed_problem: number;
  dominant_issue: StepValueFeedback | 'felt_progress' | null;
  adaptation_hint: string | null;
};

const NEGATIVE_FEEDBACK: StepValueFeedback[] = [
  'too_small',
  'too_generic',
  'missed_problem',
];

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}

function adaptationHint(dominant: StepValueFeedbackSummary['dominant_issue']): string | null {
  if (!dominant || dominant === 'felt_progress') return null;
  if (dominant === 'too_small') {
    return (
      'User reports completed steps feel too small — add depth: 12-20 min tasks with a stronger deliverable, ' +
      'not micro-only gestures.'
    );
  }
  if (dominant === 'too_generic') {
    return (
      'User reports steps feel too generic — enforce measurable deliverables (list, message sent, decision, ' +
      'physical action) per No Fluff rule.'
    );
  }
  return (
    'User reports steps miss their real problem — tie every step to primary_blocker, pain_addressed, ' +
    'and weekly_focus; avoid wellness tips unrelated to their goal.'
  );
}

export function computeStepValueFeedbackSummary(
  steps: DailyBabyStep[],
  windowDays = 14
): StepValueFeedbackSummary | null {
  const since = dateDaysAgo(Math.max(0, windowDays - 1));
  const withFeedback = steps.filter(
    (step) =>
      step.scheduled_date >= since &&
      step.status === 'completed' &&
      step.value_feedback != null
  );

  if (withFeedback.length === 0) return null;

  const counts: Record<StepValueFeedback, number> = {
    felt_progress: 0,
    too_small: 0,
    too_generic: 0,
    missed_problem: 0,
  };

  for (const step of withFeedback) {
    if (step.value_feedback) counts[step.value_feedback] += 1;
  }

  const ranked = (Object.entries(counts) as Array<[StepValueFeedback, number]>)
    .sort((a, b) => b[1] - a[1]);
  const top = ranked[0];
  const second = ranked[1];

  let dominant_issue: StepValueFeedbackSummary['dominant_issue'] = null;
  if (top && top[1] > 0) {
    const negativeTop = NEGATIVE_FEEDBACK.includes(top[0]) ? top[0] : null;
    const negativeSecond =
      second && NEGATIVE_FEEDBACK.includes(second[0]) && second[1] >= 2
        ? second[0]
        : null;

    if (negativeTop && top[1] >= 2) {
      dominant_issue = negativeTop;
    } else if (negativeTop && negativeSecond && top[1] === second[1]) {
      dominant_issue = negativeTop;
    } else if (top[0] === 'felt_progress' && top[1] >= Math.ceil(withFeedback.length * 0.6)) {
      dominant_issue = 'felt_progress';
    } else if (negativeTop && top[1] > (counts.felt_progress ?? 0)) {
      dominant_issue = negativeTop;
    }
  }

  return {
    window_days: windowDays,
    sample_size: withFeedback.length,
    felt_progress: counts.felt_progress,
    too_small: counts.too_small,
    too_generic: counts.too_generic,
    missed_problem: counts.missed_problem,
    dominant_issue,
    adaptation_hint: adaptationHint(dominant_issue),
  };
}

export function stepValueFeedbackForPrompt(
  summary: StepValueFeedbackSummary | null | undefined
): Omit<StepValueFeedbackSummary, 'adaptation_hint'> & {adaptation_hint?: string | null} | null {
  if (!summary || summary.sample_size === 0) return null;
  return {
    window_days: summary.window_days,
    sample_size: summary.sample_size,
    felt_progress: summary.felt_progress,
    too_small: summary.too_small,
    too_generic: summary.too_generic,
    missed_problem: summary.missed_problem,
    dominant_issue: summary.dominant_issue,
    adaptation_hint: summary.adaptation_hint,
  };
}

export const STEP_VALUE_FEEDBACK_PROMPT_BLOCK = [
  '## Step value feedback (learn what actually helped):',
  'Payload may include step_value_feedback from post-completion checks.',
  'If dominant_issue is too_small: increase depth — 12-20 min steps with stronger deliverables, not micro-only.',
  'If too_generic: enforce measurable deliverables (No Fluff / No Fake Progress).',
  'If missed_problem: align every step to primary_blocker, pain_addressed, and active goal — not generic wellness.',
  'If felt_progress dominates: keep strategy, vary wording only.',
].join('\n');
