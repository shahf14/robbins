'use client';

import {useEffect, useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import type {LifeContextStatus} from '@/lib/life-coach/types';
import type {IdentityOption, TimeBlock} from '@/lib/morning-ritual-types';
import type {MorningRitualTone} from '@/lib/morning-ritual/yesterday-context';
import {
  morningMissionPlaceholderForGoalContext,
  type MorningRitualGoalContext,
} from '@/lib/morning-ritual/goal-context';
import type {PersonalizedVisualization} from '@/lib/formulation/visualization-context';
import {StepNavigation} from '@/components/morning-ritual/morning-ritual-navigation';

export function VisualizationStep({
  text,
  onChange,
  showGuided,
  onToggleGuided,
  personalized,
  onMount,
  onNext,
  onBack,
}: {
  text: string;
  onChange: (text: string) => void;
  showGuided: boolean;
  onToggleGuided: () => void;
  personalized?: PersonalizedVisualization | null;
  onMount?: () => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('morningRitual');
  const onMountRef = useRef(onMount);

  useEffect(() => {
    onMountRef.current = onMount;
  }, [onMount]);

  useEffect(() => {
    onMountRef.current?.();
  }, []);

  const guidedSteps =
    personalized?.guided_steps ??
    [
      t('visualization.guided.step1'),
      t('visualization.guided.step2'),
      t('visualization.guided.step3'),
      t('visualization.guided.step4'),
      t('visualization.guided.step5'),
      t('visualization.guided.step6'),
    ];
  const subtitle = personalized?.subtitle ?? t('visualization.subtitle');
  const placeholder = personalized?.placeholder ?? t('visualization.placeholder');

  return (
    <div>
      <p className="eyebrow">Visualization</p>
      <h2 className="mt-4 text-3xl font-black">{t('visualization.title')}</h2>
      <p className="mt-3 text-[var(--muted)]">{subtitle}</p>
      {personalized && (
        <p className="mt-2 text-[11px] text-[var(--blue)]/80">{t('visualization.personalizedHint')}</p>
      )}

      <button
        className="focus-ring btn-ghost mt-4"
        type="button"
        onClick={onToggleGuided}
      >
        {t('visualization.guidedButton')}
      </button>

      {showGuided && (
        <GuidedVisualization steps={guidedSteps} />
      )}

      <label className="mt-6 grid gap-2">
        <span className="field-label mb-0">{t('visualization.question')}</span>
        <textarea
          className="focus-ring textarea-base"
          placeholder={placeholder}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>

      <StepNavigation onBack={onBack} onNext={onNext} />
    </div>
  );
}

function GuidedVisualization({steps}: {steps: string[]}) {
  const [currentStep, setCurrentStep] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (currentStep >= steps.length) return;

    let innerTimer: ReturnType<typeof setTimeout>;
    const timer = setTimeout(() => {
      setVisible(false);
      innerTimer = setTimeout(() => {
        setCurrentStep((prev) => prev + 1);
        setVisible(true);
      }, 400);
    }, 3000);

    return () => {
      clearTimeout(timer);
      clearTimeout(innerTimer);
    };
  }, [currentStep, steps.length]);

  if (currentStep >= steps.length) return null;

  return (
    <div className="mt-4 flex min-h-28 items-center justify-center rounded-[20px] border border-[color:var(--color-border)] fill-2 p-6">
      <p
        className="text-center text-xl font-bold transition-opacity duration-400"
        style={{opacity: visible ? 1 : 0}}
      >
        {steps[currentStep]}
      </p>
    </div>
  );
}

