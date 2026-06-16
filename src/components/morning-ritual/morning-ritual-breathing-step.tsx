'use client';

import {useEffect, useRef, useState, type CSSProperties} from 'react';
import {useTranslations} from 'next-intl';
import type {BreathingType, RitualMode} from '@/lib/morning-ritual-types';
import {BREATHING_PATTERNS} from '@/lib/morning-ritual-types';
import {
  maxBreathingRoundsForMeditation,
  type MeditationRecommendation,
} from '@/lib/formulation/meditation-routing';

type BreathingStepProps = {
  mode: RitualMode;
  breathingType: BreathingType;
  meditation: MeditationRecommendation | null;
  onTypeChange: (type: BreathingType) => void;
  onComplete: (roundsDone?: number) => void;
  onSkip: () => void;
};

export function BreathingStep({
  mode,
  breathingType,
  meditation,
  onTypeChange,
  onComplete,
  onSkip,
}: BreathingStepProps) {
  const t = useTranslations('morningRitual');
  const pattern = BREATHING_PATTERNS[breathingType];

  const [isRunning, setIsRunning] = useState(false);
  const [phase, setPhase] = useState<'inhale' | 'hold' | 'exhale'>('inhale');
  const [round, setRound] = useState(1);
  const [timer, setTimer] = useState(pattern.inhale);
  const [showComplete, setShowComplete] = useState(false);
  const intervalRef = useRef<number | null>(null);

  const maxRounds = maxBreathingRoundsForMeditation(
    meditation,
    mode,
    mode === 'quick' ? Math.min(3, pattern.rounds) : pattern.rounds
  );

  const inhaleGuidance = meditation?.phase_guidance.inhale ?? [
    t('breathing.guidance.inhale1'),
    t('breathing.guidance.inhale2'),
    t('breathing.guidance.inhale3'),
  ];
  const holdGuidance = meditation?.phase_guidance.hold ?? [
    t('breathing.guidance.hold1'),
    t('breathing.guidance.hold2'),
    t('breathing.guidance.hold3'),
  ];
  const exhaleGuidance = meditation?.phase_guidance.exhale ?? [
    t('breathing.guidance.exhale1'),
    t('breathing.guidance.exhale2'),
    t('breathing.guidance.exhale3'),
  ];

  const currentGuidance = phase === 'inhale'
    ? inhaleGuidance[(round - 1) % 3]
    : phase === 'hold'
      ? holdGuidance[(round - 1) % 3]
      : exhaleGuidance[(round - 1) % 3];

  useEffect(() => {
    return () => {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, []);

  const guidanceKey = `${phase}-${round}`;

  function startBreathing() {
    setIsRunning(true);
    setPhase('inhale');
    setRound(1);
    setTimer(pattern.inhale);

    let currentPhase: 'inhale' | 'hold' | 'exhale' = 'inhale';
    let currentRound = 1;
    let remaining = pattern.inhale;

    intervalRef.current = window.setInterval(() => {
      remaining--;
      setTimer(remaining);

      if (remaining <= 0) {
        if (currentPhase === 'inhale') {
          if (pattern.hold > 0) {
            currentPhase = 'hold';
            remaining = pattern.hold;
          } else {
            currentPhase = 'exhale';
            remaining = pattern.exhale;
          }
        } else if (currentPhase === 'hold') {
          currentPhase = 'exhale';
          remaining = pattern.exhale;
        } else {
          currentRound++;
          if (currentRound > maxRounds) {
            if (intervalRef.current) window.clearInterval(intervalRef.current);
            setIsRunning(false);
            setShowComplete(true);
            return;
          }
          currentPhase = 'inhale';
          remaining = pattern.inhale;
          setRound(currentRound);
        }
        setPhase(currentPhase);
        setTimer(remaining);
      }
    }, 1000);
  }

  function stopBreathing() {
    if (intervalRef.current) window.clearInterval(intervalRef.current);
    setIsRunning(false);
  }

  if (showComplete) {
    return (
      <div className="ritual-step-enter flex min-h-[50vh] flex-col items-center justify-center text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--blue)] text-3xl text-white" style={{boxShadow: '0 0 40px rgba(26,109,255,0.3)'}}>
          &#10003;
        </div>
        <p className="mt-8 text-2xl font-black leading-relaxed">
          {meditation?.phase_guidance.complete ?? t('breathing.guidance.complete')}
        </p>
        <button
          className="focus-ring btn-primary mt-8"
          onClick={() => onComplete(maxRounds)}
        >
          {t('common.next')}
        </button>
      </div>
    );
  }

  const circleScale = phase === 'exhale' ? 0.85 : 1.35;
  const phaseStyles = {
    inhale: {color: 'var(--blue)', glow: 'rgba(26,109,255,0.3)'},
    hold:   {color: '#5c8fff',     glow: 'rgba(92,143,255,0.28)'},
    exhale: {color: 'var(--accent)',glow: 'rgba(232,87,42,0.25)'},
  } as const;
  const {color: phaseColor, glow: glowColor} = phaseStyles[phase];
  const roundDots = Array.from({length: maxRounds}, (_, i) => i + 1);

  return (
    <div className="text-center">
      <p className="eyebrow justify-center">{t('breathing.title')}</p>
      <h2 className="mt-4 text-3xl font-black">
        {meditation?.title ?? t('breathing.title')}
      </h2>
      <p className="mt-3 text-[var(--muted)]">
        {meditation?.instructions ?? t('breathing.subtitle')}
      </p>
      {meditation && (
        <p className="mx-auto mt-3 max-w-md text-xs leading-5 text-[var(--blue)]/85">
          {meditation.why_this_meditation}
        </p>
      )}

      {!isRunning && (
        <>
          <p className="mx-auto mt-6 max-w-md text-lg font-bold leading-relaxed">
            {meditation?.phase_guidance.prepare ?? t('breathing.guidance.prepare')}
          </p>

          {!meditation && (
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {(['default', 'energy', 'calm'] as BreathingType[]).map((type) => (
              <button
                key={type}
                className={`focus-ring rounded-full px-4 py-2 text-sm font-bold transition ${
                  breathingType === type
                    ? 'bg-[var(--blue)] text-white'
                    : 'border border-[var(--border)] bg-white/2 hover:bg-white/8'
                }`}
                type="button"
                onClick={() => onTypeChange(type)}
              >
                {t(`breathing.${type}`)}
              </button>
            ))}
          </div>
          )}
        </>
      )}

      <div className="mt-8 flex min-h-[240px] items-center justify-center">
        <div className="relative flex h-64 w-64 items-center justify-center">
          <div className="absolute inset-5 rounded-full border border-white/10 bg-white/2" />
          <div
            className={`relative flex h-48 w-48 items-center justify-center rounded-full transition-all duration-[1200ms] ease-in-out ${isRunning ? 'ritual-circle-glow' : ''}`}
            style={{
              transform: isRunning ? `scale(${circleScale})` : 'scale(1)',
              background: isRunning
                ? `radial-gradient(circle, ${phaseColor} 0%, rgba(255,255,255,0.1) 100%)`
                : 'radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(255,255,255,0.02) 100%)',
              border: isRunning ? '1px solid transparent' : '3px solid rgba(255,255,255,0.12)',
              opacity: isRunning ? 0.95 : 1,
              '--glow-color': glowColor,
            } as CSSProperties}
          >
            {isRunning ? (
              <div className="text-center text-white">
                <p className="text-5xl font-black">{timer}</p>
                <p className="mt-2 text-sm font-bold uppercase tracking-[0.2em] opacity-80">
                  {t(`breathing.${phase}`)}
                </p>
              </div>
            ) : (
              <p className="text-lg font-bold text-[var(--muted)]">{t('breathing.ready')}</p>
            )}
          </div>
        </div>
      </div>

      {isRunning && (
        <div className="mt-4 min-h-16">
          <p
            key={guidanceKey}
            className="ritual-guidance mx-auto max-w-sm text-xl font-bold leading-relaxed"
          >
            {currentGuidance}
          </p>
        </div>
      )}

      {isRunning && (
        <div className="mt-4 flex items-center justify-center gap-2">
          {roundDots.map((r) => (
            <div
              key={r}
              className="rounded-full transition-all duration-300"
              style={{
                width: r === round ? '12px' : '8px',
                height: r === round ? '12px' : '8px',
                backgroundColor: r <= round ? 'var(--accent)' : 'var(--border)',
              }}
            />
          ))}
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {!isRunning ? (
          <>
            <button
              className="focus-ring btn-primary"
              type="button"
              onClick={startBreathing}
            >
              {t('breathing.start')}
            </button>
            <button
              className="focus-ring btn-secondary"
              type="button"
              onClick={onSkip}
            >
              {t('breathing.skip')}
            </button>
          </>
        ) : (
          <button
            className="focus-ring btn-ghost"
            type="button"
            onClick={() => {
              stopBreathing();
              onComplete();
            }}
          >
            {t('breathing.done')}
          </button>
        )}
      </div>
    </div>
  );
}
