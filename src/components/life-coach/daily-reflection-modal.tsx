'use client';

import {useEffect, useRef, useState} from 'react';
import {useTranslations, useLocale} from 'next-intl';
import {REFLECTION_BLOCKER_REASONS, type ReflectionBlockerReason} from '@/lib/life-coach/types';
import {countWords, detectSelfBlame} from '@/lib/clinical-analysis';
import {reflectionBlockerHintKey} from '@/lib/life-context-content';
import {loadUserPreferences} from '@/lib/user-preferences';
import {SkipCoachLoop} from '@/components/life-coach/shared/skip-coach-loop';
import type {SkipCoachAction} from '@/lib/skip-coach-loop';
import {SelfContractReminder} from '@/components/behavior-science/behavior-panels';
import {useToast} from '@/components/feedback/toast-provider';
import {resolveLifeCoachErrorMessage} from '@/lib/life-coach/api-error';
import type {GoalSelfContract} from '@/lib/behavior-science/self-contract';

type BlockerCategory = 'external' | 'internal' | 'unclear';

type Props = {
  open: boolean;
  /** When provided the modal focuses on blocker capture (skip/partial context) */
  context?: 'skip' | 'reflection';
  skipAction?: 'skipped' | 'partial';
  initialBlocker?: ReflectionBlockerReason | null;
  goalTitle?: string;
  selfContract?: GoalSelfContract | null;
  comebackMessage?: string | null;
  skipCoachIntro?: string | null;
  onClose: () => void;
  onSubmit: (input: {
    mood_score: number | null;
    energy_score: number | null;
    reflection_text: string;
    blocker_reason: ReflectionBlockerReason | null;
    blocker_category: BlockerCategory | null;
    writing_duration_sec: number | null;
    reflection_word_count: number | null;
    self_blame_language: boolean;
    coach_action?: SkipCoachAction | null;
  }) => Promise<void>;
};

