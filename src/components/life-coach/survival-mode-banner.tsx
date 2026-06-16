'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {survivalModeCopyKeys, survivalModeSoftCopyKeys} from '@/lib/life-context-content';
import {hasStoredPlanB, planBPreviewLine} from '@/lib/life-coach/plan-b';
import type {AppLocale} from '@/i18n/config';
import type {DailyBabyStep} from '@/lib/life-coach/types';
import type {LifeContextStatus} from '@/lib/life-coach/types';
import type {ReflectionBlockerReason} from '@/lib/life-coach/types';

type Option = 'easy' | 'skip' | 'pause';

type Props = {
  pendingSteps: DailyBabyStep[];
  lifeContexts?: LifeContextStatus[] | null;
  emphasize?: boolean;
  softCopy?: boolean;
  compact?: boolean;
  variant?: 'banner' | 'ghost';
  doneMessages?: {
    easy?: string;
    skip?: string;
    pause?: string;
  };
  onEasyStep: (stepId: string) => Promise<void>;
  onSkipAll: (blocker: ReflectionBlockerReason) => Promise<void>;
  onPauseDay: () => Promise<void>;
};

export function SurvivalModeBanner({
  pendingSteps,
  lifeContexts,
  emphasize = false,
  softCopy = false,
  compact = false,
  variant = 'banner',
  doneMessages,
  onEasyStep,
  onSkipAll,
  onPauseDay,
}: Props) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const copy = softCopy
    ? survivalModeSoftCopyKeys(lifeContexts)
    : survivalModeCopyKeys(lifeContexts);
  const softExtras = softCopy ? (copy as ReturnType<typeof survivalModeSoftCopyKeys>) : null;
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<Option | null>(null);
  const [done, setDone] = useState<Option | null>(null);
  const [busy, setBusy] = useState(false);

  if (pendingSteps.length === 0) return null;

  // The "easy step" is the one with lowest estimated_minutes
  const easyStep = [...pendingSteps].sort((a, b) => a.estimated_minutes - b.estimated_minutes)[0];
  const easyPlanBPreview =
    easyStep && hasStoredPlanB(easyStep) ? planBPreviewLine(easyStep, locale) : null;

  async function handleConfirm() {
    if (!selected || !easyStep) return;
    setBusy(true);
    try {
      if (selected === 'easy') {
        await onEasyStep(easyStep.id);
      } else if (selected === 'skip') {
        await onSkipAll('low_energy');
      } else if (selected === 'pause') {
        await onPauseDay();
      }
      setDone(selected);
      setSelected(null);
    } finally {
      setBusy(false);
    }
  }

  function handleClose() {
    setOpen(false);
    setDone(null);
    setSelected(null);
  }

  return (
    <>
      {variant === 'ghost' ? (
        <button
          type="button"
          className="btn-adapt-ghost"
          onClick={() => setOpen(true)}
        >
          {t('survivalMode.adaptTrigger')}
        </button>
      ) : (
        <button
          type="button"
          className={`focus-ring flex items-center justify-between rounded-2xl border text-left transition ${
            compact
              ? 'min-h-11 px-4 py-2.5'
              : 'w-full px-4 py-3'
          } ${
            emphasize
              ? 'border-amber-400/40 bg-amber-500/12 ring-1 ring-amber-400/25 hover:bg-amber-500/[0.16]'
              : 'border-amber-500/20 bg-amber-500/6 hover:bg-amber-500/10'
          }`}
          onClick={() => setOpen(true)}
        >
          <span className="flex min-w-0 flex-1 flex-col gap-0.5">
            <span className="flex items-center gap-2">
              <span className="text-lg" aria-hidden="true">↓</span>
              <span className="text-sm font-semibold text-amber-300">{t(copy.trigger)}</span>
            </span>
            {!compact && (
              <>
                <span className="ps-7 text-xs leading-5 text-amber-200/70">
                  {t((softExtras?.positiveExplainer ?? 'survivalMode.positiveExplainer') as Parameters<typeof t>[0])}
                </span>
                {easyPlanBPreview && (
                  <span className="ps-7 text-xs leading-5 text-amber-100/60">{easyPlanBPreview}</span>
                )}
              </>
            )}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-amber-400/60" aria-hidden="true">
            <polyline points="9 18 15 12 9 6" />
          </svg>
        </button>
      )}

      {/* Modal */}
      {open && (
        <div className="fixed inset-0 z-[90] flex items-end justify-center bg-black/70 px-4 pb-4 sm:items-center sm:py-8" role="dialog" aria-modal="true" aria-labelledby="survival-mode-title">
          <div className="panel-surface-strong w-full max-w-md rounded-2xl p-6">

            {done ? (
              /* ── Done state ── */
              <div className="text-center">
                <p className="text-4xl" aria-hidden="true">🙏</p>
                <h2 className="mt-4 text-xl font-black text-white">{t('survivalMode.doneTitle')}</h2>
                <p className="mt-3 text-sm leading-6 text-white/65">
                  {done === 'skip' && (doneMessages?.skip ?? t('survivalMode.doneSkip'))}
                  {done === 'pause' && (doneMessages?.pause ?? t('survivalMode.donePause'))}
                  {done === 'easy' && (doneMessages?.easy ?? t('survivalMode.doneEasy'))}
                </p>
                <button
                  type="button"
                  className="focus-ring btn-primary mt-6 w-full"
                  onClick={handleClose}
                >
                  {t('survivalMode.close')}
                </button>
              </div>
            ) : (
              /* ── Selection state ── */
              <>
                <p className="text-xs font-bold uppercase tracking-wide text-amber-300/80">
                  {t('survivalMode.positiveEmergencyLabel')}
                </p>
                <h2 id="survival-mode-title" className="mt-2 text-xl font-black text-white">{t(copy.title)}</h2>
                <p className="mt-2 text-sm leading-6 text-white/55">{t(copy.subtitle)}</p>
                <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-500/8 px-4 py-3 text-sm leading-6 text-amber-100/85">
                  {t((softExtras?.positiveExplainer ?? 'survivalMode.positiveExplainer') as Parameters<typeof t>[0])}
                </p>

                <div className="mt-5 grid gap-3">
                  <OptionCard
                    icon="⚡"
                    label={t('survivalMode.optionEasy')}
                    desc={
                      easyPlanBPreview
                        ? `${t((softExtras?.optionEasyDesc ?? 'survivalMode.optionEasyDesc') as Parameters<typeof t>[0])} · ${easyPlanBPreview}`
                        : t((softExtras?.optionEasyDesc ?? 'survivalMode.optionEasyDesc') as Parameters<typeof t>[0])
                    }
                    selected={selected === 'easy'}
                    onSelect={() => setSelected('easy')}
                  />
                  <OptionCard
                    icon="💬"
                    label={t('survivalMode.optionSkip')}
                    desc={t((softExtras?.optionSkipDesc ?? 'survivalMode.optionSkipDesc') as Parameters<typeof t>[0])}
                    selected={selected === 'skip'}
                    onSelect={() => setSelected('skip')}
                  />
                  <OptionCard
                    icon="🛌"
                    label={t('survivalMode.optionPause')}
                    desc={t('survivalMode.optionPauseDesc')}
                    selected={selected === 'pause'}
                    onSelect={() => setSelected('pause')}
                  />
                </div>

                <div className="mt-6 flex gap-3">
                  <button
                    type="button"
                    className="focus-ring btn-ghost flex-1"
                    onClick={handleClose}
                    disabled={busy}
                  >
                    {t('survivalMode.cancel')}
                  </button>
                  <button
                    type="button"
                    className="focus-ring btn-primary flex-1 disabled:opacity-40"
                    disabled={!selected || busy}
                    aria-busy={busy}
                    onClick={handleConfirm}
                  >
                    {busy ? '…' : t('survivalMode.confirm')}
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function OptionCard({icon, label, desc, selected, onSelect}: {
  icon: string;
  label: string;
  desc: string;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      className={`focus-ring w-full rounded-2xl border p-4 text-left transition ${
        selected
          ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.10)]'
          : 'border-white/10 bg-white/2 hover:bg-white/4'
      }`}
      aria-pressed={selected}
      onClick={onSelect}
    >
      <div className="flex items-start gap-3">
        <span className="text-xl leading-none" aria-hidden="true">{icon}</span>
        <div>
          <p className="text-sm font-semibold text-white">{label}</p>
          <p className="mt-1 text-xs leading-5 text-white/50">{desc}</p>
        </div>
        {selected && (
          <span className="ml-auto shrink-0 mt-0.5">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-[var(--blue)]" aria-hidden="true">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </span>
        )}
      </div>
    </button>
  );
}
