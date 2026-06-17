'use client';

import {useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import type {EveningMode} from '@/lib/evening-reset-types';
import {EVENING_MODE_MINUTES, EVENING_STEPS_BY_MODE} from '@/lib/evening-reset-types';
import {suggestedEveningModeKey} from '@/lib/life-context-content';
import {
  suggestedEveningModeFromSchedule,
  suggestedEveningModeScheduleKey,
} from '@/lib/schedule-content';
import {
  capEveningRitualMode,
  type EmotionalStageRouting,
} from '@/lib/formulation/emotional-stage-routing';
import {
  painFocusBannerBodyKey,
  painFocusBannerKey,
  painFocusBannerParams,
  type EveningResetPainContext,
} from '@/lib/evening-reset/pain-context';
import {loadUserPreferences} from '@/lib/user-preferences';

export function ProgressBar({current, total}: {current: number; total: number}) {
  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  return (
    <div
      className="mb-6 h-1 w-full rounded-full fill-3"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div
        className="h-1 rounded-full bg-[color:var(--color-text)] transition-all duration-500"
        style={{width: `${pct}%`}}
      />
    </div>
  );
}

export function StepNavigation({
  onBack,
  onNext,
  onSkip,
  nextLabel,
  canNext,
  showSkip,
  t,
}: {
  onBack?: () => void;
  onNext: () => void;
  onSkip?: () => void;
  nextLabel?: string;
  canNext?: boolean;
  showSkip?: boolean;
  t: ReturnType<typeof useTranslations>;
}) {
  return (
    <div className="mt-6 flex items-center justify-between gap-3">
      {onBack ? (
        <button type="button" onClick={onBack} className="focus-ring btn-ghost px-4 py-2 text-sm">
          {t('common.back')}
        </button>
      ) : (
        <span />
      )}
      <div className="flex items-center gap-2">
        {showSkip && onSkip && (
          <button type="button" onClick={onSkip} className="focus-ring btn-ghost px-4 py-2 text-sm opacity-60">
            {t('common.skip')}
          </button>
        )}
        <button
          type="button"
          onClick={onNext}
          disabled={canNext === false}
          className="focus-ring btn-primary px-6 py-2 text-sm disabled:opacity-40"
        >
          {nextLabel ?? t('common.next')}
        </button>
      </div>
    </div>
  );
}

function PainFocusBanner({
  t,
  painContext,
  locale,
}: {
  t: ReturnType<typeof useTranslations>;
  painContext: EveningResetPainContext;
  locale: AppLocale;
}) {
  const titleKey = painFocusBannerKey(painContext);
  const bodyKey = painFocusBannerBodyKey(painContext);
  if (!titleKey || !bodyKey) return null;

  return (
    <div className="rounded-xl border border-violet-400/30 bg-violet-500/8 px-4 py-3 text-start">
      <p className="text-xs font-bold uppercase tracking-wide text-violet-200/80">
        {t('painFocus.eyebrow')}
      </p>
      <p className="mt-1 text-sm font-semibold leading-snug text-violet-50">
        {t(titleKey as Parameters<typeof t>[0])}
      </p>
      <p className="mt-2 text-xs leading-relaxed text-violet-100/70">
        {t(bodyKey as Parameters<typeof t>[0], painFocusBannerParams(painContext, locale))}
      </p>
    </div>
  );
}

export function StartScreen({
  t,
  streak,
  completedCount,
  painContext,
  locale,
  onSelectMode,
  onAdvancedStart,
}: {
  t: ReturnType<typeof useTranslations>;
  streak: number;
  completedCount: number;
  painContext: EveningResetPainContext | null;
  locale: AppLocale;
  onSelectMode: (mode: EveningMode) => void;
  onAdvancedStart: () => void;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-8 py-12 text-center">
      <div className="space-y-3">
        <p className="text-xs font-semibold uppercase tracking-widest txt-muted">
          {t('start.eyebrow')}
        </p>
        <h1 className="text-3xl font-bold leading-tight">{t('start.title')}</h1>
        <p className="txt-soft">{t('start.subtitle')}</p>
        <div className="mx-auto mt-4 max-w-md space-y-2 text-start">
          <div className="rounded-xl border border-violet-400/25 bg-violet-500/8 px-4 py-3">
            <p className="text-xs font-bold uppercase tracking-wide text-violet-200/90">
              {t('start.timeToClose')}
            </p>
            <p className="mt-1.5 text-sm leading-6 text-violet-100/90">{t('start.outcomePromise')}</p>
          </div>
          {completedCount === 0 && (
            <p className="rounded-xl border border-violet-400/20 bg-violet-500/6 px-4 py-3 text-sm leading-6 text-violet-100/90">
              {t('start.roleExplanation')}
            </p>
          )}
          {painContext ? (
            <PainFocusBanner t={t} painContext={painContext} locale={locale} />
          ) : null}
          <p className="px-1 text-xs leading-5 txt-muted">{t('start.notJournal')}</p>
        </div>

        <div className="mx-auto mt-5 grid max-w-md gap-3 sm:grid-cols-3">
          {(['quick', 'standard', 'deep'] as EveningMode[]).map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => onSelectMode(key)}
              className="focus-ring group rounded-xl border border-[color:var(--color-border)] fill-1 px-3 py-4 text-start transition hover:border-violet-400/40 hover:bg-violet-500/7"
            >
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-bold txt-strong">{t(`mode.${key}`)}</p>
                <span className="shrink-0 rounded-full border border-[color:var(--color-border-strong)] bg-black/25 px-2 py-0.5 text-[10px] font-bold txt-strong">
                  ~{EVENING_MODE_MINUTES[key]} {t('mode.minutes')}
                </span>
              </div>
              <p className="mt-1 text-[11px] font-semibold txt-faint">
                {t('mode.stepCount', {count: EVENING_STEPS_BY_MODE[key].length - 1})}
              </p>
              <p className="mt-2 text-[11px] leading-4 txt-soft">
                <span className="font-semibold txt-soft">{t('mode.outcomeLabel')}: </span>
                {t(`mode.${key}Outcome`)}
              </p>
              <p className="mt-3 text-[11px] font-bold text-violet-400/70 transition group-hover:text-violet-400">
                {t('start.startMode')} →
              </p>
            </button>
          ))}
        </div>

        <button
          type="button"
          className="focus-ring btn-ghost mt-2 text-sm"
          onClick={onAdvancedStart}
        >
          {t('start.advancedOptions')}
        </button>
      </div>

      {completedCount > 0 && (
        <div className="flex items-center justify-center gap-8">
          <div className="text-center">
            <p className="text-2xl font-bold">{streak}</p>
            <p className="text-xs txt-muted">{t('start.streak')}</p>
          </div>
          <div className="text-center">
            <p className="text-2xl font-bold">{completedCount}</p>
            <p className="text-xs txt-muted">{t('start.completed')}</p>
          </div>
        </div>
      )}

      {completedCount === 0 && (
        <div className="rounded-xl border border-[color:var(--color-border)] p-5 text-left space-y-2">
          <p className="text-xs font-semibold uppercase tracking-widest txt-muted">
            {t('start.previewTitle')}
          </p>
          {(['previewWin', 'previewCompletion', 'previewGratitude', 'previewTomorrow'] as const).map(
            (key) => (
              <div key={key} className="flex items-center gap-2 text-sm txt-soft">
                <span className="txt-faint">→</span>
                <span>{t(`start.${key}`)}</span>
              </div>
            )
          )}
        </div>
      )}
    </div>
  );
}

