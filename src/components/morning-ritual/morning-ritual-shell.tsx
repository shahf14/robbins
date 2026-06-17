'use client';

import {useState} from 'react';
import {useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import type {LifeContextStatus} from '@/lib/life-coach/types';
import type {
  MorningRitualSession,
  RitualMode,
} from '@/lib/morning-ritual-types';
import {STEPS_BY_MODE, formatMorningModeMinutes} from '@/lib/morning-ritual-types';
import type {
  MorningRitualTone,
  MorningRitualYesterdayContext,
} from '@/lib/morning-ritual/yesterday-context';
import {
  dailyFocusHintKey,
  dailyFocusHintParams,
  type MorningRitualGoalContext,
} from '@/lib/morning-ritual/goal-context';
import {suggestedMorningRitualModeKey} from '@/lib/life-context-content';

export function ProgressBar({current, total}: {current: number; total: number}) {
  const t = useTranslations('morningRitual');
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;

  return (
    <div className="mb-6">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.15em] text-[var(--muted)]">
        <span>{t('common.step', {current: current + 1, total: total + 1})}</span>
        <span>{pct}%</span>
      </div>
      <div className="mt-3 h-1 overflow-hidden rounded-full fill-3">
        <div
          className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
          style={{width: `${pct}%`}}
        />
      </div>
    </div>
  );
}

export function GoalFocusBanner({
  goalContext,
  locale,
}: {
  goalContext: MorningRitualGoalContext;
  locale: AppLocale;
}) {
  const t = useTranslations('morningRitual');
  const hintKey = dailyFocusHintKey(goalContext);
  if (!hintKey) return null;

  return (
    <div className="mt-4 rounded-xl border border-[var(--blue)]/25 bg-[rgba(26,109,255,0.08)] px-4 py-3 text-start">
      <p className="text-xs font-bold uppercase tracking-wide txt-muted">
        {t('goalFocus.eyebrow')}
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug txt-strong">
        {t(`${hintKey}.title` as Parameters<typeof t>[0])}
      </p>
      <p className="mt-2 text-xs leading-relaxed txt-soft">
        {t(`${hintKey}.body` as Parameters<typeof t>[0], dailyFocusHintParams(goalContext, locale))}
      </p>
    </div>
  );
}

