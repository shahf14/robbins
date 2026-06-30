'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {FormulationInsightsPanel} from '@/components/formulation/formulation-insights-panel';
import {splitCommaList} from '@/lib/formulation/formulation-utils';
import type {MicroGoalOption} from '@/lib/formulation/micro-goal-options';
import {burningFocusHeadline} from '@/lib/formulation/micro-goal-options';
import type {MicroGoalSuggestion} from '@/lib/ai-formulation/prompts';
import type {FormulationSessionResponse} from '@/lib/life-coach/response-dtos';
import type {CoachHandoff} from '@/lib/life-coach/types';

type Props = {
  loading: boolean;
  session: FormulationSessionResponse;
  onSuggest: () => Promise<MicroGoalSuggestion>;
  onSubmit: (handoff: CoachHandoff) => void;
};

function applyOption(
  option: MicroGoalOption,
  setters: {
    setValue: (v: string) => void;
    setGoal: (v: string) => void;
    setBarrier: (v: string) => void;
    setPlanB: (v: string) => void;
    setSelectedId: (id: string) => void;
  }
) {
  setters.setSelectedId(option.id);
  setters.setValue(option.value);
  setters.setGoal(option.micro_goal_week);
  setters.setBarrier(option.anticipated_barrier);
  setters.setPlanB(option.plan_b);
}

export function MicroGoalStep({loading, session, onSuggest, onSubmit}: Props) {
  const t = useTranslations('formulation');
  const locale = useLocale() as AppLocale;
  const defaultBurningFocus = useMemo(
    () => burningFocusHeadline(session, locale),
    [session, locale]
  );
  const [burningFocus, setBurningFocus] = useState(defaultBurningFocus);
  const [generatedBy, setGeneratedBy] = useState<'llm' | 'fallback' | null>(null);
  const [value, setValue] = useState('');
  const [goal, setGoal] = useState('');
  const [barrier, setBarrier] = useState('');
  const [planB, setPlanB] = useState('');
  const [doNotTouch, setDoNotTouch] = useState('');
  const [goalOptions, setGoalOptions] = useState<MicroGoalOption[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [optionsError, setOptionsError] = useState<string | null>(null);

  const loadOptions = useCallback(async () => {
    setAiLoading(true);
    setOptionsError(null);
    try {
      const s = await onSuggest();
      const options = (s.goal_options ?? []) as MicroGoalOption[];
      if (s.generated_by !== 'llm' || options.length !== 5) {
        setGoalOptions([]);
        setGeneratedBy(null);
        setOptionsError(t('microGoal.llmRequired'));
        return;
      }
      if (s.burning_focus) setBurningFocus(s.burning_focus);
      setGeneratedBy('llm');
      setGoalOptions(options);
      const pick = options.find((o) => o.goal_type === 'practical') ?? options[0]!;
      applyOption(pick, {
        setValue,
        setGoal,
        setBarrier,
        setPlanB,
        setSelectedId,
      });
    } catch (e) {
      setGoalOptions([]);
      setGeneratedBy(null);
      setOptionsError(e instanceof Error ? e.message : t('microGoal.optionsError'));
    } finally {
      setAiLoading(false);
    }
  }, [onSuggest, t]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadOptions(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadOptions]);

  return (
    <div className="grid gap-4">
      <FormulationInsightsPanel session={session} />

      <div className="rounded-xl border border-[var(--blue)]/25 bg-[rgba(26,109,255,0.08)] px-4 py-3">
        <p className="text-xs font-bold uppercase tracking-wide txt-muted">
          {t('microGoal.burningThisWeek')}
        </p>
        <p className="mt-1 text-sm font-semibold leading-snug txt-strong">{burningFocus}</p>
        {generatedBy === 'llm' && (
          <p className="mt-2 text-[10px] txt-muted">{t('microGoal.llmGenerated')}</p>
        )}
      </div>

      <div className="grid gap-2">
        <p className="text-sm font-semibold txt-strong">{t('microGoal.pickOneOfFive')}</p>
        {aiLoading && goalOptions.length === 0 && (
          <p className="text-xs txt-muted" aria-live="polite">{t('microGoal.loadingOptions')}</p>
        )}
        {optionsError && <p className="text-xs text-amber-300/90" role="alert">{optionsError}</p>}
        <div className="grid gap-2">
          {goalOptions.map((option) => {
            const selected = selectedId === option.id;
            return (
              <button
                key={option.id}
                type="button"
                aria-pressed={selected}
                className={`focus-ring rounded-xl border px-4 py-3 text-start transition ${
                  selected
                    ? 'border-[var(--blue)] bg-[var(--blue)]/20 shadow-[0_0_0_1px_rgba(26,109,255,0.35)]'
                    : 'border-[color:var(--color-border)] fill-1 hover:border-[color:var(--color-border-strong)]'
                }`}
                onClick={() =>
                  applyOption(option, {
                    setValue,
                    setGoal,
                    setBarrier,
                    setPlanB,
                    setSelectedId,
                  })
                }
              >
                <p className="text-sm font-semibold txt-strong">{option.title}</p>
                <p className="mt-1 text-xs leading-relaxed txt-soft">
                  {option.micro_goal_week}
                </p>
                {option.goal_type === 'mindset' && option.why_this_exercise && (
                  <p className="mt-2 text-[11px] leading-relaxed text-[var(--blue)]/85">
                    {t('microGoal.whyThisExercise', {reason: option.why_this_exercise})}
                  </p>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <label className="grid gap-2">
        <span className="field-label mb-0">{t('microGoal.value')}</span>
        <input
          className="focus-ring input-base"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder={t('microGoal.valuePlaceholder')}
        />
      </label>
      <label className="grid gap-2">
        <span className="field-label mb-0">{t('microGoal.goal')}</span>
        <textarea
          className="focus-ring textarea-base min-h-20"
          value={goal}
          onChange={(e) => setGoal(e.target.value)}
          placeholder={t('microGoal.goalPlaceholder')}
        />
      </label>
      <label className="grid gap-2">
        <span className="field-label mb-0">{t('microGoal.barrier')}</span>
        <input
          className="focus-ring input-base"
          value={barrier}
          onChange={(e) => setBarrier(e.target.value)}
          placeholder={t('microGoal.barrierPlaceholder')}
        />
      </label>
      <label className="grid gap-2">
        <span className="field-label mb-0">{t('microGoal.planB')}</span>
        <input
          className="focus-ring input-base"
          value={planB}
          onChange={(e) => setPlanB(e.target.value)}
        />
      </label>
      <label className="grid gap-2">
        <span className="field-label mb-0">{t('microGoal.doNotTouch')}</span>
        <input
          className="focus-ring input-base"
          value={doNotTouch}
          onChange={(e) => setDoNotTouch(e.target.value)}
          placeholder={t('microGoal.doNotTouchPlaceholder')}
        />
      </label>

      <button
        className="focus-ring btn-ghost text-xs"
        type="button"
        disabled={aiLoading}
        aria-busy={aiLoading}
        onClick={() => void loadOptions()}
      >
        {aiLoading ? t('aiWorking') : t('microGoal.refreshOptions')}
      </button>

      <button
        className="focus-ring btn-primary"
        type="button"
        disabled={loading || !value.trim() || !goal.trim()}
        aria-busy={loading}
        onClick={() =>
          onSubmit({
            value: value.trim(),
            micro_goal_week: goal.trim(),
            anticipated_barrier: barrier.trim(),
            plan_b: planB.trim(),
            do_not_touch: splitCommaList(doNotTouch),
          })
        }
      >
        {loading ? t('saving') : t('save')}
      </button>
    </div>
  );
}
