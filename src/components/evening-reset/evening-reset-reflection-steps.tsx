'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import type {GratitudeCategory} from '@/lib/evening-reset-types';
import type {LifeContextStatus} from '@/lib/life-coach/types';
import {
  eveningTomorrowsWinPlaceholderKey,
  eveningTomorrowsWinQuestionKey,
  eveningWinReviewExampleKeys,
  eveningWinReviewPlaceholderKey,
  eveningWinReviewQuestionKey,
} from '@/lib/life-context-content';
import {
  completionBlockerCopyOverride,
  tomorrowsWinCopyOverride,
  winReviewCopyOverride,
  type EveningResetPainContext,
} from '@/lib/evening-reset/pain-context';
import {
  eveningProgressPlaceholder,
  type AccountabilityContext,
} from '@/lib/formulation/accountability-routing';
import {StepNavigation} from '@/components/evening-reset/evening-reset-shell';

const MOOD_OPTIONS = [
  {score: 1, emoji: '😞', labelKey: 'moodCheck.mood1'},
  {score: 2, emoji: '😕', labelKey: 'moodCheck.mood2'},
  {score: 3, emoji: '😐', labelKey: 'moodCheck.mood3'},
  {score: 4, emoji: '🙂', labelKey: 'moodCheck.mood4'},
  {score: 5, emoji: '😊', labelKey: 'moodCheck.mood5'},
] as const;

export function MoodCheckStep({
  t,
  value,
  onSelect,
}: {
  t: ReturnType<typeof useTranslations>;
  value: number | null;
  onSelect: (mood: number) => void;
}) {
  return (
    <div className="space-y-8 text-center">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
          {t('moodCheck.eyebrow')}
        </p>
        <h2 className="text-2xl font-bold">{t('moodCheck.question')}</h2>
        <p className="text-sm text-white/45">{t('moodCheck.subtitle')}</p>
      </div>

      <div className="flex justify-center gap-3">
        {MOOD_OPTIONS.map(({score, emoji, labelKey}) => (
          <button
            key={score}
            type="button"
            onClick={() => onSelect(score)}
            className={`focus-ring flex flex-col items-center gap-1.5 rounded-2xl border px-4 py-3 transition ${
              value === score
                ? 'border-white/40 bg-white/12 scale-110'
                : 'border-white/10 bg-white/5 hover:bg-white/10 hover:scale-105'
            }`}
            aria-pressed={value === score}
            aria-label={t(labelKey as Parameters<typeof t>[0])}
          >
            <span className="text-3xl leading-none" aria-hidden="true">{emoji}</span>
            <span className="text-[10px] font-semibold text-white/40">
              {t(labelKey as Parameters<typeof t>[0])}
            </span>
          </button>
        ))}
      </div>

      {value !== null && value <= 2 && (
        <p className="text-sm text-white/50 animate-in fade-in slide-in-from-bottom-2 duration-300">
          {t('moodCheck.hardDayNote')}
        </p>
      )}
    </div>
  );
}

export function WinReviewStep({
  t,
  tRoot,
  locale,
  lifeContexts,
  painContext,
  accountability,
  value,
  onChange,
  onBack,
  onNext,
  onSkip,
  dayMood,
}: {
  t: ReturnType<typeof useTranslations>;
  tRoot: ReturnType<typeof useTranslations>;
  locale: string;
  lifeContexts: LifeContextStatus[];
  painContext: EveningResetPainContext | null;
  accountability: AccountabilityContext | null;
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
  dayMood?: number | null;
}) {
  const isRtl = locale === 'he';
  const examples = eveningWinReviewExampleKeys(lifeContexts).map((key) => tRoot(key));
  const copyOverride = winReviewCopyOverride(painContext);
  const accountabilityQuestion = accountability?.evening_progress_question;
  const questionKey = copyOverride?.questionKey ?? eveningWinReviewQuestionKey(lifeContexts);
  const placeholderKey =
    copyOverride?.placeholderKey ?? eveningWinReviewPlaceholderKey(lifeContexts);

  const subtitle = dayMood === 3 ? t('winReview.subtitleNeutralDay') : t('winReview.subtitle');

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
          {t('winReview.eyebrow')}
        </p>
        <h2 className="text-2xl font-bold">
          {accountabilityQuestion
            ? accountabilityQuestion
            : copyOverride
              ? t(questionKey as Parameters<typeof t>[0])
              : tRoot(questionKey)}
        </h2>
        <p className="text-sm text-white/50">{subtitle}</p>
      </div>

      <textarea
        dir={isRtl ? 'rtl' : 'ltr'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t('winReview.eyebrow')}
        placeholder={
          accountability
            ? eveningProgressPlaceholder(locale as AppLocale)
            : copyOverride
              ? t(placeholderKey as Parameters<typeof t>[0])
              : tRoot(placeholderKey)
        }
        rows={4}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-4 text-sm placeholder-white/30 focus-ring"
      />

      <div className="space-y-2">
        <p className="text-xs text-white/30">{t('winReview.examplesLabel')}</p>
        <div className="flex flex-wrap gap-2">
          {examples.map((ex) => (
            <button
              key={ex}
              type="button"
              onClick={() => onChange(ex)}
              className="focus-ring rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs text-white/60 transition hover:border-white/20 hover:bg-white/10"
            >
              {ex}
            </button>
          ))}
        </div>
      </div>

      <StepNavigation
        t={t}
        onBack={onBack}
        onNext={onNext}
        onSkip={onSkip}
        showSkip={!value.trim()}

      />
    </div>
  );
}

