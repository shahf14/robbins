'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import type {AccountabilityContext} from '@/lib/formulation/accountability-routing';

type Answers = {
  committed: string;
  happened: string;
  changeNext: string;
};

type Props = {
  onComplete: (answers: Answers) => void;
  accountability?: AccountabilityContext | null;
};

export function WeeklyAccountabilityCheckin({onComplete, accountability = null}: Props) {
  const t = useTranslations('behaviorScience.weeklyCheckin');
  const [answers, setAnswers] = useState<Answers>({committed: '', happened: '', changeNext: ''});
  const [done, setDone] = useState(false);

  const labels: Record<keyof Answers, string> = {
    committed: accountability?.weekly_review_proximity ?? t('committed'),
    happened: t('happened'),
    changeNext: t('changeNext'),
  };

  const placeholders: Record<keyof Answers, string> = {
    committed: accountability
      ? t('committedProximityPlaceholder')
      : t('committedPlaceholder'),
    happened: t('happenedPlaceholder'),
    changeNext: t('changeNextPlaceholder'),
  };

  if (done) return null;

  return (
    <div className="mb-5 rounded-xl border border-[var(--blue)]/20 bg-[var(--blue)]/6 p-4">
      <p className="text-xs font-bold uppercase tracking-wide text-[var(--blue)]/80">{t('title')}</p>
      {(['committed', 'happened', 'changeNext'] as const).map((key) => (
        <label key={key} className="mt-3 block">
          <span className="text-xs font-semibold txt-soft">{labels[key]}</span>
          <textarea
            className="focus-ring textarea-base mt-1 min-h-16 text-sm"
            value={answers[key]}
            onChange={(e) => setAnswers((prev) => ({...prev, [key]: e.target.value}))}
            placeholder={placeholders[key]}
          />
        </label>
      ))}
      <button
        type="button"
        className="focus-ring btn-small mt-4"
        onClick={() => {
          setDone(true);
          onComplete(answers);
        }}
      >
        {t('continue')}
      </button>
    </div>
  );
}
