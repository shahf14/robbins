'use client';

import {useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {Link} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/config';
import type {
  HealthAnchorHabit,
  HealthCategory,
  HealthGoalWizardData,
  LifeDomainState,
} from '@/lib/life-coach/types';
import {HEALTH_CATEGORIES} from '@/lib/life-coach/types';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import {defaultAnchorTimeForHabit} from '@/lib/schedule-content';
import {parseJsonObjectOr} from '@/lib/safe-json';
import {loadUserPreferences} from '@/lib/user-preferences';
import {HealthGoalPreview, type HealthGoalPreviewData} from './health-goal-preview';
import {inferSecondaryFocus, inferWeightDirection, wizardDataToContextInput} from './health-wizard-utils';
import {ExpandableTextarea} from '../expandable-textarea';
import {AiActionHelpMicrocopy} from '@/components/feedback/ai-action-help-microcopy';
import {AiGeneratingProgress} from '../shared/ai-generating-progress';
import {CustomTimePicker} from '../shared/custom-time-picker';
import {GoalCelebration} from '../shared/goal-celebration';
import {GoalHierarchyExplainer} from '../shared/goal-hierarchy-explainer';
import {GoalWizardAiBuildPreview} from '../shared/goal-wizard-ai-build-preview';
import {MilestonesWhyExplainer} from '../shared/milestones-why-explainer';
import {addDaysYMD, todayYMD} from '@/lib/date-utils';
import {HEALTH_GOAL_DRAFT_KEY} from '@/lib/draft-storage-keys';

type Props = {
  assessment: LifeDomainState | null;
  onCreated: () => Promise<void>;
};

const TOTAL_STEPS = 5;
const DRAFT_KEY = HEALTH_GOAL_DRAFT_KEY;

export function HealthGoalWizard({assessment, onCreated}: Props) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [inspiringMilestones, setInspiringMilestones] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<HealthGoalPreviewData | null>(null);
  const [wizardContext, setWizardContext] = useState<ReturnType<typeof wizardDataToContextInput> | null>(null);
  const [previewSuccessMetric, setPreviewSuccessMetric] = useState('');

  const [category, setCategory] = useState<HealthCategory | null>(null);
  const [baselineValue, setBaselineValue] = useState(0);
  const [targetValue, setTargetValue] = useState(0);

  const [milestone30, setMilestone30] = useState('');
  const [milestone60, setMilestone60] = useState('');
  const [milestone90, setMilestone90] = useState('');
  const [milestone30Kg, setMilestone30Kg] = useState('');
  const [milestone60Kg, setMilestone60Kg] = useState('');
  const [milestone90Kg, setMilestone90Kg] = useState('');

  const [whyImportant, setWhyImportant] = useState('');
  const [whyNow, setWhyNow] = useState('');
  const [whatLost, setWhatLost] = useState('');

  const [anchorHabit, setAnchorHabit] = useState<HealthAnchorHabit | ''>('');
  const [anchorTime, setAnchorTime] = useState('');
  const [anchorCustomLabel, setAnchorCustomLabel] = useState('');

  const [celebrating, setCelebrating] = useState(false);
  const [hasDraft, setHasDraft] = useState(() => {
    if (typeof window === 'undefined') return false;
    try {
      return !!window.localStorage.getItem(DRAFT_KEY);
    } catch {
      return false;
    }
  });
  const [draftRestored, setDraftRestored] = useState(false);

  // Auto-save the in-progress wizard so leaving mid-way doesn't lose everything.
  useEffect(() => {
    if (draftRestored) return; // don't overwrite before the user decides to restore/discard
    if (!category && step === 1) return; // nothing meaningful yet
    try {
      window.localStorage.setItem(
        DRAFT_KEY,
        JSON.stringify({
          step,
          category,
          baselineValue,
          targetValue,
          milestone30,
          milestone60,
          milestone90,
          milestone30Kg,
          milestone60Kg,
          milestone90Kg,
          whyImportant,
          whyNow,
          whatLost,
          anchorHabit,
          anchorTime,
          anchorCustomLabel,
        })
      );
    } catch {
      // ignore
    }
  }, [
    draftRestored,
    step,
    category,
    baselineValue,
    targetValue,
    milestone30,
    milestone60,
    milestone90,
    milestone30Kg,
    milestone60Kg,
    milestone90Kg,
    whyImportant,
    whyNow,
    whatLost,
    anchorHabit,
    anchorTime,
    anchorCustomLabel,
  ]);

  function clearDraft() {
    try {
      window.localStorage.removeItem(DRAFT_KEY);
    } catch {
      // ignore
    }
    setHasDraft(false);
  }

  function restoreDraft() {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (!raw) return;
      type DraftShape = {
        step?: number; category?: HealthCategory;
        baselineValue?: number; targetValue?: number;
        milestone30?: string; milestone60?: string; milestone90?: string;
        milestone30Kg?: string; milestone60Kg?: string; milestone90Kg?: string;
        whyImportant?: string; whyNow?: string; whatLost?: string;
        anchorHabit?: HealthAnchorHabit | ''; anchorTime?: string; anchorCustomLabel?: string;
      };
      const d = parseJsonObjectOr<DraftShape>(raw, {});
      setStep(d.step ?? 1);
      setCategory(d.category ?? null);
      setBaselineValue(d.baselineValue ?? 0);
      setTargetValue(d.targetValue ?? 0);
      setMilestone30(d.milestone30 ?? '');
      setMilestone60(d.milestone60 ?? '');
      setMilestone90(d.milestone90 ?? '');
      setMilestone30Kg(d.milestone30Kg ?? '');
      setMilestone60Kg(d.milestone60Kg ?? '');
      setMilestone90Kg(d.milestone90Kg ?? '');
      setWhyImportant(d.whyImportant ?? '');
      setWhyNow(d.whyNow ?? '');
      setWhatLost(d.whatLost ?? '');
      setAnchorHabit(d.anchorHabit ?? '');
      setAnchorTime(d.anchorTime ?? '');
      setAnchorCustomLabel(d.anchorCustomLabel ?? '');
    } catch {
      // ignore
    }
    setDraftRestored(true);
    setHasDraft(false);
  }

  function canProceed(): boolean {
    switch (step) {
      case 1:
        return category !== null;
      case 2:
        return baselineValue > 0 && targetValue > 0;
      case 3:
        if (category === 'weight') {
          return milestone30Kg.trim().length > 0 && milestone60Kg.trim().length > 0;
        }
        return milestone30.trim().length > 0 && milestone60.trim().length > 0;
      case 4:
        return whyImportant.trim().length > 0;
      case 5:
        return anchorHabit !== '' && (anchorHabit !== 'custom' || anchorCustomLabel.trim().length > 0);
      default:
        return false;
    }
  }

  function buildWizardData(): HealthGoalWizardData | null {
    if (!category || !anchorHabit) return null;

    const timeline = buildTimelineStrings(category);
    const secondary = inferSecondaryFocus(
      category,
      timeline.days_30,
      timeline.days_60,
      timeline.days_90,
      inferWeightDirection(category, baselineValue, targetValue),
      category === 'weight' ? baselineValue : undefined,
      category === 'weight' ? targetValue : undefined
    );

    return {
      category,
      metrics: {category, baseline_value: baselineValue, target_value: targetValue},
      weight_direction: inferWeightDirection(category, baselineValue, targetValue),
      secondary_focus: secondary,
      current_kg: category === 'weight' ? baselineValue : undefined,
      target_kg: category === 'weight' ? targetValue : undefined,
      timeline,
      why_deep: {why_important: whyImportant, why_now: whyNow, what_lost: whatLost},
      anchor_habit: anchorHabit,
      anchor_time: anchorTime || undefined,
      anchor_custom_label: anchorHabit === 'custom' ? anchorCustomLabel : undefined,
    };
  }

  function buildTimelineStrings(cat: HealthCategory) {
    if (cat === 'weight') {
      const fmt = (kg: string, fallback: string) =>
        kg.trim() ? `${kg.trim()} ק"ג` : fallback;
      return {
        days_30: fmt(milestone30Kg, milestone30),
        days_60: fmt(milestone60Kg, milestone60),
        days_90: fmt(milestone90Kg, milestone90),
      };
    }
    return {days_30: milestone30, days_60: milestone60, days_90: milestone90};
  }

  function resetWizard() {
    setStep(1);
    setCategory(null);
    setBaselineValue(0);
    setTargetValue(0);
    setMilestone30('');
    setMilestone60('');
    setMilestone90('');
    setMilestone30Kg('');
    setMilestone60Kg('');
    setMilestone90Kg('');
    setWhyImportant('');
    setWhyNow('');
    setWhatLost('');
    setAnchorHabit('');
    setAnchorTime('');
    setAnchorCustomLabel('');
    setPreview(null);
    setWizardContext(null);
    setErrorMessage(null);
    setDraftRestored(false);
    clearDraft();
  }

  async function handleInspireHealthMilestones() {
    if (!category) return;
    setInspiringMilestones(true);
    setErrorMessage(null);
    try {
      const goalText = `Improve ${category} from ${baselineValue} to ${targetValue}`;
      const result = await lifeCoachApi.inspireMilestones({locale, domain: 'health', category, goal_text: goalText});
      setMilestone30(result.days_30);
      setMilestone60(result.days_60);
      setMilestone90(result.days_90);
    } catch {
      setErrorMessage(t('healthWizard.createError'));
    }
    setInspiringMilestones(false);
  }

  async function handlePreparePreview() {
    const wizardData = buildWizardData();
    if (!wizardData) return;

    setLoading(true);
    setErrorMessage(null);

    const contextInput = wizardDataToContextInput(wizardData);
    const rawGoal = buildRawGoalFromWizard(wizardData, t);
    const motivation = [whyImportant, whyNow, whatLost].filter(Boolean).join('\n');
    const constraints = '';

    try {
      const {coaching_style} = loadUserPreferences();
      const result = await lifeCoachApi.structureGoal({
        locale,
        domain: 'health',
        raw_goal: rawGoal,
        deadline: buildDeadline90(),
        motivation,
        constraints,
        health_wizard_context: contextInput,
        coaching_style,
      });

      const milestones = [
        ...(wizardData.timeline.days_30
          ? [{title: `${t('healthWizard.day30')}: ${wizardData.timeline.days_30}`, description: '', target_date: buildDeadline(30)}]
          : []),
        ...(wizardData.timeline.days_60
          ? [{title: `${t('healthWizard.day60')}: ${wizardData.timeline.days_60}`, description: '', target_date: buildDeadline(60)}]
          : []),
        ...(wizardData.timeline.days_90
          ? [{title: `${t('healthWizard.day90')}: ${wizardData.timeline.days_90}`, description: '', target_date: buildDeadline(90)}]
          : []),
      ];

      setPreviewSuccessMetric(buildSuccessMetric(wizardData, t));
      setWizardContext(contextInput);
      setPreview({
        goal: {
          title: result.goal?.title ?? rawGoal.slice(0, 140),
          description: result.goal?.description ?? rawGoal,
          deadline: buildDeadline90(),
        },
        milestones: milestones.slice(0, 12),
        suggested_baby_steps: (result.suggested_baby_steps ?? []).map((step) => ({
          ...step,
          domain: 'health' as const,
        })),
        execution_plan: result.execution_plan ?? null,
        plan_source: result.plan_source,
        realism_check: result.realism_check ?? null,
      });
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : t('healthWizard.createError'));
    }

    setLoading(false);
  }

  if (celebrating) {
    return (
      <GoalCelebration title={t('healthWizard.celebrateTitle')} body={t('healthWizard.celebrateBody')}>
        <Link
          href="/life-coach"
          className="focus-ring btn-primary w-full justify-center"
        >
          {t('healthWizard.celebrateViewToday')}
        </Link>
        <button
          type="button"
          className="focus-ring btn-secondary w-full justify-center"
          onClick={async () => {
            setCelebrating(false);
            await onCreated();
          }}
        >
          {t('healthWizard.celebrateAnotherDomain')}
        </button>
        <button
          type="button"
          className="focus-ring btn-ghost w-full justify-center"
          onClick={async () => {
            setCelebrating(false);
            await onCreated();
          }}
        >
          {t('healthWizard.celebrateDone')}
        </button>
      </GoalCelebration>
    );
  }

  if (preview && wizardContext) {
    return (
      <HealthGoalPreview
        preview={preview}
        wizardContext={wizardContext}
        successMetric={previewSuccessMetric}
        onCancel={() => {
          setPreview(null);
          setWizardContext(null);
        }}
        onSave={async (input) => {
          await lifeCoachApi.createGoal(input);
          resetWizard();
          setCelebrating(true);
        }}
      />
    );
  }

  return (
    <section className="panel-surface p-6">
      <p className="eyebrow">{t('healthWizard.eyebrow')}</p>
      <h3 className="mt-4 text-2xl font-black txt-strong">{t('healthWizard.title')}</h3>
      <GoalHierarchyExplainer className="mt-4" />

      {/* Progress Bar */}
      <div
        className="mt-4 flex items-center gap-2"
        role="progressbar"
        aria-valuenow={step}
        aria-valuemin={1}
        aria-valuemax={TOTAL_STEPS}
        aria-label={t('healthWizard.stepProgress', {step, total: TOTAL_STEPS})}
      >
        {Array.from({length: TOTAL_STEPS}, (_, i) => (
          <div
            key={`step-${i}`}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < step ? 'bg-[var(--blue)]' : 'fill-3'
            }`}
          />
        ))}
        <span className="text-xs font-semibold txt-muted">
          {step}/{TOTAL_STEPS}
        </span>
      </div>

      {hasDraft && !draftRestored && (
        <div className="mt-5 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--blue)]/25 bg-[rgba(26,109,255,0.08)] p-4">
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold txt-strong">{t('healthWizard.resumeTitle')}</p>
            <p className="mt-1 text-xs txt-soft">{t('healthWizard.resumeBody')}</p>
          </div>
          <button type="button" className="focus-ring btn-small" onClick={restoreDraft}>
            {t('healthWizard.resumeContinue')}
          </button>
          <button
            type="button"
            className="focus-ring text-xs font-semibold txt-muted hover:txt-strong"
            onClick={clearDraft}
          >
            {t('healthWizard.resumeDiscard')}
          </button>
        </div>
      )}

      <div className="mt-6">
        {step === 1 && (
          <StepCategory
            category={category}
            onSelect={(nextCategory) => {
              setCategory(nextCategory);
              if (nextCategory === 'energy' || nextCategory === 'specific_illness') {
                setBaselineValue(5);
                setTargetValue(7);
              } else {
                setBaselineValue(0);
                setTargetValue(0);
              }
            }}
          />
        )}

        {step === 2 && category && (
          <StepMetrics
            category={category}
            baselineValue={baselineValue}
            targetValue={targetValue}
            onBaselineChange={setBaselineValue}
            onTargetChange={setTargetValue}
          />
        )}

        {step === 3 && category && (
          <StepTimeline
            category={category}
            milestone30={milestone30}
            milestone60={milestone60}
            milestone90={milestone90}
            milestone30Kg={milestone30Kg}
            milestone60Kg={milestone60Kg}
            milestone90Kg={milestone90Kg}
            onMilestone30Change={setMilestone30}
            onMilestone60Change={setMilestone60}
            onMilestone90Change={setMilestone90}
            onMilestone30KgChange={setMilestone30Kg}
            onMilestone60KgChange={setMilestone60Kg}
            onMilestone90KgChange={setMilestone90Kg}
            onInspireMilestones={handleInspireHealthMilestones}
            inspiringMilestones={inspiringMilestones}
          />
        )}

        {step === 4 && (
          <StepDeepWhy
            whyImportant={whyImportant}
            whyNow={whyNow}
            whatLost={whatLost}
            onWhyImportantChange={setWhyImportant}
            onWhyNowChange={setWhyNow}
            onWhatLostChange={setWhatLost}
          />
        )}

        {step === 5 && (
          <StepHabitAnchor
            anchorHabit={anchorHabit}
            anchorTime={anchorTime}
            anchorCustomLabel={anchorCustomLabel}
            onAnchorHabitChange={(habit) => {
              setAnchorHabit(habit);
              const prefs = loadUserPreferences();
              setAnchorTime(defaultAnchorTimeForHabit(habit, prefs.wake_time, prefs.sleep_time));
            }}
            onAnchorTimeChange={setAnchorTime}
            onAnchorCustomLabelChange={setAnchorCustomLabel}
          />
        )}
      </div>

      {errorMessage && (
        <p className="mt-4 text-sm font-medium text-red-400" role="alert">
          {errorMessage}
        </p>
      )}

      {step === TOTAL_STEPS && !loading && <GoalWizardAiBuildPreview className="mt-6" />}

      {/* Animated generation progress while the AI works */}
      {loading && (
        <div className="mt-6">
          <AiGeneratingProgress />
        </div>
      )}

      {/* Inline validation hint when the user can't yet proceed */}
      {!canProceed() && !loading && (
        <p className="mt-4 text-sm font-medium text-amber-300/90">
          {t(`healthWizard.validationStep${step}`)}
        </p>
      )}

      {/* Navigation */}
      <div className="mt-6 flex flex-wrap gap-3">
        {step > 1 && (
          <button
            className="focus-ring btn-ghost"
            type="button"
            disabled={loading}
            aria-busy={loading}
            onClick={() => setStep(step - 1)}
          >
            {t('healthWizard.back')}
          </button>
        )}

        {step < TOTAL_STEPS ? (
          <button
            className="focus-ring btn-primary disabled:opacity-60"
            type="button"
            disabled={!canProceed()}
            onClick={() => setStep(step + 1)}
          >
            {t('healthWizard.next')}
          </button>
        ) : (
          <div className="flex flex-col items-start gap-2">
            <button
              className="focus-ring btn-primary disabled:opacity-60"
              type="button"
              disabled={loading || !canProceed()}
              aria-busy={loading}
              onClick={handlePreparePreview}
            >
              {loading ? t('lifeCoach.generating') : t('healthWizard.createGoal')}
            </button>
            <AiActionHelpMicrocopy kind="goalStructure" />
          </div>
        )}
      </div>
    </section>
  );
}

// ── Step 1: Category Selection ─────────────────────────────────────────

function StepCategory({
  category,
  onSelect,
}: {
  category: HealthCategory | null;
  onSelect: (c: HealthCategory) => void;
}) {
  const t = useTranslations();

  const categoryIcons: Record<HealthCategory, string> = {
    fitness: '💪',
    sleep: '😴',
    nutrition: '🥗',
    weight: '⚖️',
    energy: '⚡',
    specific_illness: '🏥',
  };

  return (
    <div className="grid gap-4">
      <p className="text-base font-semibold txt-strong">{t('healthWizard.step1Title')}</p>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        {HEALTH_CATEGORIES.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`focus-ring flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition ${
              category === cat
                ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                : 'border-[color:var(--color-border)] fill-1 txt-soft hover:fill-2'
            }`}
            onClick={() => onSelect(cat)}
          >
            <span className="text-2xl">{categoryIcons[cat]}</span>
            <span className="text-sm font-semibold">{t(`healthWizard.categories.${cat}`)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Step 2: Measurable Metrics ─────────────────────────────────────────

function StepMetrics({
  category,
  baselineValue,
  targetValue,
  onBaselineChange,
  onTargetChange,
}: {
  category: HealthCategory;
  baselineValue: number;
  targetValue: number;
  onBaselineChange: (v: number) => void;
  onTargetChange: (v: number) => void;
}) {
  const t = useTranslations();

  const isScore = category === 'energy' || category === 'specific_illness';
  const min = isScore ? 1 : 0;
  const max = isScore ? 10 : 300;
  const step = isScore ? 1 : category === 'sleep' ? 0.5 : 1;

  return (
    <div className="grid gap-5">
      <p className="text-base font-semibold txt-strong">{t('healthWizard.step2Title')}</p>

      <label className="grid gap-2">
        <span className="field-label mb-0">{t(`healthWizard.metrics.${category}.baseline`)}</span>
        {isScore ? (
          <div className="grid gap-2">
            <span className="flex items-center justify-between gap-4">
              <span className="text-xs txt-muted">{t('healthWizard.low')}</span>
              <span className="rounded-full border border-[color:var(--color-border)] fill-2 px-4 py-1.5 text-sm font-semibold txt-strong">
                {baselineValue}/10
              </span>
              <span className="text-xs txt-muted">{t('healthWizard.high')}</span>
            </span>
            <input
              className="focus-ring"
              type="range"
              min={min}
              max={max}
              step={step}
              value={baselineValue}
              onChange={(e) => onBaselineChange(e.target.valueAsNumber)}
            />
          </div>
        ) : (
          <input
            className="focus-ring input-base"
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={baselineValue || ''}
            onChange={(e) => onBaselineChange(e.target.valueAsNumber)}
            placeholder={t(`healthWizard.metrics.${category}.baselinePlaceholder`)}
          />
        )}
      </label>

      <label className="grid gap-2">
        <span className="field-label mb-0">{t(`healthWizard.metrics.${category}.target`)}</span>
        {isScore ? (
          <div className="grid gap-2">
            <span className="flex items-center justify-between gap-4">
              <span className="text-xs txt-muted">{t('healthWizard.low')}</span>
              <span className="rounded-full border border-[color:var(--color-border)] fill-2 px-4 py-1.5 text-sm font-semibold txt-strong">
                {targetValue}/10
              </span>
              <span className="text-xs txt-muted">{t('healthWizard.high')}</span>
            </span>
            <input
              className="focus-ring"
              type="range"
              min={min}
              max={max}
              step={step}
              value={targetValue}
              onChange={(e) => onTargetChange(e.target.valueAsNumber)}
            />
          </div>
        ) : (
          <input
            className="focus-ring input-base"
            type="number"
            inputMode="decimal"
            min={min}
            max={max}
            step={step}
            value={targetValue || ''}
            onChange={(e) => onTargetChange(e.target.valueAsNumber)}
            placeholder={t(`healthWizard.metrics.${category}.targetPlaceholder`)}
          />
        )}
      </label>

      {(baselineValue > 0 || targetValue > 0) && (
        <div className="rounded-2xl border border-[color:var(--color-border)] fill-1 p-4">
          <div className="flex items-center justify-between gap-4">
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider txt-muted">
                {t('healthWizard.metricFrom')}
              </p>
              <p className="mt-1 text-2xl font-black txt-soft">
                {baselineValue}
                {isScore ? '/10' : ''}
              </p>
            </div>
            <div className="flex flex-1 flex-col items-center">
              <span className="text-xl text-[var(--blue)]" aria-hidden>
                →
              </span>
              <span className="mt-1 rounded-full bg-[rgba(26,109,255,0.16)] px-3 py-1 text-xs font-bold text-[var(--blue)]">
                {t('healthWizard.metricGap')}: {Math.abs(targetValue - baselineValue)}
              </span>
            </div>
            <div className="text-center">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-[var(--blue)]">
                {t('healthWizard.metricTo')}
              </p>
              <p className="mt-1 text-2xl font-black txt-strong">
                {targetValue}
                {isScore ? '/10' : ''}
              </p>
            </div>
          </div>
          <div className="mt-3 h-2 overflow-hidden rounded-full fill-3">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[color:var(--color-border-strong)] to-[var(--blue)] transition-all duration-500"
              style={{
                width: `${Math.min(100, isScore ? (targetValue / 10) * 100 : baselineValue > 0 ? Math.min(100, (Math.min(baselineValue, targetValue) / Math.max(baselineValue, targetValue)) * 100) : 50)}%`,
              }}
            />
          </div>
        </div>
      )}

      <p className="text-xs leading-5 txt-muted">
        {category === 'weight' && targetValue > baselineValue
          ? t('healthWizard.metrics.weight.hintGain')
          : category === 'weight' && targetValue < baselineValue
            ? t('healthWizard.metrics.weight.hintLoss')
            : t(`healthWizard.metrics.${category}.hint`)}
      </p>
    </div>
  );
}

// ── Step 3: Timeline & Milestones ──────────────────────────────────────

function MilestoneFields({
  day,
  isWeight,
  textValue,
  kgValue,
  onTextChange,
  onKgChange,
  placeholderKey,
  required,
}: {
  day: 30 | 60 | 90;
  isWeight: boolean;
  textValue: string;
  kgValue: string;
  onTextChange: (v: string) => void;
  onKgChange: (v: string) => void;
  placeholderKey: 'day30Placeholder' | 'day60Placeholder' | 'day90Placeholder';
  required?: boolean;
}) {
  const t = useTranslations();

  return (
    <label className="grid gap-2">
      <span className="field-label mb-0 flex items-center gap-2">
        <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[rgba(26,109,255,0.16)] text-xs font-bold text-[var(--blue)]">
          {day}
        </span>
        {t(`healthWizard.day${day}`)}
        {required && <span className="text-red-400">*</span>}
      </span>
      {isWeight ? (
        <input
          className="focus-ring input-base"
          type="number"
          inputMode="decimal"
          min={20}
          max={300}
          step={0.1}
          value={kgValue}
          aria-required={required}
          onChange={(e) => onKgChange(e.target.value)}
          placeholder={t('healthWizard.milestoneKgPlaceholder')}
        />
      ) : (
        <input
          className="focus-ring input-base"
          value={textValue}
          aria-required={required}
          onChange={(e) => onTextChange(e.target.value)}
          placeholder={t(`healthWizard.${placeholderKey}`)}
        />
      )}
    </label>
  );
}

function StepTimeline({
  category,
  milestone30,
  milestone60,
  milestone90,
  milestone30Kg,
  milestone60Kg,
  milestone90Kg,
  onMilestone30Change,
  onMilestone60Change,
  onMilestone90Change,
  onMilestone30KgChange,
  onMilestone60KgChange,
  onMilestone90KgChange,
  onInspireMilestones,
  inspiringMilestones,
}: {
  category: HealthCategory;
  milestone30: string;
  milestone60: string;
  milestone90: string;
  milestone30Kg: string;
  milestone60Kg: string;
  milestone90Kg: string;
  onMilestone30Change: (v: string) => void;
  onMilestone60Change: (v: string) => void;
  onMilestone90Change: (v: string) => void;
  onMilestone30KgChange: (v: string) => void;
  onMilestone60KgChange: (v: string) => void;
  onMilestone90KgChange: (v: string) => void;
  onInspireMilestones: () => void;
  inspiringMilestones: boolean;
}) {
  const t = useTranslations();
  const isWeight = category === 'weight';

  return (
    <div className="grid gap-5">
      <p className="text-base font-semibold txt-strong">{t('healthWizard.step3Title')}</p>
      <MilestonesWhyExplainer />
      <p className="text-sm text-[var(--muted)]">{t('healthWizard.step3Hint')}</p>
      <button
        type="button"
        className="focus-ring group flex w-full items-center justify-center gap-2 rounded-2xl border border-[var(--blue)]/40 bg-[rgba(26,109,255,0.12)] px-5 py-3.5 text-sm font-bold txt-strong transition hover:bg-[rgba(26,109,255,0.2)] disabled:opacity-60"
        disabled={inspiringMilestones}
        aria-busy={inspiringMilestones}
        onClick={onInspireMilestones}
      >
        {inspiringMilestones ? (
          <span
            aria-hidden
            className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-[color:var(--color-border-strong)] border-t-[color:var(--color-border-strong)]"
          />
        ) : (
          <span className="text-lg" aria-hidden />
        )}
        {inspiringMilestones ? t('domainWizard.inspiring') : t('domainWizard.inspireMilestones')}
      </button>

      <MilestoneFields
        day={30}
        isWeight={isWeight}
        textValue={milestone30}
        kgValue={milestone30Kg}
        onTextChange={onMilestone30Change}
        onKgChange={onMilestone30KgChange}
        placeholderKey="day30Placeholder"
        required
      />
      <MilestoneFields
        day={60}
        isWeight={isWeight}
        textValue={milestone60}
        kgValue={milestone60Kg}
        onTextChange={onMilestone60Change}
        onKgChange={onMilestone60KgChange}
        placeholderKey="day60Placeholder"
        required
      />
      <MilestoneFields
        day={90}
        isWeight={isWeight}
        textValue={milestone90}
        kgValue={milestone90Kg}
        onTextChange={onMilestone90Change}
        onKgChange={onMilestone90KgChange}
        placeholderKey="day90Placeholder"
      />
    </div>
  );
}

// ── Step 4: Deep Why (Simon Sinek) ─────────────────────────────────────

function StepDeepWhy({
  whyImportant,
  whyNow,
  whatLost,
  onWhyImportantChange,
  onWhyNowChange,
  onWhatLostChange,
}: {
  whyImportant: string;
  whyNow: string;
  whatLost: string;
  onWhyImportantChange: (v: string) => void;
  onWhyNowChange: (v: string) => void;
  onWhatLostChange: (v: string) => void;
}) {
  const t = useTranslations();
  const [subStep, setSubStep] = useState(0);

  const questions = [
    {
      label: t('healthWizard.whyImportant'),
      value: whyImportant,
      onChange: onWhyImportantChange,
      placeholder: t('healthWizard.whyImportantPlaceholder'),
      context: t('expandText.contextWhyImportant'),
    },
    {
      label: t('healthWizard.whyNow'),
      value: whyNow,
      onChange: onWhyNowChange,
      placeholder: t('healthWizard.whyNowPlaceholder'),
      context: t('expandText.contextWhyNow'),
    },
    {
      label: t('healthWizard.whatLost'),
      value: whatLost,
      onChange: onWhatLostChange,
      placeholder: t('healthWizard.whatLostPlaceholder'),
      context: t('expandText.contextWhatLost'),
    },
  ];

  const active = questions[subStep]!;

  return (
    <div className="grid gap-5">
      <p className="text-base font-semibold txt-strong">{t('healthWizard.step4Title')}</p>

      {/* Sub-step dots */}
      <div className="flex items-center gap-2">
        {questions.map((_, i) => (
          <button
            key={`substep-${i}`}
            type="button"
            aria-label={`${i + 1}`}
            aria-pressed={i === subStep}
            onClick={() => setSubStep(i)}
            className={`focus-ring h-2 rounded-full transition-all ${
              i === subStep ? 'w-8 bg-[var(--blue)]' : 'w-2 fill-3 hover:fill-3'
            }`}
          />
        ))}
        <span className="ms-auto text-xs font-semibold txt-muted">
          {t('healthWizard.whyMicroProgress', {current: subStep + 1, total: questions.length})}
        </span>
      </div>

      {/* One question at a time, with a gentle fade/slide on change */}
      <div key={subStep} className="animate-[whyfade_0.28s_ease-out]">
        <ExpandableTextarea
          label={active.label}
          value={active.value}
          onChange={active.onChange}
          placeholder={active.placeholder}
          context={active.context}
        />
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          className="focus-ring btn-ghost btn-small disabled:opacity-40"
          disabled={subStep === 0}
          onClick={() => setSubStep((s) => Math.max(0, s - 1))}
        >
          {t('healthWizard.back')}
        </button>
        {subStep < questions.length - 1 && (
          <button
            type="button"
            className="focus-ring btn-secondary btn-small"
            onClick={() => setSubStep((s) => Math.min(questions.length - 1, s + 1))}
          >
            {t('healthWizard.next')}
          </button>
        )}
      </div>

      <style>{`
        @keyframes whyfade {
          from { opacity: 0; transform: translateY(6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  );
}

// ── Step 5: Habit Stacking ─────────────────────────────────────────────

function StepHabitAnchor({
  anchorHabit,
  anchorTime,
  anchorCustomLabel,
  onAnchorHabitChange,
  onAnchorTimeChange,
  onAnchorCustomLabelChange,
}: {
  anchorHabit: HealthAnchorHabit | '';
  anchorTime: string;
  anchorCustomLabel: string;
  onAnchorHabitChange: (v: HealthAnchorHabit) => void;
  onAnchorTimeChange: (v: string) => void;
  onAnchorCustomLabelChange: (v: string) => void;
}) {
  const t = useTranslations();

  const COMMON_ANCHORS = [
    'morning_coffee',
    'commute',
    'before_shower',
    'before_sleep',
    'lunch_break',
    'after_kids_school',
    'before_evening_meal',
    'after_work',
    'custom',
  ] as const;

  return (
    <div className="grid gap-5">
      <p className="text-base font-semibold txt-strong">{t('healthWizard.step5Title')}</p>
      <p className="text-sm leading-6 text-[var(--muted)]">{t('healthWizard.step5Body')}</p>

      <div className="grid gap-3">
        <span className="field-label mb-0">{t('healthWizard.anchorHabit')}</span>
        <div className="flex flex-wrap gap-2">
          {COMMON_ANCHORS.map((anchor) => (
            <button
              key={anchor}
              type="button"
              className={`focus-ring rounded-full border px-4 py-2 text-sm font-semibold transition ${
                anchorHabit === anchor
                  ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                  : 'border-[color:var(--color-border)] fill-1 txt-soft'
              }`}
              onClick={() => onAnchorHabitChange(anchor)}
            >
              {t(`healthWizard.anchors.${anchor}`)}
            </button>
          ))}
        </div>
      </div>

      {anchorHabit === 'custom' && (
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('healthWizard.anchorCustom')}</span>
          <input
            className="focus-ring input-base"
            value={anchorCustomLabel}
            onChange={(e) => onAnchorCustomLabelChange(e.target.value)}
            placeholder={t('healthWizard.anchorCustomPlaceholder')}
          />
        </label>
      )}

      <div className="grid gap-2">
        <span className="field-label mb-0">{t('healthWizard.preferredTime')}</span>
        <CustomTimePicker value={anchorTime} onChange={onAnchorTimeChange} />
      </div>

      {anchorHabit && (
        <div className="rounded-2xl border border-[var(--blue)]/20 bg-[rgba(26,109,255,0.06)] p-4">
          <p className="text-sm font-semibold txt-strong">
            {t('healthWizard.habitFormula')}
          </p>
          <p className="mt-2 text-sm leading-6 text-[var(--muted)]">
            {t('healthWizard.habitFormulaTemplate', {
              anchor:
                anchorHabit === 'custom' && anchorCustomLabel
                  ? anchorCustomLabel
                  : t(`healthWizard.anchors.${anchorHabit}`),
            })}
          </p>
        </div>
      )}
    </div>
  );
}

// ── Helpers ─────────────────────────────────────────────────────────────

function buildRawGoalFromWizard(data: HealthGoalWizardData, t: ReturnType<typeof useTranslations>): string {
  const cat = t(`healthWizard.categories.${data.category}`);
  const baseline = data.metrics.baseline_value;
  const target = data.metrics.target_value;

  return `${cat}: ${t('healthWizard.goalTemplate', {
    category: cat,
    baseline: String(baseline),
    target: String(target),
  })}`;
}

function buildSuccessMetric(data: HealthGoalWizardData, t: ReturnType<typeof useTranslations>): string {
  const cat = t(`healthWizard.categories.${data.category}`);
  return `${cat}: ${data.metrics.baseline_value} → ${data.metrics.target_value} (${t('healthWizard.in90days')})`;
}

function buildDeadline(days: number): string {
  return addDaysYMD(todayYMD(), days);
}

function buildDeadline90(): string {
  return buildDeadline(90);
}