export function CompletionReviewStep({
  t,
  painContext,
  successFactors,
  setSuccessFactors,
  blockers,
  setBlockers,
  onBack,
  onNext,
  onSkip,
}: {
  t: ReturnType<typeof useTranslations>;
  painContext: EveningResetPainContext | null;
  successFactors: string;
  setSuccessFactors: (v: string) => void;
  blockers: string;
  setBlockers: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const blockerCopy = completionBlockerCopyOverride(painContext);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
          {t('completionReview.eyebrow')}
        </p>
        <h2 className="text-2xl font-bold">{t('completionReview.title')}</h2>
      </div>

      <div className="space-y-3">
        <label className="block space-y-2">
          <p className="text-sm font-medium text-white/70">{t('completionReview.successQuestion')}</p>
          <textarea
            value={successFactors}
            onChange={(e) => setSuccessFactors(e.target.value)}
            placeholder={t('completionReview.successPlaceholder')}
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-sm placeholder-white/30 focus-ring"
          />
        </label>

        <label className="block space-y-2">
          <p className="text-sm font-medium text-white/70">
            {blockerCopy
              ? t(blockerCopy.questionKey as Parameters<typeof t>[0])
              : t('completionReview.blockerQuestion')}
          </p>
          <textarea
            value={blockers}
            onChange={(e) => setBlockers(e.target.value)}
            placeholder={
              blockerCopy
                ? t(blockerCopy.placeholderKey as Parameters<typeof t>[0])
                : t('completionReview.blockerPlaceholder')
            }
            rows={3}
            className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-3 text-sm placeholder-white/30 focus-ring"
          />
        </label>
      </div>

      <StepNavigation
        t={t}
        onBack={onBack}
        onNext={onNext}
        onSkip={onSkip}
        showSkip={!successFactors.trim() && !blockers.trim()}

      />
    </div>
  );
}

export function EmotionalDumpStep({
  t,
  value,
  onChange,
  onBack,
  onNext,
  onSkip,
}: {
  t: ReturnType<typeof useTranslations>;
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
          {t('emotionalDump.eyebrow')}
        </p>
        <h2 className="text-2xl font-bold">{t('emotionalDump.question')}</h2>
        <p className="text-sm text-white/50">{t('emotionalDump.subtitle')}</p>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t('emotionalDump.question')}
        placeholder={t('emotionalDump.placeholder')}
        rows={6}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-4 text-sm placeholder-white/30 focus-ring"
      />

      <p className="text-xs text-white/30">{t('emotionalDump.hint')}</p>

      <StepNavigation
        t={t}
        onBack={onBack}
        onNext={onNext}
        onSkip={onSkip}
        showSkip={!value.trim()}

      />
    </div>
  );
}

const GRATITUDE_CATEGORIES: GratitudeCategory[] = ['person', 'moment', 'achievement', 'opportunity'];

