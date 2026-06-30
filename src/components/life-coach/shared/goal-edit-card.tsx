'use client';

import {useState, useEffect, useMemo} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import type {GoalResponse, DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';
import {useConfirm} from '@/components/feedback/confirm-provider';
import {useToast} from '@/components/feedback/toast-provider';
import {BusyButton} from '@/components/feedback/busy-button';
import {CommitmentLadderCard} from '@/components/behavior-science/behavior-panels';
import {
  commitmentProgress,
  isCommitmentEnded,
  isWithinCommitment,
  resolveCommitmentDays,
} from '@/lib/behavior-science/goal-commitment';
import {deriveLadderStage, ladderTarget} from '@/lib/behavior-science/commitment-ladder';
import {computeWeeklyBehaviorScore} from '@/lib/behavior-science/behavior-score';
import {formatYmdLocale} from '@/lib/date-utils';

type Props = {
  goal: GoalResponse;
  onChanged: () => Promise<void> | void;
  weekSteps?: DailyBabyStepResponse[];
};

/**
 * Active goal card with inline edit (title / description / success metric),
 * server-backed commitment window, and delete.
 */
export function GoalEditCard({goal, onChanged, weekSteps = []}: Props) {
  const t = useTranslations();
  const tBs = useTranslations('behaviorScience');
  const locale = useLocale();
  const toast = useToast();
  const {confirm} = useConfirm();

  const progress = useMemo(() => commitmentProgress(goal), [goal]);
  const commitmentEnded = isCommitmentEnded(goal);
  const withinCommitment = isWithinCommitment(goal);
  const savedDays = resolveCommitmentDays(goal);

  const [draftDays, setDraftDays] = useState(savedDays);
  const [commitmentDirty, setCommitmentDirty] = useState(false);
  const [commitmentSaving, setCommitmentSaving] = useState(false);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      setDraftDays(savedDays);
      setCommitmentDirty(false);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [goal.id, savedDays, goal.commitment_started_at]);

  const weeklyShowUps = computeWeeklyBehaviorScore(
    weekSteps.filter((s) => s.goal_id === goal.id)
  ).showUps;
  const ladderStage = deriveLadderStage(
    goal.commitment_started_at ?? goal.created_at,
    weeklyShowUps,
    progress.currentDay
  );
  const ladder = ladderTarget(ladderStage);

  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(goal.title);
  const [description, setDescription] = useState(goal.description ?? '');
  const [successMetric, setSuccessMetric] = useState(goal.success_metric ?? '');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startLabel = formatYmdLocale(progress.start, locale);
  const endLabel = formatYmdLocale(progress.end, locale);

  async function saveCommitment() {
    if (draftDays < 7 || draftDays > 90) return;
    setCommitmentSaving(true);
    setError(null);
    try {
      await lifeCoachApi.updateGoal(goal.id, {commitment_days: draftDays});
      setCommitmentDirty(false);
      await onChanged();
      toast.success(t('feedback.saved'));
    } catch {
      setError(t('lifeCoach.goalEditError'));
      toast.error(t('feedback.failed'));
    } finally {
      setCommitmentSaving(false);
    }
  }

  async function renewCommitment() {
    setCommitmentSaving(true);
    setError(null);
    try {
      await lifeCoachApi.updateGoal(goal.id, {
        commitment_days: draftDays,
        renew_commitment: true,
      });
      setCommitmentDirty(false);
      await onChanged();
      toast.success(t('behaviorScience.selfContract.renewedToast'));
    } catch {
      setError(t('lifeCoach.goalEditError'));
      toast.error(t('feedback.failed'));
    } finally {
      setCommitmentSaving(false);
    }
  }

  async function save() {
    if (!title.trim()) {
      setError(t('lifeCoach.goalEditValidation'));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await lifeCoachApi.updateGoal(goal.id, {
        title: title.trim(),
        description: description.trim(),
        success_metric: successMetric.trim(),
      });
      setEditing(false);
      await onChanged();
      toast.success(t('feedback.saved'));
    } catch {
      setError(t('lifeCoach.goalEditError'));
      toast.error(t('feedback.failed'));
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    const ok = await confirm({
      message: t('lifeCoach.deleteGoalConfirm'),
      destructive: true,
      confirmLabel: t('lifeCoach.deleteGoal'),
    });
    if (!ok) return;
    setSaving(true);
    setError(null);
    try {
      await lifeCoachApi.deleteGoal(goal.id);
      await onChanged();
      toast.success(t('feedback.saved'));
    } catch {
      setError(t('lifeCoach.goalEditError'));
      toast.error(t('feedback.failed'));
    } finally {
      setSaving(false);
    }
  }

  async function setStatus(status: 'active' | 'completed') {
    if (status === 'completed') {
      const ok = await confirm({
        message: t('lifeCoach.completeGoalConfirm'),
        confirmLabel: t('lifeCoach.completeGoal'),
      });
      if (!ok) return;
    }
    setSaving(true);
    setError(null);
    try {
      await lifeCoachApi.updateGoal(goal.id, {status});
      await onChanged();
      toast.success(t('feedback.completed'));
    } catch {
      setError(t('lifeCoach.goalEditError'));
      toast.error(t('feedback.failed'));
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <article className="rounded-[20px] border border-[var(--blue)]/30 bg-[rgba(26,109,255,0.05)] p-5" aria-label={title || t('lifeCoach.goalTitle')}>
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('lifeCoach.goalTitle')}</span>
          <input className="focus-ring input-base" value={title} onChange={(e) => setTitle(e.target.value)} />
        </label>
        <label className="mt-3 grid gap-2">
          <span className="field-label mb-0">{t('lifeCoach.goalDescription')}</span>
          <textarea
            className="focus-ring textarea-base min-h-20"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className="mt-3 grid gap-2">
          <span className="field-label mb-0">{t('lifeCoach.successMetric')}</span>
          <input className="focus-ring input-base" value={successMetric} onChange={(e) => setSuccessMetric(e.target.value)} />
        </label>
        {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
        <div className="mt-4 flex flex-wrap gap-2">
          <button type="button" className="focus-ring btn-primary" disabled={saving} aria-busy={saving} onClick={save}>
            {saving ? t('lifeCoach.saving') : t('lifeCoach.saveGoal')}
          </button>
          <button
            type="button"
            className="focus-ring btn-ghost"
            disabled={saving}
            onClick={() => {
              setTitle(goal.title);
              setDescription(goal.description ?? '');
              setSuccessMetric(goal.success_metric ?? '');
              setError(null);
              setEditing(false);
            }}
          >
            {t('lifeCoach.cancel')}
          </button>
        </div>
      </article>
    );
  }

  return (
    <article className="rounded-[20px] border border-[color:var(--color-border)] fill-1 p-5" aria-label={goal.title}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-lg font-black txt-strong">{goal.title}</h3>
          {goal.status === 'completed' ? (
            <span className="mt-2 inline-flex rounded-full border border-emerald-500/25 bg-emerald-500/10 px-2.5 py-1 text-xs font-bold text-emerald-300">
              {t('lifeCoach.goalCompleted')}
            </span>
          ) : null}
        </div>
        <div className="flex shrink-0 gap-2">
          <button
            type="button"
            className="focus-ring rounded-lg border border-[color:var(--color-border)] px-3 py-1.5 text-xs font-semibold txt-soft transition hover:txt-strong"
            onClick={() => setEditing(true)}
          >
            {t('lifeCoach.editGoal')}
          </button>
          <button
            type="button"
            className="focus-ring rounded-lg border border-red-400/20 px-3 py-1.5 text-xs font-semibold text-red-300/80 transition hover:bg-red-400/10 hover:text-red-200"
            disabled={saving}
            aria-busy={saving}
            onClick={remove}
          >
            {t('lifeCoach.deleteGoal')}
          </button>
        </div>
      </div>
      <p className="mt-3 text-sm leading-7 text-[var(--muted)]">{goal.description}</p>
      {goal.status === 'active' && (
        <div className="mt-4 space-y-3">
          <div className="rounded-xl border border-violet-400/20 bg-violet-500/6 px-4 py-3">
            <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-violet-300/80">
              {tBs('selfContract.title')}
            </p>
            <p className="mt-1.5 text-sm font-semibold leading-6 txt-strong">
              {tBs('selfContract.sentence', {days: savedDays})}
            </p>
            <p className="mt-2 text-xs leading-6 txt-muted">
              {tBs('selfContract.horizonHint')}
            </p>

            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-lg border border-[color:var(--color-border)] fill-1 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider txt-faint">
                  {tBs('selfContract.startLabel')}
                </p>
                <p className="mt-1 text-sm font-semibold txt-strong">{startLabel}</p>
              </div>
              <div className="rounded-lg border border-[color:var(--color-border)] fill-1 px-3 py-2.5">
                <p className="text-[10px] font-bold uppercase tracking-wider txt-faint">
                  {tBs('selfContract.endLabel')}
                </p>
                <p className="mt-1 text-sm font-semibold txt-strong">{endLabel}</p>
              </div>
            </div>

            {withinCommitment && (
              <p className="mt-3 text-sm font-semibold text-violet-200/90">
                {tBs('selfContract.dayProgress', {
                  current: progress.currentDay,
                  total: progress.days,
                })}
              </p>
            )}

            {commitmentEnded && (
              <div className="mt-4 rounded-lg border border-amber-400/25 bg-amber-500/8 px-3 py-3">
                <p className="text-sm font-semibold text-amber-100/90">
                  {tBs('selfContract.commitmentEnded')}
                </p>
                <BusyButton
                  type="button"
                  className="focus-ring btn-primary mt-3"
                  busy={commitmentSaving}
                  busyLabel={t('lifeCoach.saving')}
                  onClick={renewCommitment}
                >
                  {tBs('selfContract.renewCommitment', {days: draftDays})}
                </BusyButton>
              </div>
            )}

            <label className="mt-4 block">
              <span className="text-xs font-semibold txt-muted">{tBs('selfContract.daysLabel')}</span>
              <input
                type="number"
                min={7}
                max={90}
                className="focus-ring mt-1 w-24 rounded-lg border border-[color:var(--color-border)] fill-1 px-3 py-2 text-sm txt-strong"
                value={draftDays}
                onChange={(e) => {
                  const days = parseInt(e.target.value, 10);
                  if (days >= 7 && days <= 90) {
                    setDraftDays(days);
                    setCommitmentDirty(days !== savedDays);
                  }
                }}
              />
            </label>
            {commitmentDirty && (
              <div className="mt-3 flex flex-wrap gap-2">
                <BusyButton
                  type="button"
                  className="focus-ring btn-primary"
                  busy={commitmentSaving}
                  busyLabel={t('lifeCoach.saving')}
                  onClick={saveCommitment}
                >
                  {tBs('selfContract.saveCommitment')}
                </BusyButton>
                <button
                  type="button"
                  className="focus-ring btn-ghost"
                  disabled={commitmentSaving}
                  onClick={() => {
                    setDraftDays(savedDays);
                    setCommitmentDirty(false);
                  }}
                >
                  {t('lifeCoach.cancel')}
                </button>
              </div>
            )}
          </div>
          {withinCommitment && (
            <CommitmentLadderCard
              stageKey={ladder.labelKey}
              progress={weeklyShowUps}
              target={ladder.target}
            />
          )}
        </div>
      )}
      {goal.status === 'active' && goal.success_metric?.trim() && (
        <div className="mt-4 rounded-xl border border-[var(--blue)]/20 bg-[var(--blue)]/6 px-4 py-3">
          <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-[var(--blue)]/80">
            {t('lifeCoach.whyItMatters')}
          </p>
          <p className="mt-1.5 text-sm font-semibold leading-6 txt-strong">{goal.success_metric}</p>
        </div>
      )}
      {goal.status !== 'active' && goal.success_metric && (
        <p className="mt-3 text-sm font-semibold txt-soft">{goal.success_metric}</p>
      )}
      <div className="mt-4">
        {goal.status === 'completed' ? (
          <button
            type="button"
            className="focus-ring btn-ghost"
            disabled={saving}
            aria-busy={saving}
            onClick={() => setStatus('active')}
          >
            {t('lifeCoach.reopenGoal')}
          </button>
        ) : (
          <button
            type="button"
            className="focus-ring btn-small"
            disabled={saving}
            aria-busy={saving}
            onClick={() => setStatus('completed')}
          >
            {t('lifeCoach.completeGoal')}
          </button>
        )}
      </div>
      {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}
    </article>
  );
}
