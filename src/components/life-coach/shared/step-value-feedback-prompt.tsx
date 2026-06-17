'use client';

import {useTranslations} from 'next-intl';
import type {StepValueFeedback} from '@/lib/life-coach/types';
import {STEP_VALUE_FEEDBACK_OPTIONS} from '@/lib/life-coach/types';

type Props = {
  onSelect: (feedback: StepValueFeedback) => Promise<void>;
  onDismiss: () => void;
};

const OPTION_KEYS: Record<StepValueFeedback, string> = {
  felt_progress: 'lifeCoach.valueFeedback.feltProgress',
  too_small: 'lifeCoach.valueFeedback.tooSmall',
  too_generic: 'lifeCoach.valueFeedback.tooGeneric',
  missed_problem: 'lifeCoach.valueFeedback.missedProblem',
};

export function StepValueFeedbackPrompt({onSelect, onDismiss}: Props) {
  const t = useTranslations();

  return (
    <div className="mt-4 rounded-xl border border-[var(--blue)]/25 bg-[rgba(26,109,255,0.08)] p-4" role="group" aria-labelledby="step-value-feedback-q">
      <p id="step-value-feedback-q" className="text-sm font-semibold txt-strong">{t('lifeCoach.valueFeedback.question')}</p>
      <div className="mt-3 grid gap-2">
        {STEP_VALUE_FEEDBACK_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className="focus-ring rounded-xl border border-[color:var(--color-border)] fill-1 px-4 py-2.5 text-start text-xs font-semibold txt-strong transition hover:border-[var(--blue)]/40 hover:txt-strong"
            onClick={() => void onSelect(option)}
          >
            {t(OPTION_KEYS[option])}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="focus-ring mt-3 text-xs txt-muted hover:txt-soft"
        onClick={onDismiss}
      >
        {t('lifeCoach.valueFeedback.skip')}
      </button>
    </div>
  );
}