export function GratitudeStep({
  t,
  items,
  setItems,
  categories,
  setCategories,
  onBack,
  onNext,
  onSkip,
}: {
  t: ReturnType<typeof useTranslations>;
  items: string[];
  setItems: (v: string[]) => void;
  categories: GratitudeCategory[];
  setCategories: (v: GratitudeCategory[]) => void;
  onBack: () => void;
  onNext: () => void;
  onSkip: () => void;
}) {
  const [activeIndex, setActiveIndex] = useState(0);

  const setItem = (i: number, val: string) => {
    const next = [...items];
    next[i] = val;
    setItems(next);
  };

  const toggleCategory = (cat: GratitudeCategory) => {
    if (categories.includes(cat)) {
      setCategories(categories.filter((c) => c !== cat));
    } else {
      setCategories([...categories, cat]);
    }
  };

  const hasSomething = items.some((i) => i.trim());

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
          {t('gratitude.eyebrow')}
        </p>
        <h2 className="text-2xl font-bold">{t('gratitude.question')}</h2>
      </div>

      <div className="flex gap-2">
        {GRATITUDE_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            aria-pressed={categories.includes(cat)}
            onClick={() => toggleCategory(cat)}
            className={`focus-ring rounded-full border px-3 py-1 text-xs transition ${
              categories.includes(cat)
                ? 'border-white/40 bg-white/15 text-white'
                : 'border-white/10 bg-white/5 text-white/50 hover:bg-white/10'
            }`}
          >
            {t(`gratitude.category_${cat}`)}
          </button>
        ))}
      </div>

      <div className="space-y-3">
        {[0, 1, 2].map((i) => (
          <div key={i} className="space-y-1">
            <p className="text-xs text-white/40">{t('gratitude.entryLabel', {index: i + 1})}</p>
            <textarea
              value={items[i] ?? ''}
              aria-label={t('gratitude.entryLabel', {index: i + 1})}
              onChange={(e) => {
                setItem(i, e.target.value);
                setActiveIndex(i);
              }}
              onFocus={() => setActiveIndex(i)}
              placeholder={i === activeIndex ? t('gratitude.activePlaceholder') : t('gratitude.placeholder')}
              rows={2}
              className={`focus-ring w-full resize-none rounded-xl border p-3 text-sm placeholder-white/30 transition ${
                i === activeIndex
                  ? 'border-white/25 bg-white/8'
                  : 'border-white/10 bg-white/5'
              }`}
            />
          </div>
        ))}
      </div>

      <StepNavigation
        t={t}
        onBack={onBack}
        onNext={onNext}
        onSkip={onSkip}
        showSkip={!hasSomething}

      />
    </div>
  );
}

export function AiInsightStep({
  t,
  insight,
  onBack,
  onNext,
}: {
  t: ReturnType<typeof useTranslations>;
  insight: string;
  onBack: () => void;
  onNext: () => void;
}) {
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => setRevealed(true), 600);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className="space-y-8">
      <div className="space-y-2 text-center">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
          {t('aiInsight.eyebrow')}
        </p>
        <h2 className="text-2xl font-bold">{t('aiInsight.title')}</h2>
      </div>

      <div
        className={`rounded-2xl border border-white/10 bg-white/5 p-6 text-center transition-all duration-700 ${
          revealed ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
        }`}
      >
        <p className="text-lg leading-relaxed text-white/90">{insight || t('aiInsight.patternDefault')}</p>
      </div>

      <p className="text-center text-sm text-white/40">{t('aiInsight.subtitle')}</p>

      <StepNavigation t={t} onBack={onBack} onNext={onNext} />
    </div>
  );
}

export function TomorrowsWinStep({
  t,
  tRoot,
  lifeContexts,
  painContext,
  value,
  onChange,
  onBack,
  onNext,
  isFinalStep,
}: {
  t: ReturnType<typeof useTranslations>;
  tRoot: ReturnType<typeof useTranslations>;
  lifeContexts: LifeContextStatus[];
  painContext: EveningResetPainContext | null;
  value: string;
  onChange: (v: string) => void;
  onBack: () => void;
  onNext: () => void;
  isFinalStep: boolean;
}) {
  const copyOverride = tomorrowsWinCopyOverride(painContext);
  const questionKey =
    copyOverride?.questionKey ?? eveningTomorrowsWinQuestionKey(lifeContexts);
  const placeholderKey =
    copyOverride?.placeholderKey ?? eveningTomorrowsWinPlaceholderKey(lifeContexts);

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <p className="text-xs font-semibold uppercase tracking-widest text-white/40">
          {t('tomorrowsWin.eyebrow')}
        </p>
        <h2 className="text-2xl font-bold">
          {copyOverride ? t(questionKey as Parameters<typeof t>[0]) : tRoot(questionKey)}
        </h2>
        <p className="text-sm text-white/50">{t('tomorrowsWin.subtitle')}</p>
      </div>

      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        aria-label={t('tomorrowsWin.eyebrow')}
        placeholder={
          copyOverride
            ? t(placeholderKey as Parameters<typeof t>[0])
            : tRoot(placeholderKey)
        }
        rows={4}
        className="w-full resize-none rounded-xl border border-white/10 bg-white/5 p-4 text-sm placeholder-white/30 focus-ring"
      />

      <StepNavigation
        t={t}
        onBack={onBack}
        onNext={onNext}
        nextLabel={isFinalStep ? t('tomorrowsWin.finish') : t('common.next')}

      />
    </div>
  );
}
