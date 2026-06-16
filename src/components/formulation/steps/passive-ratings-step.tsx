'use client';

import {useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {
  getGuidedQuestionBody,
  type GuidedQuestionEntry,
} from '@/lib/formulation/guided-questions';
import type {PassiveRatingItem} from '@/lib/formulation/passive-ratings';

const QUESTIONS_PER_PAGE = 5;

function getRatingLabel(value: number, minLabel: string, maxLabel: string): string {
  if (value === 1) return `${value} – ${minLabel}`;
  if (value === 5) return `${value} – ${maxLabel}`;
  return String(value);
}

type Props = {
  loading: boolean;
  questions: GuidedQuestionEntry[];
  initialRatings?: PassiveRatingItem[];
  onDraftChange?: (ratings: PassiveRatingItem[]) => void;
  onSubmit: (ratings: PassiveRatingItem[]) => void;
};

export function PassiveRatingsStep({
  loading,
  questions,
  initialRatings,
  onDraftChange,
  onSubmit,
}: Props) {
  const t = useTranslations('formulation');
  const locale = useLocale() as AppLocale;
  const questionIds = useMemo(() => questions.map((q) => q.id), [questions]);

  const [page, setPage] = useState(0);
  const [scores, setScores] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    const allowed = new Set(questionIds);
    for (const item of initialRatings ?? []) {
      if (allowed.has(item.key)) {
        map[item.key] = item.score;
      }
    }
    return map;
  });

  const pages = useMemo(() => {
    const chunks: string[][] = [];
    for (let i = 0; i < questionIds.length; i += QUESTIONS_PER_PAGE) {
      chunks.push(questionIds.slice(i, i + QUESTIONS_PER_PAGE));
    }
    return chunks;
  }, [questionIds]);

  const currentPageIds = pages[page] ?? [];
  const currentQuestions = currentPageIds
    .map((id) => questions.find((q) => q.id === id))
    .filter((q): q is GuidedQuestionEntry => q != null);

  const pageComplete = currentPageIds.every((id) => scores[id] != null);
  const allComplete = questionIds.every((id) => scores[id] != null);
  const isLastPage = page >= pages.length - 1;

  function setScore(id: string, value: number) {
    setScores((prev) => ({...prev, [id]: value}));
  }

  useEffect(() => {
    const items = questionIds
      .filter((id) => scores[id] != null)
      .map((id) => ({key: id, score: scores[id]!}));
    onDraftChange?.(items);
  }, [scores, questionIds, onDraftChange]);

  if (questions.length === 0) {
    return (
      <p className="text-sm text-red-300" role="alert">{t('passiveRatings.empty')}</p>
    );
  }

  return (
    <div className="grid gap-6">
      <p className="text-sm leading-7 text-[var(--muted)]">
        {t('passiveRatings.intro')}
      </p>
      <p className="text-xs text-white/45" aria-live="polite" aria-atomic="true">
        {t('passiveRatings.questionCount', {count: questions.length})}
        {' · '}
        {t('passiveRatings.pageProgress', {current: page + 1, total: pages.length})}
      </p>

      <div className="grid gap-5">
        {currentQuestions.map((q) => (
          <div key={q.id} className="rounded-xl border border-white/10 bg-white/3 p-4">
            <p className="text-sm font-semibold text-white">{getGuidedQuestionBody(q, locale)}</p>
            <div className="mt-3 grid grid-cols-5 gap-1.5">
              {[1, 2, 3, 4, 5].map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={scores[q.id] === value}
                  aria-label={getRatingLabel(value, t('passiveRatings.scaleMin'), t('passiveRatings.scaleMax'))}
                  className={`focus-ring flex flex-col items-center rounded-lg border py-2 text-center transition ${
                    scores[q.id] === value
                      ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.2)] text-white'
                      : 'border-white/10 bg-white/2 text-white/55 hover:border-white/20'
                  }`}
                  onClick={() => setScore(q.id, value)}
                >
                  <span className="text-sm font-bold" aria-hidden="true">{value}</span>
                  {value === 1 && (
                    <span className="mt-1 text-[10px] leading-tight text-white/45" aria-hidden="true">
                      {t('passiveRatings.scaleMin')}
                    </span>
                  )}
                  {value === 5 && (
                    <span className="mt-1 text-[10px] leading-tight text-white/45" aria-hidden="true">
                      {t('passiveRatings.scaleMax')}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        {page > 0 && (
          <button
            className="focus-ring btn-ghost"
            type="button"
            disabled={loading}
            aria-busy={loading}
            onClick={() => setPage((p) => p - 1)}
          >
            {t('back')}
          </button>
        )}
        {!isLastPage && (
          <button
            className="focus-ring btn-primary"
            type="button"
            disabled={loading || !pageComplete}
            aria-busy={loading}
            onClick={() => setPage((p) => p + 1)}
          >
            {t('next')}
          </button>
        )}
        {isLastPage && (
          <button
            className="focus-ring btn-primary"
            type="button"
            disabled={loading || !allComplete}
            aria-busy={loading}
            onClick={() =>
              onSubmit(
                questionIds.map((id) => ({
                  key: id,
                  score: scores[id]!,
                }))
              )
            }
          >
            {loading ? t('saving') : t('save')}
          </button>
        )}
      </div>
    </div>
  );
}