export function StartScreen({
  streak,
  completedCount,
  lastSession,
  goalContext,
  locale,
  onSelectMode,
  onAdvancedStart,
}: {
  streak: number;
  completedCount: number;
  lastSession: MorningRitualSession | undefined;
  yesterdayContext: MorningRitualYesterdayContext | null;
  goalContext: MorningRitualGoalContext | null;
  effectiveTone: MorningRitualTone;
  locale: AppLocale;
  onSelectMode: (mode: RitualMode) => void;
  onAdvancedStart: () => void;
}) {
  const t = useTranslations('morningRitual');

  const standardSteps = [
    {label: t('start.previewBreathing')},
    {label: t('start.previewGratitude')},
    {label: t('start.previewAffirmation')},
    {label: t('start.previewMission')},
  ];

  return (
    <div className="mx-auto max-w-5xl">
      <div className="hero-surface overflow-hidden px-6 py-8 text-center sm:px-10 sm:py-12">
        <p className="eyebrow">{t('start.eyebrow')}</p>
        <h1 className="mt-5 text-[clamp(2.4rem,6vw,5rem)] font-black leading-[1.04]">
          {t('start.title')}
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg leading-8 text-[var(--muted)]">{t('start.subtitle')}</p>

        {goalContext ? <GoalFocusBanner goalContext={goalContext} locale={locale} /> : null}

        <div className="mx-auto mt-8 grid max-w-3xl gap-3 sm:grid-cols-3">
          {(['quick', 'standard', 'deep'] as RitualMode[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelectMode(key)}
              className="focus-ring group rounded-xl border border-white/10 bg-white/4 px-4 py-4 text-start transition hover:border-[var(--blue)]/50 hover:bg-[var(--blue)]/6"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold text-white">{t(`mode.${key}`)}</p>
                <span className="shrink-0 rounded-full border border-white/15 bg-black/25 px-2.5 py-0.5 text-xs font-bold text-white/85">
                  ~{formatMorningModeMinutes(key)} {t('mode.minutes')}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-semibold text-white/38">
                {t('mode.stepCount', {count: STEPS_BY_MODE[key].length - 1})}
              </p>
              <p className="mt-2 text-xs leading-5 text-white/55">
                <span className="font-semibold text-white/65">{t('mode.bestForLabel')}: </span>
                {t(`mode.${key}BestFor`)}
              </p>
              <p className="mt-3 text-xs font-bold text-[var(--blue)]/70 transition group-hover:text-[var(--blue)]">
                {t('start.startMode')} →
              </p>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="focus-ring btn-ghost mt-4 text-sm"
          onClick={onAdvancedStart}
        >
          {t('start.advancedOptions')}
        </button>

        <div className="mt-8 grid gap-4 sm:grid-cols-2 md:grid-cols-4">
          <StatBadge label={t('start.streak')} value={String(streak)} />
          <StatBadge label={t('start.completed')} value={String(completedCount)} />
          {lastSession?.dailyMission && (
            <div className="panel-surface col-span-2 p-5 text-start">
              <p className="field-label mb-0 txt-muted">{t('start.lastMission')}</p>
              <p className="mt-3 text-base leading-7 txt-strong">{lastSession.dailyMission}</p>
            </div>
          )}
        </div>
      </div>

      {completedCount === 0 && (
        <div className="mt-6 panel-surface p-6 sm:p-8">
          <p className="field-label mb-0 txt-muted">{t('start.previewTitle')}</p>
          <div className="mt-5 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
            {standardSteps.map((step, i) => (
              <div
                key={step.label}
                className="flex items-center gap-3 rounded-2xl border border-[color:var(--color-border)] fill-1 px-4 py-3"
              >
                <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--blue)]/12 text-sm font-bold text-[var(--blue)]">
                  {i + 1}
                </span>
                <div className="text-start">
                  <span className="block text-sm font-semibold txt-strong">{step.label}</span>
                </div>
              </div>
            ))}
          </div>
          <p className="mt-5 text-sm leading-7 text-[var(--muted)]">{t('start.previewBody')}</p>
        </div>
      )}
    </div>
  );
}

export function StatBadge({label, value}: {label: string; value: string}) {
  return (
    <div className="panel-surface p-5 text-start">
      <p className="field-label mb-0 txt-muted">{label}</p>
      <p className="mt-3 text-4xl font-black txt-strong">{value}</p>
    </div>
  );
}

const MOOD_EMOJI_SCORES = [1, 3, 5, 7, 9] as const;
const MOOD_EMOJIS_BY_SCORE: Record<number, string> = {1: '😴', 3: '😞', 5: '😐', 7: '😊', 9: '🔥'};

export function MoodPicker({value, onChange, label}: {value: number | null; onChange: (s: number) => void; label: string}) {
  const t = useTranslations('morningRitual');
  return (
    <div>
      <p className="field-label mb-3 txt-soft">{label}</p>
      <div className="flex gap-2">
        {MOOD_EMOJI_SCORES.map((score) => (
          <button
            key={score}
            type="button"
            aria-pressed={value === score}
            aria-label={t(`moodLevel${score}` as Parameters<typeof t>[0])}
            onClick={() => onChange(score)}
            className={`focus-ring flex h-12 w-12 items-center justify-center rounded-2xl border text-2xl transition ${
              value === score
                ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.18)] scale-110'
                : 'border-[color:var(--color-border)] fill-2 hover:border-[color:var(--color-border-strong)] hover:scale-105'
            }`}
          >
            {MOOD_EMOJIS_BY_SCORE[score]}
          </button>
        ))}
      </div>
    </div>
  );
}

