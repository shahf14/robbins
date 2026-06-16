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
      <p id="step-value-feedback-q" className="text-sm font-semibold text-white">{t('lifeCoach.valueFeedback.question')}</p>
      <div className="mt-3 grid gap-2">
        {STEP_VALUE_FEEDBACK_OPTIONS.map((option) => (
          <button
            key={option}
            type="button"
            className="focus-ring rounded-xl border border-white/10 bg-white/4 px-4 py-2.5 text-start text-xs font-semibold text-white/80 transition hover:border-[var(--blue)]/40 hover:text-white"
            onClick={() => void onSelect(option)}
          >
            {t(OPTION_KEYS[option])}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="focus-ring mt-3 text-xs text-white/40 hover:text-white/70"
        onClick={onDismiss}
      >
        {t('lifeCoach.valueFeedback.skip')}
      </button>
    </div>
  );
}
