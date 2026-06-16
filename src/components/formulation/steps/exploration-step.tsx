'use client';

import {useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {AiActionHelpMicrocopy} from '@/components/feedback/ai-action-help-microcopy';
import {isFallbackExplorationBundle} from '@/lib/formulation/exploration-question-source';
import type {AppLocale} from '@/i18n/config';
import type {FormulationSession, LlmExplorationAnswer, LlmExplorationQuestion} from '@/lib/life-coach/types';

const QUESTIONS_PER_PAGE = 5;

function getRatingLabel(value: number, minLabel: string, maxLabel: string): string {
  if (value === 1) return `${value} – ${minLabel}`;
  if (value === 5) return `${value} – ${maxLabel}`;
  return String(value);
}

type Props = {
  loading: boolean;
  session: FormulationSession;
  locale: AppLocale;
  questions: LlmExplorationQuestion[];
  initialAnswers?: LlmExplorationAnswer[];
  generating: boolean;
  loadError?: string | null;
  onLoadQuestions: () => Promise<LlmExplorationQuestion[] | null>;
  onDraftChange?: (answers: LlmExplorationAnswer[]) => void;
  onSubmit: (answers: LlmExplorationAnswer[]) => void;
};

export function ExplorationStep({
  loading,
  session,
  locale,
  questions,
  initialAnswers,
  generating,
  loadError,
  onLoadQuestions,
  onDraftChange,
  onSubmit,
}: Props) {
  const t = useTranslations('formulation');
  const hasRealQuestions =
    questions.length === 15 &&
    !isFallbackExplorationBundle(questions, session, locale);
  const [loadStarted, setLoadStarted] = useState(hasRealQuestions);
  const [page, setPage] = useState(0);

  const activeQuestions = useMemo(() => questions.length === 15 ? questions : [], [questions]);
  const questionIds = useMemo(() => activeQuestions.map((q) => q.id), [activeQuestions]);

  const [scores, setScores] = useState<Record<string, number>>(() => {
    const map: Record<string, number> = {};
    const allowed = new Set(questionIds);
    for (const item of initialAnswers ?? []) {
      if (allowed.has(item.key) && item.score >= 1 && item.score <= 5) {
        map[item.key] = item.score;
      }
    }
    return map;
  });

  useEffect(() => {
    const ready =
      questions.length === 15 &&
      !isFallbackExplorationBundle(questions, session, locale);
    if (ready || loadStarted) return;
    const timeout = window.setTimeout(() => {
      setLoadStarted(true);
      void onLoadQuestions();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [questions, session, locale, loadStarted, onLoadQuestions]);

  const pages = useMemo(() => {
    const chunks: string[][] = [];
    for (let i = 0; i < questionIds.length; i += QUESTIONS_PER_PAGE) {
      chunks.push(questionIds.slice(i, i + QUESTIONS_PER_PAGE));
    }
    return chunks;
  }, [questionIds]);

  const currentPageIds = pages[page] ?? [];
  const currentQuestions = currentPageIds
    .map((id) => activeQuestions.find((q) => q.id === id))
    .filter((q): q is LlmExplorationQuestion => q != null);

  const pageComplete = currentPageIds.every((id) => scores[id] != null);
  const allComplete = questionIds.every((id) => scores[id] != null);
  const isLastPage = page >= pages.length - 1;

  const answerList = useMemo(
    () =>
      questionIds
        .filter((id) => scores[id] != null)
        .map((id) => ({key: id, score: scores[id]!})),
    [scores, questionIds]
  );

  useEffect(() => {
    onDraftChange?.(answerList);
  }, [answerList, onDraftChange]);

  function setScore(id: string, value: number) {
    setScores((prev) => ({...prev, [id]: value}));
  }

  if (generating) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-white/70">{t('exploration.generating')}</p>
        <p className="text-xs text-white/45">{t('exploration.generatingHint')}</p>
      </div>
    );
  }

  if (activeQuestions.length === 0 && loadStarted) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-red-300" role="alert">{loadError ?? t('exploration.loadFailed')}</p>
        <button
          className="focus-ring btn-primary"
          type="button"
          onClick={() => {
            setLoadStarted(false);
            void onLoadQuestions();
          }}
        >
          {t('exploration.retry')}
        </button>
      </div>
    );
  }

  if (activeQuestions.length === 0) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-white/70">{t('exploration.generating')}</p>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <p className="text-sm leading-7 text-[var(--muted)]">{t('exploration.intro')}</p>
      <AiActionHelpMicrocopy kind="formulationQuestions" />
      {isFallbackExplorationBundle(questions, session, locale) && (
        <p className="text-xs text-amber-200/90">
          {t('exploration.fallbackNotice')}{' '}
          <button
            type="button"
            className="underline hover:text-amber-100"
            disabled={generating || loading}
            aria-busy={generating || loading}
            onClick={() => {
              setLoadStarted(false);
              void onLoadQuestions();
            }}
          >
            {t('exploration.retry')}
          </button>
        </p>
      )}
      <p className="text-xs text-white/45" aria-live="polite" aria-atomic="true">
        {t('exploration.questionCount', {count: activeQuestions.length})}
        {' · '}
        {t('exploration.pageProgress', {current: page + 1, total: pages.length})}
      </p>

      <div className="grid gap-5">
        {currentQuestions.map((q) => (
          <div key={q.id} className="rounded-xl border border-white/10 bg-white/3 p-4">
            <p className="text-sm font-semibold leading-relaxed text-white">{q.text}</p>
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