export function ModeSelectScreen({
  goalContext,
  effectiveTone,
  suggestedMode,
  lifeContexts,
  locale,
  onSelect,
  onBack,
}: {
  goalContext: MorningRitualGoalContext | null;
  effectiveTone: MorningRitualTone;
  suggestedMode: RitualMode;
  lifeContexts: LifeContextStatus[];
  locale: AppLocale;
  onSelect: (mode: RitualMode, moodBefore: number | null) => void;
  onBack: () => void;
}) {
  const t = useTranslations('morningRitual');
  const tRoot = useTranslations();
  const ritualTone = effectiveTone;
  const yesterdayHintKey =
    ritualTone === 'restart_gently'
      ? 'yesterday.modeHintRestartGently'
      : ritualTone === 'high_performance'
        ? 'yesterday.modeHintHighPerformance'
        : null;
  const lifeSuggestKey = yesterdayHintKey ? null : suggestedMorningRitualModeKey(lifeContexts);
  const [moodBefore, setMoodBefore] = useState<number | null>(null);

  const modes: RitualMode[] = ['quick', 'standard', 'deep'];
  const modeGradients: Record<RitualMode, string> = {
    quick: 'linear-gradient(135deg, rgba(232,87,42,0.28), rgba(0,0,0,0.55))',
    standard: 'linear-gradient(135deg, rgba(232,87,42,0.22), rgba(26,109,255,0.22))',
    deep: 'linear-gradient(135deg, rgba(10,20,60,0.95), rgba(26,109,255,0.38))',
  };

  return (
    <div className="mx-auto max-w-4xl">
      <button className="focus-ring btn-ghost mb-5" onClick={onBack}>
        {t('common.back')}
      </button>

      <div className="panel-surface mb-6 p-5">
        <MoodPicker
          value={moodBefore}
          onChange={setMoodBefore}
          label={t('moodBefore')}
        />
      </div>

      <p className="eyebrow">{t('start.eyebrow')}</p>
      <h2 className="mt-4 text-3xl font-black sm:text-4xl">{t('mode.title')}</h2>
      {yesterdayHintKey ? (
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{t(yesterdayHintKey)}</p>
      ) : lifeSuggestKey ? (
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[var(--muted)]">{tRoot(lifeSuggestKey)}</p>
      ) : null}

      {goalContext ? <GoalFocusBanner goalContext={goalContext} locale={locale} /> : null}

      <div className="mt-8 grid gap-4 lg:grid-cols-3">
        {modes.map((key) => (
          <button
            key={key}
            className={`focus-ring interactive-panel min-h-[240px] overflow-hidden rounded-[22px] border p-6 text-start ${
              key === suggestedMode ? 'border-[var(--blue)]/40' : 'border-white/10'
            }`}
            style={{background: modeGradients[key]}}
            onClick={() => onSelect(key, moodBefore)}
          >
            <div className="flex h-full flex-col justify-between gap-6">
              <div>
                <div className="flex items-start justify-between gap-3">
                  <p className="text-lg font-black text-white">{t(`mode.${key}`)}</p>
                  <span className="inline-flex shrink-0 rounded-full border border-white/20 bg-black/30 px-3 py-1 text-xs font-black text-white">
                    ~{formatMorningModeMinutes(key)} {t('mode.minutes')}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-white/12 bg-white/4 px-2.5 py-1 text-[11px] font-bold text-white/55">
                    {t('mode.stepCount', {count: STEPS_BY_MODE[key].length - 1})}
                  </span>
                  {key === suggestedMode ? (
                    <span className="rounded-full border border-[var(--blue)]/30 bg-[var(--blue)]/12 px-2.5 py-1 text-[11px] font-bold text-[var(--blue)]">
                      {t('mode.suggested')}
                    </span>
                  ) : null}
                </div>
                <h3 className="mt-3 text-base font-semibold leading-7 text-white/90">{t(`mode.${key}Desc`)}</h3>
                <p className="mt-3 text-sm leading-6 text-white/65">{t(`mode.${key}Includes`)}</p>
                <p className="mt-4 text-xs leading-5 text-white/55">
                  <span className="font-semibold text-white/70">{t('mode.bestForLabel')}: </span>
                  {t(`mode.${key}BestFor`)}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
