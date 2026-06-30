'use client';

import {useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useToast} from '@/components/feedback/toast-provider';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import {resolveLifeCoachErrorMessage} from '@/lib/life-coach/api-error';
import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';
import {
  DAILY_STEP_DIFFICULTIES,
  DAILY_STEP_STATUSES,
  LIFE_DOMAINS,
  type DailyStepDifficulty,
  type DailyStepStatus,
  type LifeDomain,
} from '@/lib/life-coach/types';

type Draft = {
  title: string;
  description: string;
  domain: LifeDomain;
  scheduled_date: string;
  estimated_minutes: number;
  difficulty: DailyStepDifficulty;
  status: DailyStepStatus;
};

type Props = {
  domain: LifeDomain;
  steps: DailyBabyStepResponse[];
  onChanged: () => Promise<void>;
};

export function GeneralDailyStepsManager({domain, steps, onChanged}: Props) {
  const t = useTranslations();
  const tSimple = useTranslations('simpleTasks');
  const toast = useToast();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const generalSteps = useMemo(
    () =>
      steps
        .filter((step) => step.domain === domain && step.is_general && !step.goal_id)
        .sort((a, b) =>
          b.scheduled_date.localeCompare(a.scheduled_date) || b.created_at.localeCompare(a.created_at)
        )
        .slice(0, 12),
    [domain, steps]
  );

  function beginEdit(step: DailyBabyStepResponse) {
    setEditingId(step.id);
    setDraft({
      title: step.title,
      description: step.description ?? '',
      domain: step.domain,
      scheduled_date: step.scheduled_date,
      estimated_minutes: step.estimated_minutes,
      difficulty: step.difficulty,
      status: step.status,
    });
  }

  function updateDraft(patch: Partial<Draft>) {
    setDraft((current) => (current ? {...current, ...patch} : current));
  }

  async function save(stepId: string) {
    if (!draft || saving) return;
    setSaving(true);
    try {
      await lifeCoachApi.updateDailyStep(stepId, {
        ...draft,
        goal_id: null,
        is_general: true,
      });
      setEditingId(null);
      setDraft(null);
      await onChanged();
      toast.success(t('feedback.saved'));
    } catch (error) {
      toast.error(resolveLifeCoachErrorMessage(error, t));
    } finally {
      setSaving(false);
    }
  }

  async function remove(stepId: string) {
    if (!window.confirm(tSimple('generalManager.deleteConfirm'))) return;
    try {
      await lifeCoachApi.deleteDailyStep(stepId);
      await onChanged();
      toast.success(t('feedback.saved'));
    } catch (error) {
      toast.error(resolveLifeCoachErrorMessage(error, t));
    }
  }

  return (
    <section className="panel-surface p-5 sm:p-6" aria-label={tSimple('generalManager.title')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{tSimple('generalManager.eyebrow')}</p>
          <h2 className="mt-2 text-lg font-bold txt-strong">{tSimple('generalManager.title')}</h2>
          <p className="mt-1 max-w-2xl text-sm leading-7 txt-muted">
            {tSimple('generalManager.body')}
          </p>
        </div>
        <span className="rounded-full border border-[color:var(--color-border)] px-3 py-1 text-xs font-semibold txt-muted">
          {tSimple('generalManager.count', {count: generalSteps.length})}
        </span>
      </div>

      {generalSteps.length === 0 ? (
        <p className="mt-5 text-sm leading-7 txt-muted">{tSimple('generalManager.empty')}</p>
      ) : (
        <div className="mt-5 grid gap-3">
          {generalSteps.map((step) => {
            const isEditing = editingId === step.id && draft;
            return (
              <article
                key={step.id}
                className="rounded-xl border border-[color:var(--color-border)] fill-1 p-4"
              >
                {!isEditing ? (
                  <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-start">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-bold txt-strong">{step.title}</h3>
                        <span className="rounded-full bg-[var(--blue)]/10 px-2 py-0.5 text-xs font-semibold text-[var(--blue)]">
                          {tSimple('generalManager.generalBadge')}
                        </span>
                      </div>
                      {step.description && (
                        <p className="mt-1 text-sm leading-6 txt-muted">{step.description}</p>
                      )}
                      <p className="mt-2 text-xs font-semibold txt-muted">
                        {t(`lifeCoach.domains.${step.domain}.short`)} · {step.scheduled_date} ·{' '}
                        {step.estimated_minutes}m · {t(`lifeCoach.difficulty.${step.difficulty}`)} ·{' '}
                        {t(`lifeCoach.dailyStepStatus.${step.status}`)}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="focus-ring btn-secondary"
                        onClick={() => beginEdit(step)}
                      >
                        {tSimple('generalManager.edit')}
                      </button>
                      <button
                        type="button"
                        className="focus-ring btn-ghost text-red-600"
                        onClick={() => void remove(step.id)}
                      >
                        {tSimple('delete')}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <label className="grid gap-2">
                        <span className="field-label mb-0">{tSimple('generalManager.titleLabel')}</span>
                        <input
                          className="focus-ring input-base"
                          value={draft.title}
                          maxLength={180}
                          onChange={(e) => updateDraft({title: e.target.value})}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="field-label mb-0">{tSimple('generalManager.domainLabel')}</span>
                        <select
                          className="focus-ring input-base"
                          value={draft.domain}
                          onChange={(e) => updateDraft({domain: e.target.value as LifeDomain})}
                        >
                          {LIFE_DOMAINS.map((item) => (
                            <option key={item} value={item}>
                              {t(`lifeCoach.domains.${item}.short`)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <label className="grid gap-2">
                      <span className="field-label mb-0">{tSimple('generalManager.descriptionLabel')}</span>
                      <textarea
                        className="focus-ring input-base min-h-24"
                        value={draft.description}
                        maxLength={1000}
                        onChange={(e) => updateDraft({description: e.target.value})}
                      />
                    </label>

                    <div className="grid gap-3 md:grid-cols-4">
                      <label className="grid gap-2">
                        <span className="field-label mb-0">{tSimple('generalManager.dateLabel')}</span>
                        <input
                          type="date"
                          className="focus-ring input-base"
                          value={draft.scheduled_date}
                          onChange={(e) => updateDraft({scheduled_date: e.target.value})}
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="field-label mb-0">{tSimple('generalManager.minutesLabel')}</span>
                        <input
                          type="number"
                          min={1}
                          max={60}
                          className="focus-ring input-base"
                          value={draft.estimated_minutes}
                          onChange={(e) =>
                            updateDraft({
                              estimated_minutes: Math.max(1, Math.min(60, e.target.valueAsNumber || 1)),
                            })
                          }
                        />
                      </label>
                      <label className="grid gap-2">
                        <span className="field-label mb-0">{tSimple('generalManager.difficultyLabel')}</span>
                        <select
                          className="focus-ring input-base"
                          value={draft.difficulty}
                          onChange={(e) => updateDraft({difficulty: e.target.value as DailyStepDifficulty})}
                        >
                          {DAILY_STEP_DIFFICULTIES.map((item) => (
                            <option key={item} value={item}>
                              {t(`lifeCoach.difficulty.${item}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="grid gap-2">
                        <span className="field-label mb-0">{tSimple('generalManager.statusLabel')}</span>
                        <select
                          className="focus-ring input-base"
                          value={draft.status}
                          onChange={(e) => updateDraft({status: e.target.value as DailyStepStatus})}
                        >
                          {DAILY_STEP_STATUSES.map((item) => (
                            <option key={item} value={item}>
                              {t(`lifeCoach.dailyStepStatus.${item}`)}
                            </option>
                          ))}
                        </select>
                      </label>
                    </div>

                    <div className="flex flex-wrap justify-end gap-2">
                      <button
                        type="button"
                        className="focus-ring btn-ghost"
                        onClick={() => {
                          setEditingId(null);
                          setDraft(null);
                        }}
                      >
                        {tSimple('cancel')}
                      </button>
                      <button
                        type="button"
                        className="focus-ring btn-primary disabled:opacity-60"
                        disabled={saving || draft.title.trim().length === 0}
                        aria-busy={saving}
                        onClick={() => void save(step.id)}
                      >
                        {saving ? tSimple('generalManager.saving') : tSimple('generalManager.save')}
                      </button>
                    </div>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