export function DailyReflectionModal({
  open,
  context = 'skip',
  skipAction = 'skipped',
  initialBlocker = null,
  goalTitle,
  selfContract = null,
  comebackMessage,
  skipCoachIntro,
  onClose,
  onSubmit,
}: Props) {
  const t = useTranslations();
  const tBs = useTranslations('behaviorScience');
  const locale = useLocale();
  const toast = useToast();
  const [blockerCategory, setBlockerCategory] = useState<BlockerCategory | null>(null);
  const [blockerReason, setBlockerReason] = useState<ReflectionBlockerReason | null>(initialBlocker);
  const [deepDiveAnswer, setDeepDiveAnswer] = useState('');
  const [reflectionText, setReflectionText] = useState('');
  // Only used in full 'reflection' context
  const [moodScore, setMoodScore] = useState(7);
  const [energyScore, setEnergyScore] = useState(6);
  const [saving, setSaving] = useState(false);
  const writingStartRef = useRef<number | null>(null);

  useEffect(() => {
    if (!open) return;
    setBlockerCategory(null);
    setBlockerReason(initialBlocker ?? null);
    setDeepDiveAnswer('');
    setReflectionText('');
    setMoodScore(7);
    setEnergyScore(6);
    setSaving(false);
    writingStartRef.current = null;
  }, [open, initialBlocker]);

  useEffect(() => {
    if (!open) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape' && !saving) onClose();
    }

    document.addEventListener('keydown', onKeyDown);
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [open, onClose, saving]);

  if (!open) return null;

  const lifeContexts = loadUserPreferences().life_context_statuses;
  const blockerHintKey = reflectionBlockerHintKey(lifeContexts);
  const isSkipContext = context === 'skip';
  const sheetTitle = isSkipContext
    ? t(skipAction === 'partial' ? 'lifeCoach.markPartial' : 'lifeCoach.markSkipped')
    : t('lifeCoach.dailyReflectionTitle');

  function handleBackdropClose() {
    if (!saving) onClose();
  }

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:items-center sm:py-8"
      role="dialog"
      aria-modal="true"
      aria-labelledby="daily-reflection-title"
      onClick={handleBackdropClose}
    >
      <div
        className="panel-surface-strong flex max-h-[min(90dvh,44rem)] w-full max-w-lg flex-col overflow-hidden rounded-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-center justify-between gap-4 border-b border-[color:var(--color-border)] px-5 py-3 sm:px-7">
          <h2 id="daily-reflection-title" className="min-w-0 text-base font-black leading-6 txt-strong sm:text-lg">
            {sheetTitle}
          </h2>
          <button
            type="button"
            className="focus-ring inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-[color:var(--color-border)] fill-1 text-xl leading-none txt-strong disabled:cursor-not-allowed disabled:opacity-50"
            aria-label={t('lifeCoach.cancel')}
            disabled={saving}
            onClick={onClose}
          >
            <span aria-hidden="true">&times;</span>
          </button>
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-5 sm:p-7">
        {isSkipContext ? (
          <>
            <p className="text-sm leading-6 text-sky-200/80">
              {comebackMessage ??
                tBs(skipAction === 'partial' ? 'antiShame.partial' : 'antiShame.skip')}
            </p>
            {selfContract && (
              <div className="mt-3 rounded-xl border border-[color:var(--color-border)] fill-1 px-4 py-3">
                <SelfContractReminder contract={selfContract} goalTitle={goalTitle} />
              </div>
            )}
            {blockerHintKey ? (
              <p className="mt-4 rounded-xl border border-[color:var(--color-border)] fill-1 px-4 py-3 text-sm leading-6 txt-soft">
                {t(blockerHintKey)}
              </p>
            ) : null}
            {skipAction === 'skipped' ? (
              <SkipCoachLoop
                blockerReason={blockerReason}
                onBlockerChange={setBlockerReason}
                busy={saving}
                introMessage={skipCoachIntro}
                onSelectAction={async (coach_action) => {
                  setSaving(true);
                  try {
                    await onSubmit({
                      mood_score: null,
                      energy_score: null,
                      reflection_text: deepDiveAnswer || reflectionText,
                      blocker_reason: blockerReason,
                      blocker_category: blockerCategory,
                      writing_duration_sec: null,
                      reflection_word_count: null,
                      self_blame_language: false,
                      coach_action,
                    });
                  } catch (error) {
                    toast.error(resolveLifeCoachErrorMessage(error, t));
                  } finally {
                    setSaving(false);
                  }
                }}
              />
            ) : (
              <div className="mt-5" role="group" aria-labelledby="blocker-reason-label-partial">
                <p id="blocker-reason-label-partial" className="field-label mb-2">{t('lifeCoach.blockerReason')}</p>
                <div className="flex flex-wrap gap-2">
                  {REFLECTION_BLOCKER_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      aria-pressed={blockerReason === reason}
                      className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        blockerReason === reason
                          ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                          : 'border-[color:var(--color-border)] fill-1 txt-soft hover:border-[color:var(--color-border-strong)] hover:txt-strong'
                      }`}
                      onClick={() => setBlockerReason((prev) => prev === reason ? null : reason)}
                    >
                      {t(`lifeCoach.blockers.${reason}`)}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </>
        ) : (
          /* ── Full daily reflection context ── */
          <>
            <p className="eyebrow">{t('lifeCoach.dailyReflection')}</p>

            <div className="mt-5 grid gap-4">
              <RangeInput label={t('lifeCoach.moodScore')}   value={moodScore}   onChange={setMoodScore}   tierLabel={getMoodTierLabel(moodScore, t)} />
              <RangeInput label={t('lifeCoach.energyScore')} value={energyScore} onChange={setEnergyScore} tierLabel={getEnergyTierLabel(energyScore, t)} />

              <div role="group" aria-labelledby="blocker-reason-label-full">
                <p id="blocker-reason-label-full" className="field-label mb-2">{t('lifeCoach.blockerReason')}</p>
                <div className="flex flex-wrap gap-2">
                  {REFLECTION_BLOCKER_REASONS.map((reason) => (
                    <button
                      key={reason}
                      type="button"
                      aria-pressed={blockerReason === reason}
                      className={`focus-ring rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                        blockerReason === reason
                          ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                          : 'border-[color:var(--color-border)] fill-1 txt-soft hover:border-[color:var(--color-border-strong)] hover:txt-strong'
                      }`}
                      onClick={() => setBlockerReason((prev) => prev === reason ? null : reason)}
                    >
                      {t(`lifeCoach.blockers.${reason}`)}
                    </button>
                  ))}
                </div>
              </div>

              <label className="grid gap-2">
                <span className="field-label mb-0">{t('lifeCoach.reflection')}</span>
                <textarea
                  className="focus-ring textarea-base min-h-28"
                  value={reflectionText}
                  onChange={(event) => {
                    if (!writingStartRef.current && event.target.value.length > 0) {
                      writingStartRef.current = Date.now();
                    }
                    setReflectionText(event.target.value);
                  }}
                  placeholder={t('lifeCoach.reflectionPlaceholder')}
                />
              </label>
            </div>
          </>
        )}

        {!(isSkipContext && skipAction === 'skipped') && (
          <div className="mt-5 flex flex-wrap gap-3">
            <button
              className="focus-ring btn-primary"
              type="button"
              disabled={saving}
              aria-busy={saving}
              onClick={async () => {
                setSaving(true);
                try {
                  const writingDurationSec = writingStartRef.current
                    ? Math.round((Date.now() - writingStartRef.current) / 1000)
                    : null;
                  const finalText = [reflectionText, deepDiveAnswer].filter(Boolean).join('\n').trim();
                  const collectBehavioralAnalytics = loadUserPreferences().behavioral_analytics_enabled;
                  await onSubmit({
                    mood_score: isSkipContext ? null : moodScore,
                    energy_score: isSkipContext ? null : energyScore,
                    reflection_text: finalText,
                    blocker_reason: blockerReason,
                    blocker_category: blockerCategory,
                    writing_duration_sec: collectBehavioralAnalytics ? writingDurationSec : null,
                    reflection_word_count: collectBehavioralAnalytics && finalText ? countWords(finalText) : null,
                    self_blame_language: collectBehavioralAnalytics && finalText ? detectSelfBlame(finalText, locale) : false,
                  });
                } catch (error) {
                  toast.error(resolveLifeCoachErrorMessage(error, t));
                } finally {
                  setSaving(false);
                }
              }}
            >
              {saving ? t('lifeCoach.saving') : t('lifeCoach.saveReflection')}
            </button>
            <button className="focus-ring btn-ghost" type="button" disabled={saving} onClick={onClose}>
              {t('lifeCoach.cancel')}
            </button>
          </div>
        )}
        {isSkipContext && skipAction === 'skipped' && (
          <div className="mt-4">
            <button className="focus-ring btn-ghost text-sm" type="button" disabled={saving} onClick={onClose}>
              {t('lifeCoach.cancel')}
            </button>
          </div>
        )}
        </div>
      </div>
    </div>
  );
}

function getTierLabel(value: number, tiers: [string, string, string, string, string]): string {
  if (value <= 2) return tiers[0];
  if (value <= 4) return tiers[1];
  if (value <= 6) return tiers[2];
  if (value <= 8) return tiers[3];
  return tiers[4];
}

function getMoodTierLabel(value: number, t: ReturnType<typeof useTranslations>): string {
  return getTierLabel(value, [
    t('lifeCoach.moodTier1'), t('lifeCoach.moodTier2'), t('lifeCoach.moodTier3'),
    t('lifeCoach.moodTier4'), t('lifeCoach.moodTier5'),
  ]);
}

function getEnergyTierLabel(value: number, t: ReturnType<typeof useTranslations>): string {
  return getTierLabel(value, [
    t('lifeCoach.energyTier1'), t('lifeCoach.energyTier2'), t('lifeCoach.energyTier3'),
    t('lifeCoach.energyTier4'), t('lifeCoach.energyTier5'),
  ]);
}

function RangeInput({label, value, onChange, tierLabel}: {label: string; value: number; onChange: (v: number) => void; tierLabel?: string}) {
  const badgeClass =
    value <= 3 ? 'border-red-500/30 bg-red-500/10 text-red-300'
    : value <= 5 ? 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
    : value <= 7 ? 'border-blue-500/30 bg-blue-500/10 text-blue-300'
    : 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';

  return (
    <label className="grid gap-2">
      <span className="flex items-center justify-between gap-4">
        <span className="field-label mb-0">{label}</span>
        <span className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${badgeClass}`}>
          {tierLabel && <span className="opacity-80">{tierLabel}</span>}
          <span>{value}/10</span>
        </span>
      </span>
      <input className="focus-ring" type="range" min="1" max="10" value={value}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuetext={tierLabel ? `${value}/10 – ${tierLabel}` : `${value}/10`}
        onChange={(e) => onChange(e.target.valueAsNumber)} />
    </label>
  );
}
