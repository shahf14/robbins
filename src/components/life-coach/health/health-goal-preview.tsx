'use client';

import {useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import type {GoalRealismCheck, HealthExecutionPlan, HealthPlanSource, NextBestAction} from '@/lib/life-coach/types';
import {GoalRealismBanner} from '../goal-realism-banner';
import {GoalHierarchyExplainer} from '../shared/goal-hierarchy-explainer';
import {NextBestActionCta} from '@/components/next-best-action/next-best-action-cta';
import type {HealthWizardContextInput} from '@/lib/ai-life-coach/health-goal-fallback';

type SuggestedStep = {
  domain: 'health';
  goal_id: string | null;
  title: string;
  description: string;
  estimated_minutes: number;
  difficulty: 'easy' | 'medium' | 'hard';
};

type Milestone = {
  title: string;
  description: string;
  target_date: string | null;
};

export type HealthGoalPreviewData = {
  goal: {
    title?: string;
    description?: string;
    success_metric?: string;
    deadline?: string | null;
  };
  milestones: Milestone[];
  suggested_baby_steps: SuggestedStep[];
  execution_plan?: HealthExecutionPlan | null;
  plan_source?: HealthPlanSource;
  realism_check?: GoalRealismCheck | null;
  next_best_action?: NextBestAction | null;
};

type Props = {
  preview: HealthGoalPreviewData;
  wizardContext: HealthWizardContextInput;
  successMetric: string;
  onCancel: () => void;
  onSave: (input: {
    goal: {
      domain: 'health';
      title: string;
      description: string;
      success_metric: string;
      deadline: string | null;
      status: 'active';
      created_by: 'ai';
      health_context: import('@/lib/life-coach/types').HealthGoalContext;
    };
    milestones: Milestone[];
    initial_steps: SuggestedStep[];
  }) => Promise<void>;
};

export function HealthGoalPreview({preview, wizardContext, successMetric, onCancel, onSave}: Props) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const [goalTitle, setGoalTitle] = useState(preview.goal.title ?? '');
  const [goalDescription, setGoalDescription] = useState(preview.goal.description ?? '');
  const [metric, setMetric] = useState(successMetric);
  const [deadline, setDeadline] = useState(preview.goal.deadline ?? '');
  const [milestones, setMilestones] = useState(preview.milestones);
  const [steps, setSteps] = useState(preview.suggested_baby_steps);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const earlyPhases = preview.execution_plan?.phases?.slice(0, 2) ?? [];
  const planBadge =
    preview.plan_source === 'ai'
      ? t('healthWizard.planSourceAi')
      : t('healthWizard.planSourceFallback');

  async function handleSave() {
    setSaving(true);
    setSaveError(null);

    if (!goalTitle.trim() || !metric.trim()) {
      setSaveError(t('healthWizard.saveValidation'));
      setSaving(false);
      return;
    }

    try {
      const {wizardInputToHealthContext, buildDefaultExecutionPlan} = await import(
        '@/lib/ai-life-coach/health-goal-fallback'
      );
      const executionPlan =
        preview.execution_plan ?? buildDefaultExecutionPlan(wizardContext, locale);

      await onSave({
        goal: {
          domain: 'health',
          title: goalTitle.trim(),
          description: (goalDescription.trim() || goalTitle.trim()).slice(0, 4000),
          success_metric: metric.trim(),
          deadline: deadline || null,
          status: 'active',
          created_by: 'ai',
          health_context: wizardInputToHealthContext(
            wizardContext,
            executionPlan,
            preview.plan_source ?? 'fallback'
          ),
        },
        milestones,
        initial_steps: steps.map((step) => ({
          ...step,
          domain: 'health' as const,
          description: step.description?.trim() || t('healthWizard.defaultStepDescription'),
          estimated_minutes: Math.min(20, Math.max(5, Math.round(step.estimated_minutes))),
        })),
      });
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : t('healthWizard.createError'));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-surface p-6">
      <div className="flex flex-wrap items-center gap-2">
        <p className="eyebrow">{t('healthWizard.previewEyebrow')}</p>
        <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-xs font-semibold text-white/70">
          {planBadge}
        </span>
      </div>
      <h3 className="mt-4 text-2xl font-black text-white">{t('healthWizard.previewTitle')}</h3>

      <div className="mt-4">
        <GoalRealismBanner realismCheck={preview.realism_check} />
      </div>

      <GoalHierarchyExplainer className="mt-4" />

      <div className="mt-6 grid gap-5">
        <p className="field-label mb-0">
          {t('lifeCoach.goalHierarchyGoal')}
          <span className="font-normal text-white/40"> · {t('lifeCoach.goalHierarchyGoalRole')}</span>
        </p>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('lifeCoach.goalTitle')}</span>
          <input className="focus-ring input-base" value={goalTitle} onChange={(e) => setGoalTitle(e.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('lifeCoach.goalDescription')}</span>
          <textarea
            className="focus-ring textarea-base min-h-24"
            value={goalDescription}
            onChange={(e) => setGoalDescription(e.target.value)}
          />
        </label>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('lifeCoach.successMetric')}</span>
          <input className="focus-ring input-base" value={metric} onChange={(e) => setMetric(e.target.value)} />
        </label>

        {earlyPhases.length > 0 && (
          <div className="grid gap-3">
            <span className="field-label mb-0">{t('healthWizard.planPhasesTitle')}</span>
            {earlyPhases.map((phase) => (
              <div
                key={`${phase.start_day}-${phase.end_day}`}
                className="rounded-2xl border border-[var(--blue)]/20 bg-[rgba(26,109,255,0.06)] p-4"
              >
                <p className="text-sm font-semibold text-white">
                  {t('healthWizard.planPhaseRange', {
                    start: phase.start_day,
                    end: phase.end_day,
                  })}
                </p>
                <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{phase.focus}</p>
                <ul className="mt-3 grid gap-1 text-sm text-white/72">
                  {phase.task_templates.slice(0, 3).map((task) => (
                    <li key={task.title}>• {task.title}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        <div className="grid gap-3">
          <span className="field-label mb-0">
            {t('lifeCoach.dailyBabySteps')}
            <span className="font-normal text-white/40"> · {t('lifeCoach.goalHierarchyDailyStepRole')}</span>
          </span>
          {steps.map((step, index) => (
            <div key={`${step.title}-${index}`} className="rounded-[18px] border border-white/10 bg-white/3 p-4">
              <input
                className="focus-ring input-base"
                value={step.title}
                onChange={(e) => {
                  const next = [...steps];
                  next[index] = {...step, title: e.target.value};
                  setSteps(next);
                }}
              />
              <textarea
                className="focus-ring textarea-base mt-3 min-h-20"
                value={step.description}
                onChange={(e) => {
                  const next = [...steps];
                  next[index] = {...step, description: e.target.value};
                  setSteps(next);
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {saveError && (
        <p className="mt-4 text-sm font-medium text-red-400" role="alert">
          {saveError}
        </p>
      )}

      {preview.next_best_action ? (
        <div className="mt-6">
          <NextBestActionCta
            action={preview.next_best_action}
            onCustomAction={(action) => {
              if (action.action_type === 'save_goal') void handleSave();
            }}
          />
        </div>
      ) : null}

      <div className="mt-6 flex flex-wrap gap-3">
        <button
          className="focus-ring btn-primary"
          type="button"
          disabled={saving}
          aria-busy={saving}
          onClick={() => void handleSave()}
        >
          {saving ? t('lifeCoach.saving') : t('healthWizard.confirmCreate')}
        </button>
        <button className="focus-ring btn-ghost" type="button" onClick={onCancel}>
          {t('lifeCoach.cancel')}
        </button>
      </div>
    </section>
  );
}
