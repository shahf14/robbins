'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';

type Props = {
  selectedBlocker: string;
  onDeepDiveComplete: (answer: string, optimalTime?: string, availableMinutes?: number) => void;
};

type DeepDiveConfig = {
  question: string;
  followUpType: 'time_of_day' | 'available_minutes' | 'text';
  suggestions?: string[];
};

export function BlockerDeepDive({selectedBlocker, onDeepDiveComplete}: Props) {
  const t = useTranslations();
  const [answer, setAnswer] = useState('');
  const [optimalTime, setOptimalTime] = useState('');
  const [availableMinutes, setAvailableMinutes] = useState(5);

  const config = getDeepDiveConfig(selectedBlocker, t);

  if (!config) return null;

  return (
    <div className="mt-3 rounded-xl border border-[var(--blue)]/15 bg-[rgba(26,109,255,0.04)] p-4">
      <p id="blocker-deep-dive-question" className="text-sm font-semibold txt-strong">{config.question}</p>

      {config.followUpType === 'time_of_day' && (
        <div className="mt-3 grid gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="blocker-deep-dive-question">
            {(config.suggestions ?? []).map((suggestion) => (
              <button
                key={suggestion}
                type="button"
                aria-pressed={answer === suggestion}
                className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  answer === suggestion
                    ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                    : 'border-[color:var(--color-border)] fill-1 txt-soft'
                }`}
                onClick={() => setAnswer(suggestion)}
              >
                {suggestion}
              </button>
            ))}
          </div>
          <label className="grid gap-2">
            <span className="text-xs txt-muted">{t('blockerDeepDive.optimalTime')}</span>
            <input
              className="focus-ring input-base"
              type="time"
              value={optimalTime}
              onChange={(e) => setOptimalTime(e.target.value)}
            />
          </label>
        </div>
      )}

      {config.followUpType === 'available_minutes' && (
        <div className="mt-3 grid gap-3">
          <div className="flex flex-wrap gap-2" role="group" aria-labelledby="blocker-deep-dive-question">
            {[2, 5, 10, 15].map((minutes) => (
              <button
                key={minutes}
                type="button"
                aria-pressed={availableMinutes === minutes}
                className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  availableMinutes === minutes
                    ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                    : 'border-[color:var(--color-border)] fill-1 txt-soft'
                }`}
                onClick={() => setAvailableMinutes(minutes)}
              >
                {minutes} {t('lifeCoach.minutes')}
              </button>
            ))}
          </div>
          <p className="text-xs leading-5 txt-muted">{t('blockerDeepDive.miniHabitHint')}</p>
        </div>
      )}

      {config.followUpType === 'text' && (
        <textarea
          className="focus-ring textarea-base mt-3 min-h-16"
          value={answer}
          onChange={(e) => setAnswer(e.target.value)}
          placeholder={t('blockerDeepDive.elaboratePlaceholder')}
          aria-label={config.question}
        />
      )}

      <button
        className="focus-ring btn-small mt-3"
        type="button"
        onClick={() =>
          onDeepDiveComplete(
            answer || selectedBlocker,
            optimalTime || undefined,
            config.followUpType === 'available_minutes' ? availableMinutes : undefined
          )
        }
      >
        {t('blockerDeepDive.save')}
      </button>
    </div>
  );
}

function getDeepDiveConfig(
  blocker: string,
  t: ReturnType<typeof useTranslations>
): DeepDiveConfig | null {
  switch (blocker) {
    case 'low_energy':
      return {
        question: t('blockerDeepDive.lowEnergy.question'),
        followUpType: 'time_of_day',
        suggestions: [
          t('blockerDeepDive.lowEnergy.morning'),
          t('blockerDeepDive.lowEnergy.afternoon'),
          t('blockerDeepDive.lowEnergy.evening'),
          t('blockerDeepDive.lowEnergy.afterLunch'),
        ],
      };
    case 'no_time':
      return {
        question: t('blockerDeepDive.noTime.question'),
        followUpType: 'available_minutes',
      };
    case 'self_doubt':
      return {
        question: t('blockerDeepDive.selfDoubt.question'),
        followUpType: 'text',
      };
    case 'kids':
    case 'family_chaos':
      return {
        question: t('blockerDeepDive.familyChaos.question'),
        followUpType: 'time_of_day',
        suggestions: [
          t('blockerDeepDive.familyChaos.earlyMorning'),
          t('blockerDeepDive.familyChaos.napTime'),
          t('blockerDeepDive.familyChaos.afterBedtime'),
          t('blockerDeepDive.familyChaos.lunchBreak'),
        ],
      };
    case 'consistency':
      return {
        question: t('blockerDeepDive.consistency.question'),
        followUpType: 'text',
      };
    case 'lack_of_clarity':
      return {
        question: t('blockerDeepDive.lackOfClarity.question'),
        followUpType: 'text',
      };
    default:
      return {
        question: t('blockerDeepDive.generic.question'),
        followUpType: 'text',
      };
  }
}
