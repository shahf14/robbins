'use client';

import {useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {useToast} from '@/components/feedback/toast-provider';
import {lifeCoachApi} from '@/lib/life-coach/api-client';
import {resolveLifeCoachErrorMessage} from '@/lib/life-coach/api-error';
import type {LifeDomain} from '@/lib/life-coach/types';

const TOTAL_STEPS = 3;

/** Event other components (e.g. a floating action button) can dispatch to open the creator. */
const OPEN_GENERAL_TASK_EVENT = 'open-freestyle-task';

/**
 * Lightweight creator for repeated general daily tasks in a domain.
 *
 * These tasks are stored directly as daily_steps with is_general=true and no
 * goal_id, so they do not create a fake goal just to appear in the daily list.
 */
export function GeneralTaskSeriesCreator({
  domain,
  onCreated,
}: {
  domain: LifeDomain;
  onCreated: () => void | Promise<void>;
}) {
  const t = useTranslations('simpleTasks');
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const handler = () => {
      setOpen(true);
      document
        .getElementById('general-task-series-creator')
        ?.scrollIntoView({behavior: 'smooth', block: 'center'});
    };
    window.addEventListener(OPEN_GENERAL_TASK_EVENT, handler);
    return () => window.removeEventListener(OPEN_GENERAL_TASK_EVENT, handler);
  }, []);

  return (
    <section id="general-task-series-creator" className="panel-surface scroll-mt-24 p-6 sm:p-8" aria-label={t('sectionTitle')}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="eyebrow">{t('sectionEyebrow')}</p>
          <h2 className="mt-2 text-2xl font-black txt-strong">{t('sectionTitle')}</h2>
          <p className="mt-2 max-w-xl text-sm leading-7 text-[var(--muted)]">{t('sectionBody')}</p>
        </div>
        {!open && (
          <button type="button" className="focus-ring btn-secondary shrink-0" onClick={() => setOpen(true)}>
            {t('addTask')}
          </button>
        )}
      </div>

      {open && (
        <div className="mt-5">
          <GeneralTaskSeriesWizard
            domain={domain}
            onCancel={() => setOpen(false)}
            onCreated={async () => {
              setOpen(false);
              await onCreated();
            }}
          />
        </div>
      )}
    </section>
  );
}

function GeneralTaskSeriesWizard({
  domain,
  onCreated,
  onCancel,
}: {
  domain: LifeDomain;
  onCreated: () => void | Promise<void>;
  onCancel: () => void;
}) {
  const t = useTranslations('simpleTasks');
  const tFeedback = useTranslations();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [title, setTitle] = useState('');
  const [timesPerDay, setTimesPerDay] = useState(1);
  const [targetDays, setTargetDays] = useState(14);
  const [saving, setSaving] = useState(false);

  const canNext =
    (step === 0 && title.trim().length > 0) ||
    (step === 1 && timesPerDay >= 1) ||
    (step === 2 && targetDays >= 1);

  async function handleCreate() {
    if (saving) return;
    setSaving(true);
    try {
      await lifeCoachApi.createGeneralDailyTaskSeries({
        domain,
        title: title.trim(),
        times_per_day: timesPerDay,
        target_days: targetDays,
      });
      await onCreated();
    } catch (error) {
      toast.error(resolveLifeCoachErrorMessage(error, tFeedback));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded-2xl border border-[color:var(--color-border)] fill-1 p-5">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-sm font-bold txt-strong">{t('newTaskTitle')}</p>
        <span className="text-xs font-semibold text-[var(--muted)]" aria-live="polite" aria-atomic="true">{step + 1}/{TOTAL_STEPS}</span>
      </div>

      {step === 0 && (
        <label className="grid gap-2">
          <span className="field-label mb-0">{t('stepName')}</span>
          <input
            autoFocus
            className="focus-ring input-base"
            value={title}
            maxLength={80}
            placeholder={t('stepNamePlaceholder')}
            onChange={(e) => setTitle(e.target.value)}
          />
        </label>
      )}

      {step === 1 && (
        <div className="grid gap-2">
          <span className="field-label mb-0">{t('stepTimesPerDay')}</span>
          <NumberStepper value={timesPerDay} min={1} max={20} unit={t('perDayUnit')} onChange={setTimesPerDay} />
          <p className="text-xs text-[var(--muted)]">{t('stepTimesPerDayHelp')}</p>
        </div>
      )}

      {step === 2 && (
        <div className="grid gap-2">
          <span className="field-label mb-0">{t('stepTargetDays')}</span>
          <NumberStepper value={targetDays} min={1} max={365} unit={t('daysUnit')} onChange={setTargetDays} />
          <p className="text-xs text-[var(--muted)]">{t('stepTargetDaysHelp')}</p>
        </div>
      )}

      <div className="mt-5 flex items-center justify-between gap-3">
        <button
          type="button"
          className="focus-ring btn-ghost"
          onClick={() => (step === 0 ? onCancel() : setStep((s) => s - 1))}
        >
          {step === 0 ? t('cancel') : t('back')}
        </button>
        {step < TOTAL_STEPS - 1 ? (
          <button
            type="button"
            className="focus-ring btn-primary disabled:opacity-60"
            disabled={!canNext}
            onClick={() => setStep((s) => s + 1)}
          >
            {t('next')}
          </button>
        ) : (
          <button
            type="button"
            className="focus-ring btn-primary disabled:opacity-60"
            disabled={!canNext || saving}
            aria-busy={saving}
            onClick={handleCreate}
          >
            {t('create')}
          </button>
        )}
      </div>
    </div>
  );
}

function NumberStepper({
  value,
  min,
  max,
  unit,
  onChange,
}: {
  value: number;
  min: number;
  max: number;
  unit: string;
  onChange: (next: number) => void;
}) {
  function clamp(next: number) {
    return Math.max(min, Math.min(max, next));
  }
  return (
    <div className="flex items-center gap-3">
      <button
        type="button"
        className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--color-border-strong)] text-lg font-bold txt-soft hover:border-[color:var(--color-border-strong)]"
        onClick={() => onChange(clamp(value - 1))}
        aria-label={`decrease ${unit}`}
      >
        -
      </button>
      <input
        type="number"
        inputMode="numeric"
        className="focus-ring input-base w-20 text-center"
        value={value}
        min={min}
        max={max}
        aria-label={unit}
        onChange={(e) => onChange(clamp(e.target.valueAsNumber || min))}
      />
      <button
        type="button"
        className="focus-ring flex h-10 w-10 items-center justify-center rounded-full border border-[color:var(--color-border-strong)] text-lg font-bold txt-soft hover:border-[color:var(--color-border-strong)]"
        onClick={() => onChange(clamp(value + 1))}
        aria-label={`increase ${unit}`}
      >
        +
      </button>
      <span className="text-sm font-semibold text-[var(--muted)]">{unit}</span>
    </div>
  );
}
