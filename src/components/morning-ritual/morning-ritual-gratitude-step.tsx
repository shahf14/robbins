'use client';

import {useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import type {LifeContextStatus} from '@/lib/life-coach/types';
import type {RitualMode} from '@/lib/morning-ritual-types';
import {
  getEntryPlaceholders,
  getTrigger,
  getTriggersForLifeContexts,
  type GratitudeTriggerKey,
} from '@/lib/gratitude-data';
import {morningGratitudePlaceholderKeys} from '@/lib/life-context-content';
import {StepNavigation} from '@/components/morning-ritual/morning-ritual-navigation';

type GratitudeStepProps = {
  mode: RitualMode;
  lifeContexts: LifeContextStatus[];
  entries: string[];
  onChange: (entries: string[]) => void;
  onNext: () => void;
  onBack: () => void;
  onTriggerUsed?: (index: number, key: GratitudeTriggerKey) => void;
  /** Called whenever an already-filled entry is modified (was_edited tracking) */
  onWasEdited?: (index: number) => void;
  /** Captures composition time without asking the user for another input. */
  onDurationRecorded?: (index: number, seconds: number) => void;
};

export function GratitudeStep({
  mode,
  lifeContexts,
  entries,
  onChange,
  onNext,
  onBack,
  onTriggerUsed,
  onWasEdited,
  onDurationRecorded,
}: GratitudeStepProps) {
  const t = useTranslations('morningRitual');
  const tRoot = useTranslations();
  const locale = useLocale() as AppLocale;
  const count = mode === 'quick' ? 1 : 3;
  const prepDuration = mode === 'quick' ? 30 : mode === 'deep' ? 60 : 45;
  const [phase, setPhase] = useState<'prep' | 'write' | 'integrating'>('prep');
  const [prepRemaining, setPrepRemaining] = useState(prepDuration);
  const [activeIndex, setActiveIndex] = useState(0);
  const [entrySeconds, setEntrySeconds] = useState(0);
  const [selectedTriggerKey, setSelectedTriggerKey] = useState<GratitudeTriggerKey | null>(null);
  const [recordingIndex, setRecordingIndex] = useState<number | null>(null);
  const [voiceError, setVoiceError] = useState('');
  const entriesRef = useRef(entries);
  const textareasRef = useRef<Array<HTMLTextAreaElement | null>>([]);
  const recognitionRef = useRef<BrowserSpeechRecognition | null>(null);

  const contextPlaceholderKeys = morningGratitudePlaceholderKeys(lifeContexts, count);
  const placeholders = contextPlaceholderKeys
    ? contextPlaceholderKeys.map((key) => tRoot(key))
    : getEntryPlaceholders(locale);

  const triggers = getTriggersForLifeContexts(locale, lifeContexts);
  const speechRecognitionSupported = !!getSpeechRecognitionFactory();

  function updateEntry(index: number, value: string) {
    const prev = entries[index] ?? '';
    // Detect edit: entry already had content and is being changed
    if (prev.trim().length > 0 && value !== prev) {
      onWasEdited?.(index);
    }
    const next = [...entries];
    next[index] = value;
    onChange(next);
  }

  useEffect(() => {
    entriesRef.current = entries;
  }, [entries]);

  useEffect(() => {
    if (phase !== 'prep') {
      return;
    }

    const interval = window.setInterval(() => {
      setPrepRemaining((previous) => {
        if (previous <= 1) {
          window.clearInterval(interval);
          setPhase('write');
          setEntrySeconds(0);
          return 0;
        }

        return previous - 1;
      });
    }, 1000);

    return () => window.clearInterval(interval);
  }, [phase]);

  useEffect(() => {
    if (phase !== 'write') {
      return;
    }

    const interval = window.setInterval(() => {
      setEntrySeconds((previous) => (previous >= 60 ? 60 : previous + 1));
    }, 1000);

    return () => window.clearInterval(interval);
  }, [phase, activeIndex]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  const activeTrigger = selectedTriggerKey ? getTrigger(selectedTriggerKey, locale) : null;
  const progressPercent = ((activeIndex + Math.min(entrySeconds, 60) / 60) / count) * 100;
  const activeHasContent = !!entries[activeIndex]?.trim();

  function activateEntry(index: number) {
    setActiveIndex(index);
    setEntrySeconds(0);
    setSelectedTriggerKey(null);
    setVoiceError('');
    recognitionRef.current?.stop();
    setRecordingIndex(null);
    window.setTimeout(() => textareasRef.current[index]?.focus(), 0);
  }

  function handleBack() {
    if (phase === 'write' && activeIndex > 0) {
      onDurationRecorded?.(activeIndex, entrySeconds);
      activateEntry(activeIndex - 1);
      return;
    }

    onBack();
  }

  function handleAdvance() {
    onDurationRecorded?.(activeIndex, entrySeconds);
    if (activeIndex < count - 1) {
      activateEntry(activeIndex + 1);
      return;
    }

    setPhase('integrating');
    recognitionRef.current?.stop();
    setRecordingIndex(null);
    window.setTimeout(() => onNext(), 1600);
  }

  function handleTriggerClick(key: GratitudeTriggerKey) {
    const trigger = getTrigger(key, locale);
    const starter = trigger.starter;
    const current = entriesRef.current[activeIndex] || '';
    const nextValue = current.trim()
      ? current.includes(starter)
        ? current
        : `${starter} ${current}`
      : starter;

    updateEntry(activeIndex, nextValue);
    setSelectedTriggerKey(key);
    onTriggerUsed?.(activeIndex, key);
    window.setTimeout(() => textareasRef.current[activeIndex]?.focus(), 0);
  }

  function toggleVoiceCapture(index: number) {
    if (recordingIndex === index) {
      recognitionRef.current?.stop();
      setRecordingIndex(null);
      return;
    }

    const SpeechRecognitionFactory = getSpeechRecognitionFactory();

    if (!SpeechRecognitionFactory) {
      setVoiceError(t('gratitude.voiceUnsupported'));
      return;
    }

    const recognition = new SpeechRecognitionFactory();
    recognition.lang = locale === 'he' ? 'he-IL' : 'en-US';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const transcript = Array.from(event.results)
        .map((result) => result[0]?.transcript ?? '')
        .join(' ')
        .trim();

      if (!transcript) {
        return;
      }

      const current = entriesRef.current[index] || '';
      updateEntry(index, current ? `${current} ${transcript}` : transcript);
    };
    recognition.onerror = () => {
      setVoiceError(t('gratitude.voiceError'));
      setRecordingIndex(null);
    };
    recognition.onend = () => {
      setRecordingIndex(null);
      recognitionRef.current = null;
    };

    setVoiceError('');
    recognitionRef.current?.stop();
    recognitionRef.current = recognition;
    setRecordingIndex(index);
    recognition.start();
  }

  if (phase === 'integrating') {
    return <GratitudeIntegrationMoment />;
  }

  if (phase === 'prep') {
    return (
      <div className="text-center">
        <p className="eyebrow justify-center">{t('gratitude.prep.eyebrow')}</p>
        <h2 className="mt-4 font-[var(--font-body)] text-3xl font-semibold text-white sm:text-4xl">
          {t('gratitude.prep.title')}
        </h2>
        <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-[var(--muted)] sm:text-lg">
          {t('gratitude.prep.subtitle')}
        </p>

        <div className="mx-auto mt-8 flex max-w-xl items-center justify-between gap-4 rounded-full border border-white/10 bg-white/3 px-5 py-3">
          <span className="text-sm font-semibold text-white/70">
            {t('gratitude.prep.timer', {seconds: prepRemaining})}
          </span>
          <span className="text-sm font-semibold uppercase tracking-[0.15em] text-[var(--blue)]">
            {prepRemaining % 2 === 0 ? t('gratitude.prep.pulseIn') : t('gratitude.prep.pulseOut')}
          </span>
        </div>

        <div className="mt-10 flex items-center justify-center">
          <div className="relative flex h-72 w-72 items-center justify-center">
            <div className="fire-breath-halo absolute inset-0 rounded-full border border-white/10" />
            <div className="fire-breath-core relative flex h-44 w-44 items-center justify-center rounded-full border border-[rgba(232,87,42,0.28)] bg-[radial-gradient(circle,rgba(232,87,42,0.28),rgba(26,109,255,0.04))]">
              <div className="text-center">
                <p className="text-5xl font-black text-white">{prepRemaining}</p>
                <p className="mt-2 text-xs font-bold uppercase tracking-[0.25em] text-white/72">
                  {t('gratitude.prep.fireBreath')}
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          <button
            className="focus-ring btn-ghost"
            type="button"
            onClick={() => {
              setPhase('write');
              setEntrySeconds(0);
            }}
          >
            {t('gratitude.prep.skip')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div>
      <p className="eyebrow">{t('gratitude.eyebrow')}</p>
      <h2 className="mt-4 font-[var(--font-body)] text-3xl font-semibold text-white sm:text-4xl">{t('gratitude.title')}</h2>
      <p className="mt-3 text-[var(--muted)]">{t('gratitude.subtitle')}</p>
      <p className="mt-6 text-lg font-semibold text-white">{t('gratitude.question')}</p>

      <div className="mt-6 rounded-[22px] border border-white/10 bg-white/3 p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="field-label mb-0 text-white/50">
            {t('gratitude.timerLabel', {current: activeIndex + 1, total: count})}
          </p>
          <span className="text-sm font-semibold text-white/68">
            {t('gratitude.timerSeconds', {seconds: Math.max(0, 60 - entrySeconds)})}
          </span>
        </div>
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div
            className="h-full rounded-full bg-[var(--blue)] transition-all duration-700"
            style={{width: `${progressPercent}%`}}
          />
        </div>
      </div>

      {activeTrigger ? (
        <div className="mt-6 rounded-[20px] border border-[rgba(26,109,255,0.25)] bg-[rgba(26,109,255,0.08)] p-4">
          <p className="field-label mb-0 text-[var(--blue)]">{activeTrigger.label}</p>
          <p className="mt-3 leading-7 text-white">{activeTrigger.prompt}</p>
        </div>
      ) : null}

      <div className="mt-6 grid gap-4">
        {Array.from({length: count}).map((_, i) => (
          <div
            key={`entry-${i}`}
            role="button"
            tabIndex={0}
            className={`w-full cursor-pointer rounded-[24px] border p-4 text-start transition-all duration-300 ${
              i === activeIndex
                ? 'border-white/16 bg-white/5 opacity-100 shadow-[0_14px_36px_rgba(0,0,0,0.28)]'
                : 'border-white/8 bg-white/2 opacity-40'
            }`}
            onClick={() => activateEntry(i)}
            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activateEntry(i); } }}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="field-label mb-0 text-white/45">{t('gratitude.entryLabel', {index: i + 1})}</p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
                  {i === activeIndex ? t('gratitude.activePrompt') : t('gratitude.inactivePrompt')}
                </p>
              </div>
              <button
                className={`focus-ring inline-flex h-11 w-11 items-center justify-center rounded-full border ${
                  recordingIndex === i
                    ? 'border-[var(--accent)] bg-[rgba(232,87,42,0.18)] text-white'
                    : 'border-white/12 bg-white/4 text-white/72'
                }`}
                type="button"
                aria-label={recordingIndex === i ? t('gratitude.voiceListening') : t('gratitude.voiceButton')}
                onClick={(event) => {
                  event.stopPropagation();
                  activateEntry(i);
                  toggleVoiceCapture(i);
                }}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                  <path d="M12 15a3 3 0 0 0 3-3V7a3 3 0 0 0-6 0v5a3 3 0 0 0 3 3Zm5-3a1 1 0 1 1 2 0 7 7 0 0 1-6 6.92V21h3a1 1 0 1 1 0 2H8a1 1 0 1 1 0-2h3v-2.08A7 7 0 0 1 5 12a1 1 0 1 1 2 0 5 5 0 1 0 10 0Z" />
                </svg>
              </button>
            </div>

            <textarea
              ref={(element) => {
                textareasRef.current[i] = element;
              }}
              className={`focus-ring textarea-base mt-4 min-h-28 transition-opacity ${
                i === activeIndex ? 'pointer-events-auto opacity-100' : 'pointer-events-none opacity-55'
              }`}
              aria-label={t('gratitude.entryLabel', {index: i + 1})}
              placeholder={placeholders[i] || placeholders[0]}
              readOnly={i !== activeIndex}
              value={entries[i] || ''}
              onChange={(e) => updateEntry(i, e.target.value)}
            />
          </div>
        ))}
      </div>

      <div aria-live="polite">
        {voiceError ? (
          <p className="mt-4 text-sm font-semibold text-[var(--accent)]">{voiceError}</p>
        ) : recordingIndex === activeIndex ? (
          <p className="mt-4 text-sm font-semibold text-[var(--blue)]">{t('gratitude.voiceListening')}</p>
        ) : speechRecognitionSupported ? (
          <p className="mt-4 text-sm font-semibold text-white/55">{t('gratitude.voiceHelp')}</p>
        ) : null}
      </div>

      <div className="mt-8">
        <p className="field-label mb-0 text-white/52">{t('gratitude.hint')}</p>
        <div className="mt-3 flex flex-wrap gap-2">
          {triggers.map((triggerKey) => {
            const trigger = getTrigger(triggerKey, locale);
            const isSelected = triggerKey === selectedTriggerKey;

            return (
              <button
                key={triggerKey}
                aria-pressed={isSelected}
                className={`focus-ring rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  isSelected
                    ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.14)] text-white'
                    : 'border-white/10 bg-white/4 text-white/72 hover:bg-white/8'
                }`}
                type="button"
                onClick={() => handleTriggerClick(triggerKey)}
              >
                {trigger.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 rounded-[20px] border border-white/10 bg-white/3 p-4">
        <p className="text-sm leading-7 text-[var(--muted)]">{t('gratitude.promptSupport')}</p>
      </div>

      <StepNavigation
        onBack={handleBack}
        onNext={handleAdvance}
        nextDisabled={!activeHasContent}
        nextLabel={activeIndex < count - 1 ? t('gratitude.ctaContinue') : t('gratitude.ctaFinish')}
        backLabel={activeIndex > 0 ? t('gratitude.ctaBackEntry') : undefined}
      />
    </div>
  );
}

type BrowserSpeechRecognitionResult = {
  transcript?: string;
};

type BrowserSpeechRecognitionAlternative = ArrayLike<BrowserSpeechRecognitionResult>;

type BrowserSpeechRecognitionEvent = {
  results: ArrayLike<BrowserSpeechRecognitionAlternative>;
};

type BrowserSpeechRecognition = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type BrowserSpeechRecognitionFactory = new () => BrowserSpeechRecognition;

function getSpeechRecognitionFactory(): BrowserSpeechRecognitionFactory | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const browserWindow = window as Window &
    typeof globalThis & {
      SpeechRecognition?: BrowserSpeechRecognitionFactory;
      webkitSpeechRecognition?: BrowserSpeechRecognitionFactory;
    };

  return browserWindow.SpeechRecognition ?? browserWindow.webkitSpeechRecognition ?? null;
}

function GratitudeIntegrationMoment() {
  const t = useTranslations('morningRitual');

  return (
    <div className="ritual-step-enter flex min-h-[50vh] flex-col items-center justify-center text-center">
      <div className="neural-network relative h-48 w-72">
        <span className="neural-node absolute left-8 top-16" />
        <span className="neural-node absolute left-28 top-6" />
        <span className="neural-node absolute left-36 top-32" />
        <span className="neural-node absolute right-20 top-12" />
        <span className="neural-node absolute right-10 top-32" />
        <span className="neural-link absolute left-12 top-20 w-24 rotate-[-18deg]" />
        <span className="neural-link absolute left-24 top-18 w-28 rotate-[12deg]" />
        <span className="neural-link absolute left-36 top-28 w-24 rotate-[-10deg]" />
        <span className="neural-link absolute left-20 top-26 w-36 rotate-[28deg]" />
        <span className="neural-link absolute right-16 top-22 w-20 rotate-[38deg]" />
      </div>

      <p className="mt-8 max-w-2xl text-xl font-semibold leading-8 text-white sm:text-2xl">
        {t('gratitude.integrationMessage')}
      </p>
      <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--blue)]">
        {t('gratitude.integrationEyebrow')}
      </p>
    </div>
  );
}
