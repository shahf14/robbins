'use client';

import {useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import type {AppLocale} from '@/i18n/config';
import {LIFE_DOMAINS, type LifeDomain} from '@/lib/life-coach/types';
import type {CuratedDailyTaskOption} from '@/lib/life-coach/curated-daily-tasks';
import {formulationApi, lifeCoachApi} from '@/lib/life-coach/api-client';
import {todayYMD} from '@/lib/date-utils';
import {applyServerOnboardingStatus, fetchServerOnboardingStatus} from '@/lib/onboarding-state';
import {clearDraft as clearOnboardingWizardDraft} from '@/lib/onboarding-wizard-state';
import {resolveCuratedErrorMessage} from '@/lib/life-coach/curated-api-errors';
import {useToast} from '@/components/feedback/toast-provider';
import {BusyButton} from '@/components/feedback/busy-button';
import {
  PHYSICAL_CONSIDERATIONS,
  loadUserPreferences,
  saveUserPreferences,
  type PhysicalConsideration,
} from '@/lib/user-preferences';
import {
  dismissProfilePrompt,
  isProfilePromptAvailable,
  markProfilePromptAnswered,
} from '@/lib/profile-completion';

type Props = {
  onCreated: () => Promise<void>;
  initialDomain?: LifeDomain;
};

export function CuratedDailyTaskPicker({onCreated, initialDomain}: Props) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const toast = useToast();
  const [domain, setDomain] = useState<LifeDomain>(initialDomain ?? 'health');
  const [tasks, setTasks] = useState<CuratedDailyTaskOption[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [selectedPhysical, setSelectedPhysical] = useState<PhysicalConsideration[]>([]);
  const [showPhysicalPrompt, setShowPhysicalPrompt] = useState(false);
  const [loadedKey, setLoadedKey] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [saving, setSaving] = useState(false);
  const selectedCount = selectedIds.size;
  const fetchKey = `${domain}:${locale}`;
  const loading = loadedKey !== fetchKey;

  useEffect(() => {
    let cancelled = false;
    const key = fetchKey;
    lifeCoachApi
      .getCuratedDailyTasks({domain, date: todayYMD(), locale})
      .then((res) => {
        if (!cancelled) {
          setTasks(res.tasks);
          setLoadError(null);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          setTasks([]);
          setLoadError(resolveCuratedErrorMessage(error, t));
        }
      })
      .finally(() => {
        if (!cancelled) setLoadedKey(key);
      });
    return () => {
      cancelled = true;
    };
  }, [domain, locale, fetchKey, reloadNonce, t]);

  function retryLoad() {
    setLoadError(null);
    setLoadedKey(null);
    setReloadNonce((current) => current + 1);
  }

  const selectedTasks = useMemo(
    () => tasks.filter((task) => selectedIds.has(task.id)),
    [tasks, selectedIds]
  );

  function toggleTask(taskId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(taskId)) {
        next.delete(taskId);
        return next;
      }
      if (next.size >= 3) return next;
      next.add(taskId);
      return next;
    });
  }

  function selectDomain(nextDomain: LifeDomain) {
    if (nextDomain === domain) return;
    setDomain(nextDomain);
    setSelectedIds(new Set());
    setShowPhysicalPrompt(false);
    setLoadError(null);
    setLoadedKey(null);
  }

  function shouldAskPhysicalConsiderations() {
    if (domain !== 'health') return false;
    const prefs = loadUserPreferences();
    if ((prefs.physical_considerations?.length ?? 0) > 0) return false;
    return isProfilePromptAvailable('physical_considerations');
  }

  function togglePhysical(item: PhysicalConsideration) {
    setSelectedPhysical((current) =>
      current.includes(item)
        ? current.filter((value) => value !== item)
        : [...current, item]
    );
  }

  async function persistPhysicalConsiderations(physical: PhysicalConsideration[]) {
    saveUserPreferences({
      physical_considerations: physical.length ? physical : undefined,
    });
    try {
      await formulationApi.updateParticipantProfile({
        physical_considerations: physical.length ? physical : null,
      });
    } catch {
      // Local preference is enough to keep the next step safe in this session.
    }
    markProfilePromptAnswered('physical_considerations');
  }

  async function saveSelection(skipPhysicalPrompt = false) {
    if (selectedCount < 1) return;
    if (!skipPhysicalPrompt && shouldAskPhysicalConsiderations()) {
      setShowPhysicalPrompt(true);
      return;
    }
    setSaving(true);
    try {
      const response = await lifeCoachApi.selectCuratedDailyTasks({
        domain,
        task_ids: selectedTasks.map((task) => task.id),
        date: todayYMD(),
        locale,
      });
      const serverStatus = await fetchServerOnboardingStatus();
      if (serverStatus?.completedAt) {
        applyServerOnboardingStatus(serverStatus);
        clearOnboardingWizardDraft();
      }
      if (response.inserted.length === 0) {
        toast.info(t('lifeCoach.curatedPicker.alreadySelected'));
      } else {
        toast.success(t('lifeCoach.curatedPicker.saved'));
      }
      await onCreated();
    } catch (error) {
      toast.error(resolveCuratedErrorMessage(error, t));
    } finally {
      setSaving(false);
    }
  }

  async function savePhysicalAndContinue(physical: PhysicalConsideration[]) {
    setSaving(true);
    try {
      await persistPhysicalConsiderations(physical);
      setShowPhysicalPrompt(false);
      await saveSelection(true);
    } finally {
      setSaving(false);
    }
  }

  async function dismissPhysicalAndContinue() {
    dismissProfilePrompt('physical_considerations', 7);
    setShowPhysicalPrompt(false);
    await saveSelection(true);
  }

  return (
    <section className="panel-surface p-6 sm:p-8" aria-label={t('lifeCoach.curatedPicker.aria')}>
      <p className="eyebrow">{t('lifeCoach.curatedPicker.eyebrow')}</p>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h2 className="text-2xl font-black txt-strong">{t('lifeCoach.curatedPicker.title')}</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--muted)]">
            {t('lifeCoach.curatedPicker.body')}
          </p>
        </div>
        <div className="rounded-2xl border border-[color:var(--color-border)] fill-1 px-4 py-3 text-sm font-bold txt-soft">
          {t('lifeCoach.curatedPicker.selectedCount', {count: selectedCount})}
        </div>
      </div>

      <div className="mt-6">
        <p className="field-label txt-muted">{t('lifeCoach.curatedPicker.domainLabel')}</p>
        <div className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {LIFE_DOMAINS.map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={domain === item}
              className={`focus-ring rounded-[14px] border px-4 py-3 text-start text-sm font-bold transition ${
                domain === item
                  ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.14)] txt-strong'
                  : 'border-[color:var(--color-border)] fill-1 txt-soft hover:border-[color:var(--color-border-strong)] hover:txt-strong'
              }`}
              onClick={() => selectDomain(item)}
            >
              {t(`lifeCoach.domains.${item}.short`)}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <p className="field-label txt-muted">{t('lifeCoach.curatedPicker.taskLabel')}</p>
        {loading ? (
          <div className="mt-3 rounded-[14px] border border-[color:var(--color-border)] fill-1 px-4 py-5 text-sm txt-muted">
            {t('lifeCoach.curatedPicker.loading')}
          </div>
        ) : loadError ? (
          <div
            className="mt-3 rounded-[14px] border border-red-400/30 bg-red-500/8 px-4 py-5"
            role="alert"
          >
            <p className="text-sm font-black txt-strong">{t('lifeCoach.curatedPicker.loadErrorTitle')}</p>
            <p className="mt-2 text-sm leading-6 text-[var(--muted)]">{loadError}</p>
            <button
              type="button"
              className="focus-ring btn-primary mt-4 text-sm"
              onClick={retryLoad}
            >
              {t('lifeCoach.curatedPicker.retry')}
            </button>
          </div>
        ) : (
          <div className="mt-3 grid gap-3">
            {tasks.map((task) => {
              const checked = selectedIds.has(task.id);
              const disabled = !checked && selectedIds.size >= 3;
              return (
                <button
                  key={task.id}
                  type="button"
                  aria-pressed={checked}
                  disabled={disabled}
                  className={`focus-ring rounded-[16px] border p-4 text-start transition disabled:cursor-not-allowed disabled:opacity-55 ${
                    checked
                      ? 'border-emerald-400/60 bg-emerald-500/10'
                      : 'border-[color:var(--color-border)] fill-1 hover:border-[color:var(--color-border-strong)]'
                  }`}
                  onClick={() => toggleTask(task.id)}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded border text-xs font-black ${
                        checked
                          ? 'border-emerald-400 bg-emerald-400 text-black'
                          : 'border-[color:var(--color-border-strong)]'
                      }`}
                      aria-hidden="true"
                    >
                      {checked ? 'v' : ''}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-base font-black leading-6 txt-strong">{task.title}</span>
                      <span className="mt-1 block text-sm leading-6 text-[var(--muted)]">{task.description}</span>
                      <span className="mt-3 flex flex-wrap gap-2 text-xs font-semibold txt-muted">
                        <span className="rounded-full border border-[color:var(--color-border)] px-2.5 py-1">
                          {task.durationMinutes} {t('lifeCoach.minutes')}
                        </span>
                        <span className="rounded-full border border-[color:var(--color-border)] px-2.5 py-1">
                          {t(`lifeCoach.difficulty.${task.difficulty}`)}
                        </span>
                        <span className="rounded-full border border-[color:var(--color-border)] px-2.5 py-1">
                          {t(`lifeCoach.curatedPicker.energy.${task.energy}`)}
                        </span>
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showPhysicalPrompt && (
        <div className="mt-5 rounded-[16px] border border-amber-400/25 bg-amber-400/8 px-4 py-4">
          <p className="text-sm font-black txt-strong">{t('lifeCoach.curatedPicker.physicalTitle')}</p>
          <p className="mt-1 text-sm leading-6 txt-muted">{t('lifeCoach.curatedPicker.physicalBody')}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {PHYSICAL_CONSIDERATIONS.map((item) => (
              <button
                key={item}
                type="button"
                aria-pressed={selectedPhysical.includes(item)}
                className={`focus-ring rounded-full border px-3 py-2 text-xs font-bold transition ${
                  selectedPhysical.includes(item)
                    ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] txt-strong'
                    : 'border-[color:var(--color-border)] fill-1 txt-soft hover:txt-strong'
                }`}
                onClick={() => togglePhysical(item)}
              >
                {t(`onboarding.physical.${item}`)}
              </button>
            ))}
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            <BusyButton
              type="button"
              className="focus-ring btn-primary"
              busy={saving}
              busyLabel={t('lifeCoach.curatedPicker.saving')}
              onClick={() => void savePhysicalAndContinue(selectedPhysical)}
            >
              {selectedPhysical.length > 0
                ? t('lifeCoach.curatedPicker.physicalSave')
                : t('lifeCoach.curatedPicker.physicalNone')}
            </BusyButton>
            <button
              type="button"
              className="focus-ring btn-ghost"
              disabled={saving}
              onClick={() => void dismissPhysicalAndContinue()}
            >
              {t('lifeCoach.curatedPicker.physicalLater')}
            </button>
          </div>
        </div>
      )}

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <BusyButton
          type="button"
          className="focus-ring btn-primary"
          busy={saving}
          busyLabel={t('lifeCoach.curatedPicker.saving')}
          disabled={selectedCount < 1 || loading || Boolean(loadError)}
          onClick={() => void saveSelection()}
        >
          {t('lifeCoach.curatedPicker.cta')}
        </BusyButton>
        <p className="text-xs leading-5 txt-muted">{t('lifeCoach.curatedPicker.reassurance')}</p>
      </div>
    </section>
  );
}
