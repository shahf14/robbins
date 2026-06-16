'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import type {LifeContextStatus} from '@/lib/life-coach/types';
import {eveningPrepSuggestionKeys} from '@/lib/life-context-content';
import type {MeditationRecommendation} from '@/lib/formulation/meditation-routing';
import type {PersonalizedVisualization} from '@/lib/formulation/visualization-context';
import {StepNavigation} from '@/components/evening-reset/evening-reset-shell';

export function EnvironmentDesignStep({
  t,
  lifeContexts,
  items,
  setItems,
  input,
  setInput,
  sleepTarget,
  setSleepTarget,
  sleepTime,
  screenOffHint,
  onBack,
  onNext,
  onSkip,
}: {
  t: ReturnType<typeof useTranslations>;
  lifeContexts: LifeContextStatus[];
  items: string[];
  setItems: (v: string[]) => void;
  input: string;
  setInput: (v: string) => void;
  sleepTarget: string;
  setSleepTarget: (v: string) => void;
  sleepTime: string;
  screenOffHint: string;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const addItem = (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || items.includes(trimmed)) return;
    setItems([...items, trimmed]);
    setInput('');
  };

  const removeItem = (item: string) => setItems(items.filter((i) => i !== item));

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
          {t('environmentDesign.eyebrow')}
        </p>
        <h2 className="text-2xl font-bold">{t('environmentDesign.question')}</h2>
        <p className="text-sm text-white/50">{t('environmentDesign.subtitle')}</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {eveningPrepSuggestionKeys(lifeContexts).map((key) => {
          const label = t(`environmentDesign.${key}`);
          const active = items.includes(label);
          return (
            <button
              key={key}
              type="button"
              aria-pressed={active}
              onClick={() => (active ? removeItem(label) : addItem(label))}
              className={`focus-ring rounded-full border px-3 py-1 text-sm transition ${
                active
                  ? 'border-white/40 bg-white/15 text-white'
                  : 'border-white/10 bg-white/5 text-white/60 hover:bg-white/10'
              }`}
            >
              {active ? '✓ ' : ''}{label}
            </button>
          );
        })}
      </div>

      <div className="flex gap-2">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addItem(input)}
          placeholder={t('environmentDesign.inputPlaceholder')}
          aria-label={t('environmentDesign.inputPlaceholder')}
          className="focus-ring flex-1 rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm placeholder-white/30"
        />
        <button
          type="button"
          onClick={() => addItem(input)}
          className="focus-ring btn-ghost px-4 py-2 text-sm"
        >
          {t('common.add')}
        </button>
      </div>

      {items.length > 0 && (
        <div className="space-y-1">
          {items.map((item) => (
            <div key={item} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
              <span className="text-white/80">✓ {item}</span>
              <button
                type="button"
                onClick={() => removeItem(item)}
                className="focus-ring text-white/30 hover:text-white/60"
                aria-label={t('common.remove')}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="space-y-2">
        <p className="text-sm text-white/50">{t('environmentDesign.sleepTargetLabel')}</p>
        <p className="text-xs text-white/40">{t('environmentDesign.screenOffHint', {hint: screenOffHint})}</p>
        <input
          type="text"
          value={sleepTarget}
          onChange={(e) => setSleepTarget(e.target.value)}
          placeholder={t('environmentDesign.sleepTargetPlaceholder', {sleepTime})}
          className="w-full rounded-xl border border-white/10 bg-white/5 px-4 py-2 text-sm placeholder-white/30 focus-ring"
        />
      </div>

      <StepNavigation
        t={t}
        onBack={onBack}
        onNext={onNext}
        onSkip={onSkip}
        showSkip={items.length === 0}

      />
    </div>
  );
}

const VIZ_LINES = ['vizLine1', 'vizLine2', 'vizLine3', 'vizLine4', 'vizLine5'] as const;

export function VisualizationStep({
  t,
  tomorrowsWin,
  personalized,
  meditation,
  onBack,
  onNext,
}: {
  t: ReturnType<typeof useTranslations>;
  tomorrowsWin: string;
  personalized?: PersonalizedVisualization | null;
  meditation?: MeditationRecommendation | null;
  onBack: () => void;
  onNext: () => void;
}) {
  const [lineIndex, setLineIndex] = useState(0);

  const guidedLines =
    meditation?.avoid_deep_content
      ? [
          meditation.phase_guidance.prepare,
          ...meditation.phase_guidance.inhale.slice(0, 2),
          meditation.phase_guidance.complete,
        ]
      : personalized?.guided_steps ??
        VIZ_LINES.map((key) => t(`visualization.${key}` as Parameters<typeof t>[0]));
  const finished = lineIndex >= guidedLines.length;

  useEffect(() => {
    if (finished) {
      return;
    }
    const timer = window.setTimeout(() => setLineIndex((i) => i + 1), 3500);
    return () => window.clearTimeout(timer);
  }, [finished, guidedLines.length]);

  return (
    <div className="space-y-8 text-center">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
          {t('visualization.eyebrow')}
        </p>
        <h2 className="text-2xl font-bold">{t('visualization.title')}</h2>
        {meditation && (
          <p className="text-sm leading-relaxed text-white/60">{meditation.instructions}</p>
        )}
        {personalized?.subtitle && !meditation?.avoid_deep_content && (
          <p className="text-sm leading-relaxed text-white/60">{personalized.subtitle}</p>
        )}
        {meditation && (
          <p className="text-[11px] text-[var(--blue)]/80">{meditation.why_this_meditation}</p>
        )}
        {personalized && !meditation && (
          <p className="text-[11px] text-[var(--blue)]/80">{t('visualization.personalizedHint')}</p>
        )}
      </div>

      <div className="min-h-[120px] space-y-3 rounded-2xl border border-white/10 bg-white/5 p-6">
        {guidedLines.slice(0, lineIndex).map((line, index) => (
          <p
            key={`${index}-${line.slice(0, 24)}`}
            className="text-base leading-relaxed text-white/80 transition-all duration-700 animate-in fade-in slide-in-from-bottom-2"
          >
            {line}
          </p>
        ))}
        {tomorrowsWin && lineIndex >= guidedLines.length && (
          <p className="mt-2 text-sm italic text-white/50">
            {t('visualization.yourWin')}: {tomorrowsWin}
          </p>
        )}
      </div>

      {finished && (
        <StepNavigation
          t={t}
          onBack={onBack}
          onNext={onNext}
          nextLabel={t('visualization.finish')}
        />
      )}
    </div>
  );
}
