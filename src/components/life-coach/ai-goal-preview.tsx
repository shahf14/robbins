'use client';

import {useRef, useState} from 'react';
import {useTranslations} from 'next-intl';
import type {GoalRealismCheck, LifeDomain, NextBestAction} from '@/lib/life-coach/types';
import {GoalRealismBanner} from './goal-realism-banner';
import {NextBestActionCta} from '@/components/next-best-action/next-best-action-cta';
import {GoalHierarchyExplainer} from './shared/goal-hierarchy-explainer';

type SuggestedStep = {
  domain: LifeDomain;
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

type Props = {
  domain: LifeDomain;
  preview: {
    goal: {
      title?: string;
      domain_category?: string | null;
      description?: string;
      success_metric?: string;
      deadline?: string | null;
      created_by?: 'ai' | 'user';
    };
    milestones: Milestone[];
    suggested_baby_steps: SuggestedStep[];
    realism_check?: GoalRealismCheck | null;
    next_best_action?: NextBestAction | null;
  };
  onCancel: () => void;
  onSave: (input: {
    goal: {
      domain: LifeDomain;
      domain_category?: string | null;
      title: string;
      description: string;
      success_metric: string;
      deadline: string | null;
      status: 'active';
      created_by: 'ai';
    };
    milestones: Milestone[];
    initial_steps: SuggestedStep[];
  }) => Promise<void>;
};

export function AIGoalPreview({domain, preview, onCancel, onSave}: Props) {
  const t = useTranslations();
  const [goalTitle, setGoalTitle] = useState(preview.goal.title ?? '');
  const [goalDescription, setGoalDescription] = useState(preview.goal.description ?? '');
  const [successMetric, setSuccessMetric] = useState(preview.goal.success_metric ?? '');
  const [deadline, setDeadline] = useState(preview.goal.deadline ?? '');
  const milestoneKeyRef = useRef(preview.milestones.length);
  const [milestones, setMilestones] = useState(() =>
    preview.milestones.map((m, index) => ({...m, _key: index}))
  );
  const stepKeyRef = useRef(preview.suggested_baby_steps.length);
  const [steps, setSteps] = useState(() =>
    preview.suggested_baby_steps.map((s, index) => ({...s, _key: index}))
  );
  const [saving, setSaving] = useState(false);
  const firstMilestone = milestones[0] ?? null;
  const firstSteps = steps.slice(0, 3);

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        goal: {
          domain,
          domain_category: preview.goal.domain_category ?? null,
          title: goalTitle,
          description: goalDescription,
          success_metric: successMetric,
          deadline: deadline || null,
          status: 'active',
          created_by: 'ai',
        },
        milestones: milestones.map(({_key, ...m}) => m),
        initial_steps: steps.map(({_key, ...s}) => s),
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel-surface p-6" aria-label={t('lifeCoach.aiPreviewTitle')}>
      <p className="eyebrow" aria-hidden="true">{t('lifeCoach.aiPreview')}</p>
      <h3 className="mt-4 text-2xl font-black text-white">{t('lifeCoach.aiPreviewTitle')}</h3>

      <div className="mt-4">
        <GoalRealismBanner realismCheck={preview.realism_check} />
      </div>

      <GoalHierarchyExplainer className="mt-4" />

      <div className="mt-4 rounded-[20px] border border-[var(--blue)]/25 bg-[var(--blue)]/6 p-4">
        <p className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]">
          {t('lifeCoach.executionPreview.eyebrow')}
        </p>
        <div className="mt-3 grid gap-3 md:grid-cols-3">
          <ExecutionPreviewItem
            label={t('lifeCoach.executionPreview.vision')}
            value={goalTitle || t('lifeCoach.executionPreview.emptyVision')}
          />
          <ExecutionPreviewItem
            label={t('lifeCoach.executionPreview.firstMilestone')}
            value={firstMilestone?.title || t('lifeCoach.executionPreview.emptyMilestone')}
          />
          <ExecutionPreviewItem
            label={t('lifeCoach.executionPreview.firstSteps')}
            value={
              firstSteps.length > 0
                ? firstSteps.map((step) => step.title).join(' / ')
                : t('lifeCoach.executionPreview.emptySteps')
            }
          />
        </div>
      </div>

      <div className="mt-6 grid gap-5">
        <p className="field-label mb-0">
          {t('lifeCoach.goalHierarchyGoal')}
          <span className="font-normal text-white/40"> · {t('lifeCoach.goalHierarchyGoalRole')}</span>
        </p>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('lifeCoach.goalTitle')}</span>
          <input className="focus-ring input-base" value={goalTitle} onChange={(event) => setGoalTitle(event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('lifeCoach.goalDescription')}</span>
          <textarea className="focus-ring textarea-base min-h-28" value={goalDescription} onChange={(event) => setGoalDescription(event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('lifeCoach.successMetric')}</span>
          <input className="focus-ring input-base" value={successMetric} onChange={(event) => setSuccessMetric(event.target.value)} />
        </label>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('lifeCoach.deadline')}</span>
          <input className="focus-ring input-base" type="date" value={deadline || ''} onChange={(event) => setDeadline(event.target.value)} />
        </label>

        <div className="grid gap-3" role="group" aria-label={t('lifeCoach.milestones')}>
          <span className="field-label mb-0" aria-hidden="true">{t('lifeCoach.milestones')}</span>
          {milestones.map((milestone, index) => (
            <div key={milestone._key} className="rounded-[18px] border border-white/10 bg-white/3 p-4">
              <div className="flex items-center gap-2">
                <input
                  className="focus-ring input-base flex-1"
                  aria-label={t('lifeCoach.goalTitle')}
                  value={milestone.title}
                  onChange={(event) => {
                    const next = [...milestones];
                    next[index] = {...milestone, title: event.target.value};
                    setMilestones(next);
                  }}
                />
                <button
                  type="button"
                  className="focus-ring shrink-0 rounded-lg border border-white/10 px-2 py-1.5 text-sm text-white/60 transition hover:text-white disabled:opacity-30"
                  disabled={index === 0}
                  aria-label={t('lifeCoach.moveUp')}
                  onClick={() => {
                    const next = [...milestones];
                    [next[index - 1], next[index]] = [next[index]!, next[index - 1]!];
                    setMilestones(next);
                  }}
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="focus-ring shrink-0 rounded-lg border border-white/10 px-2 py-1.5 text-sm text-white/60 transition hover:text-white disabled:opacity-30"
                  disabled={index === milestones.length - 1}
                  aria-label={t('lifeCoach.moveDown')}
                  onClick={() => {
                    const next = [...milestones];
                    [next[index], next[index + 1]] = [next[index + 1]!, next[index]!];
                    setMilestones(next);
                  }}
                >
                  ↓
                </button>
                <button
                  type="button"
                  className="focus-ring shrink-0 rounded-lg border border-red-400/20 px-2 py-1.5 text-sm text-red-300/80 transition hover:bg-red-400/10 hover:text-red-200"
                  aria-label={t('lifeCoach.deleteMilestone')}
                  onClick={() => setMilestones(milestones.filter((_, i) => i !== index))}
                >
                  &times;
                </button>
              </div>
              <textarea
                className="focus-ring textarea-base mt-3 min-h-20"
                value={milestone.description}
                onChange={(event) => {
                  const next = [...milestones];
                  next[index] = {...milestone, description: event.target.value};
                  setMilestones(next);
                }}
              />
            </div>
          ))}
          <button
            type="button"
            className="focus-ring btn-ghost self-start"
            onClick={() => setMilestones([...milestones, {title: '', description: '', target_date: deadline || null, _key: milestoneKeyRef.current++}])}
          >
            + {t('lifeCoach.addMilestone')}
          </button>
        </div>

        <div className="grid gap-3">
          <span className="field-label mb-0">
            {t('lifeCoach.dailyBabySteps')}
            <span className="font-normal text-white/40"> · {t('lifeCoach.goalHierarchyDailyStepRole')}</span>
          </span>
          {steps.map((step, index) => (
            <div key={step._key} className="rounded-[18px] border border-white/10 bg-white/3 p-4">
              <input
                className="focus-ring input-base"
                value={step.title}
                onChange={(event) => {
                  const next = [...steps];
                  next[index] = {...step, title: event.target.value};
                  setSteps(next);
                }}
              />
              <textarea
                className="focus-ring textarea-base mt-3 min-h-20"
                value={step.description}
                onChange={(event) => {
                  const next = [...steps];
                  next[index] = {...step, description: event.target.value};
                  setSteps(next);
                }}
              />
            </div>
          ))}
        </div>
      </div>

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
          {saving ? t('lifeCoach.saving') : t('lifeCoach.saveGoal')}
        </button>
        <button className="focus-ring btn-ghost" type="button" onClick={onCancel}>
          {t('lifeCoach.cancel')}
        </button>
      </div>
    </section>
  );
}

function ExecutionPreviewItem({label, value}: {label: string; value: string}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-black/10 px-4 py-3">
      <p className="text-[10px] font-bold uppercase tracking-widest text-white/40">{label}</p>
      <p className="mt-2 text-sm font-semibold leading-6 text-white/82">{value}</p>
    </div>
  );
}
