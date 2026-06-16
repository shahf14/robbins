'use client';

import {useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import type {RatingFollowUp} from '@/lib/formulation/passive-ratings';

type Props = {
  loading: boolean;
  followUps: RatingFollowUp[];
  onDraftChange?: (answers: Array<{key: string; answer: string}>) => void;
  onSubmit: (answers: Array<{key: string; answer: string}>) => void;
  onSkipAll: () => void;
};

const CHIP_OPTIONS = ['not_at_all', 'a_little', 'moderate', 'a_lot', 'not_sure'] as const;
type ChipOption = (typeof CHIP_OPTIONS)[number];

export function FollowUpStep({loading, followUps, onDraftChange, onSubmit, onSkipAll}: Props) {
  const t = useTranslations('formulation');
  const [answers, setAnswers] = useState<Record<string, ChipOption>>({});
  const [clarifications, setClarifications] = useState<Record<string, string>>({});

  const complete = useMemo(
    () => followUps.every((f) => answers[f.key] != null),
    [followUps, answers]
  );

  useEffect(() => {
    onDraftChange?.(
      followUps
        .filter((f) => answers[f.key])
        .map((f) => ({
          key: f.key,
          answer: answers[f.key]!,
          ...(clarifications[f.key] ? {clarification: clarifications[f.key]} : {}),
        }))
    );
  }, [answers, clarifications, followUps, onDraftChange, t]);

  if (followUps.length === 0) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-[var(--muted)]">{t('followUps.none')}</p>
        <button className="focus-ring btn-primary" type="button" disabled={loading} aria-busy={loading} onClick={onSkipAll}>
          {loading ? t('saving') : t('next')}
        </button>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <p className="text-sm leading-7 text-[var(--muted)]">{t('followUps.intro')}</p>

      {followUps.map((f) => (
        <div
          key={f.key}
          role="group"
          aria-labelledby={`followup-q-${f.key}`}
          className="rounded-xl border border-[var(--blue)]/20 bg-[rgba(26,109,255,0.06)] p-4"
        >
          <p id={`followup-q-${f.key}`} className="text-sm font-semibold text-white">{t(f.questionKey)}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {CHIP_OPTIONS.map((chip) => {
              const selected = answers[f.key] === chip;
              return (
                <button
                  key={chip}
                  type="button"
                  aria-pressed={selected}
                  className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    selected
                      ? 'border-[var(--blue)] bg-[var(--blue)] text-white shadow-[0_0_0_1px_rgba(26,109,255,0.4)]'
                      : 'border-white/15 bg-white/4 text-white/60 hover:border-white/30 hover:text-white/80'
                  }`}
                  onClick={() =>
                    setAnswers((prev) => ({
                      ...prev,
                      [f.key]: chip,
                    }))
                  }
                >
                  {t(`followUps.chips.${chip}`)}
                </button>
              );
            })}
          </div>
          {answers[f.key] === 'a_lot' && (
            <input
              type="text"
              placeholder={t('followUps.clarificationPlaceholder')}
              aria-label={t('followUps.clarificationPlaceholder')}
              value={clarifications[f.key] ?? ''}
              onChange={(e) =>
                setClarifications((prev) => ({...prev, [f.key]: e.target.value}))
              }
              className="focus-ring mt-3 w-full rounded-lg border border-white/15 bg-white/4 px-3 py-2 text-sm text-white placeholder:text-white/30"
              maxLength={200}
            />
          )}
        </div>
      ))}

      <div className="flex flex-wrap gap-2">
        <button
          className="focus-ring btn-primary"
          type="button"
          disabled={loading || !complete}
          aria-busy={loading}
          onClick={() =>
            onSubmit(
              followUps.map((f) => {
                const chip = answers[f.key];
                return {
                  key: f.key,
                  answer: chip ?? '',
                  ...(clarifications[f.key] ? {clarification: clarifications[f.key]} : {}),
                };
              })
            )
          }
        >
          {loading ? t('saving') : t('save')}
        </button>
        <button className="focus-ring btn-ghost text-xs" type="button" disabled={loading} aria-busy={loading} onClick={onSkipAll}>
          {t('followUps.skipAll')}
        </button>
      </div>
    </div>
  );
}