export function IdentityStep({
  text,
  onChange,
  identities,
  onIdentitiesChange,
  onNext,
  onBack,
}: {
  text: string;
  onChange: (text: string) => void;
  identities: IdentityOption[];
  onIdentitiesChange: (items: IdentityOption[]) => void;
  onNext: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('morningRitual');
  const [showAddNew, setShowAddNew] = useState(false);
  const [newIdentity, setNewIdentity] = useState('');

  const defaultIdentities = [
    t('identity.defaultIdentities.finisher'),
    t('identity.defaultIdentities.calm_pressure'),
    t('identity.defaultIdentities.acts_anyway'),
    t('identity.defaultIdentities.depth_over_escape'),
  ];

  function addIdentity() {
    if (!newIdentity.trim()) return;
    const item: IdentityOption = {
      id: crypto.randomUUID(),
      text: newIdentity.trim(),
      createdAt: new Date().toISOString(),
    };
    onIdentitiesChange([item, ...identities]);
    onChange(newIdentity.trim());
    setNewIdentity('');
    setShowAddNew(false);
  }

  const allOptions = [
    ...identities.map((identity) => identity.text),
    ...defaultIdentities.filter((defaultIdentity) => !identities.some((identity) => identity.text === defaultIdentity)),
  ];

  return (
    <div>
      <p className="eyebrow">Identity</p>
      <h2 className="mt-4 text-3xl font-black">{t('identity.title')}</h2>
      <p className="mt-3 text-[var(--muted)]">{t('identity.subtitle')}</p>
      <p className="mt-6 text-lg font-bold">{t('identity.question')}</p>

      <div className="mt-4 grid gap-2">
        {allOptions.map((option) => (
          <button
            key={option}
            className={`focus-ring rounded-lg border-2 px-4 py-3 text-start font-bold transition ${
              text === option
                ? 'border-[var(--accent)] fill-2'
                : 'border-[var(--border)] fill-1 hover:border-[var(--accent)]'
            }`}
            type="button"
            onClick={() => onChange(option)}
          >
            {option}
          </button>
        ))}
      </div>

      {showAddNew ? (
        <div className="mt-4 flex gap-2">
          <input
            className="focus-ring input-base flex-1"
            placeholder={t('identity.placeholder')}
            value={newIdentity}
            onChange={(e) => setNewIdentity(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') addIdentity();
            }}
          />
          <button
            className="focus-ring btn-primary"
            type="button"
            onClick={addIdentity}
          >
            {t('affirmation.save')}
          </button>
        </div>
      ) : (
        <button
          className="focus-ring btn-ghost mt-4 border-dashed"
          type="button"
          onClick={() => setShowAddNew(true)}
        >
          + {t('identity.addNew')}
        </button>
      )}

      <label className="mt-4 grid gap-2">
        <span className="field-label mb-0">{t('identity.declaration')}</span>
        <textarea
          className="focus-ring textarea-base min-h-24"
          placeholder={t('identity.placeholder')}
          value={text}
          onChange={(e) => onChange(e.target.value)}
        />
      </label>

      <StepNavigation onBack={onBack} onNext={onNext} nextDisabled={!text.trim()} />
    </div>
  );
}

export function MissionStep({
  lifeContexts,
  goalContext,
  effectiveTone,
  text,
  onChange,
  energyScore,
  focusScore,
  onEnergyChange,
  onFocusChange,
  timeBlock,
  onTimeBlockChange,
  onComplete,
  onBack,
}: {
  lifeContexts: LifeContextStatus[];
  goalContext: MorningRitualGoalContext | null;
  effectiveTone: MorningRitualTone;
  text: string;
  onChange: (text: string) => void;
  energyScore: number;
  focusScore: number;
  onEnergyChange: (value: number) => void;
  onFocusChange: (value: number) => void;
  timeBlock: TimeBlock | null;
  onTimeBlockChange: (block: TimeBlock) => void;
  onComplete: () => void;
  onBack: () => void;
}) {
  const t = useTranslations('morningRitual');
  const tRoot = useTranslations();
  const missionPlaceholderKey = morningMissionPlaceholderForGoalContext(
    lifeContexts,
    effectiveTone,
    goalContext
  );

  const timeBlocks: TimeBlock[] = ['morning', 'afternoon', 'evening', 'now'];

  return (
    <div>
      <p className="eyebrow">Mission</p>
      <h2 className="mt-4 text-3xl font-black">{t('mission.title')}</h2>
      <p className="mt-3 text-[var(--muted)]">{t('mission.subtitle')}</p>
      {effectiveTone === 'restart_gently' ? (
        <p className="mt-4 rounded-xl border border-sky-400/20 bg-sky-500/6 px-4 py-3 text-sm leading-7 text-sky-100/85">
          {t('yesterday.missionGentleHint')}
        </p>
      ) : null}
      <p className="mt-6 text-lg font-bold">{t('mission.question')}</p>

      <textarea
        className="focus-ring textarea-base mt-4 min-h-28 w-full"
        placeholder={tRoot(missionPlaceholderKey)}
        value={text}
        onChange={(e) => onChange(e.target.value)}
      />

      <div className="mt-4">
        <p className="field-label mb-0 txt-muted">{t('mission.timeBlock')}</p>
        <div className="mt-2 flex flex-wrap gap-2">
          {timeBlocks.map((block) => (
            <button
              key={block}
              className={`focus-ring rounded-full px-4 py-2 text-sm font-bold transition ${
                timeBlock === block
                  ? 'bg-[var(--accent)] text-white'
                  : 'border border-[var(--border)] fill-1 hover:fill-2'
              }`}
              type="button"
              onClick={() => onTimeBlockChange(block)}
            >
              {t(`mission.${block}`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-8 grid gap-5 rounded-2xl border border-[color:var(--color-border)] fill-2 p-4">
        <p className="text-sm font-bold txt-strong">{t('mission.calibrationTitle')}</p>
        <p className="text-sm leading-6 text-[var(--muted)]">{t('mission.calibrationHint')}</p>
        <label className="grid gap-2">
          <span className="flex items-center justify-between gap-3">
            <span className="field-label mb-0">{tRoot('checkin.energy')}</span>
            <span className="text-sm font-semibold txt-soft">{energyScore}/10</span>
          </span>
          <input
            className="focus-ring"
            type="range"
            min="1"
            max="10"
            value={energyScore}
            onChange={(event) => onEnergyChange(Number(event.target.value))}
          />
        </label>
        <label className="grid gap-2">
          <span className="flex items-center justify-between gap-3">
            <span className="field-label mb-0">{tRoot('checkin.focus')}</span>
            <span className="text-sm font-semibold txt-soft">{focusScore}/10</span>
          </span>
          <input
            className="focus-ring"
            type="range"
            min="1"
            max="10"
            value={focusScore}
            onChange={(event) => onFocusChange(Number(event.target.value))}
          />
        </label>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-3">
        <button
          className="focus-ring btn-secondary"
          type="button"
          onClick={onBack}
        >
          {t('common.back')}
        </button>
        <button
          className="focus-ring btn-primary text-lg disabled:opacity-60"
          disabled={!text.trim()}
          type="button"
          onClick={onComplete}
        >
          {t('mission.finish')}
        </button>
      </div>
    </div>
  );
}