export function ModeSelectScreen({
  t,
  onSelect,
  onBack,
  emotionalStage,
}: {
  t: ReturnType<typeof useTranslations>;
  onSelect: (mode: EveningMode) => void;
  onBack: () => void;
  emotionalStage: EmotionalStageRouting | null;
}) {
  const tRoot = useTranslations();
  const prefs = loadUserPreferences();
  const lifeContexts = prefs.life_context_statuses;
  const scheduleSuggestKey = suggestedEveningModeScheduleKey(prefs.sleep_time);
  const suggestKey = scheduleSuggestKey ?? suggestedEveningModeKey(lifeContexts);
  const suggestedMode = capEveningRitualMode(
    suggestedEveningModeFromSchedule(prefs.sleep_time, lifeContexts),
    emotionalStage
  );
  const modes: EveningMode[] = ['quick', 'standard', 'deep'];
  return (
    <div className="mx-auto max-w-xl space-y-6 py-8">
      <div className="text-center space-y-2">
        <h2 className="text-2xl font-bold">{t('mode.title')}</h2>
        {suggestKey ? (
          <p className="text-sm leading-7 txt-soft">{tRoot(suggestKey)}</p>
        ) : null}
      </div>
      <div className="space-y-3">
        {modes.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => onSelect(m)}
            className={`focus-ring w-full rounded-xl border p-4 text-left transition hover:border-[color:var(--color-border-strong)] hover:fill-3 ${
              m === suggestedMode
                ? 'border-[var(--blue)]/40 bg-[var(--blue)]/8'
                : 'border-[color:var(--color-border)] fill-2'
            }`}
            aria-pressed={m === suggestedMode}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-semibold">{t(`mode.${m}`)}</p>
                  <span className="shrink-0 rounded-full border border-[color:var(--color-border-strong)] bg-black/25 px-2.5 py-0.5 text-xs font-bold txt-strong">
                    ~{EVENING_MODE_MINUTES[m]} {t('mode.minutes')}
                  </span>
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <span className="rounded-full border border-[color:var(--color-border)] fill-1 px-2.5 py-1 text-[11px] font-bold txt-soft">
                    {t('mode.stepCount', {count: EVENING_STEPS_BY_MODE[m].length - 1})}
                  </span>
                  {m === suggestedMode ? (
                    <span className="rounded-full border border-violet-400/30 bg-violet-500/12 px-2.5 py-1 text-[11px] font-bold text-violet-200">
                      {t('mode.suggested')}
                    </span>
                  ) : null}
                </div>
                <p className="mt-1 text-sm txt-muted">{t(`mode.${m}Desc`)}</p>
                <p className="mt-2 text-xs leading-5 txt-soft">
                  <span className="font-semibold txt-soft">{t('mode.outcomeLabel')}: </span>
                  {t(`mode.${m}Outcome`)}
                </p>
              </div>
            </div>
          </button>
        ))}
      </div>
      <button type="button" onClick={onBack} className="focus-ring btn-ghost w-full py-2 text-sm">
        {t('common.back')}
      </button>
    </div>
  );
}
