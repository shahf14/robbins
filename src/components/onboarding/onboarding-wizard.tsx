'use client';

import {useCallback, useEffect, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/config';
import {normalizeLifeContextSelection} from '@/lib/formulation/life-context';
import {formulationApi} from '@/lib/life-coach/api-client';
import {
  loadUserPreferences,
  saveUserPreferences,
} from '@/lib/user-preferences';
import {isOnboardingComplete} from '@/lib/onboarding-state';
import {DraftSavedIndicator} from '@/components/feedback/draft-saved-indicator';
import {CuratedDailyTaskPicker} from '@/components/life-coach/curated-daily-task-picker';
import {Step1BasicInfo} from './step1-basic-info';
import {
  clearDraft,
  INITIAL_ONBOARDING_WIZARD_STATE,
  loadDraft,
  saveDraft,
  type WizardState,
} from '@/lib/onboarding-wizard-state';

const QUICK_ONBOARDING_STEPS = 2;

function createInitialWizardState(browserLocale: AppLocale): WizardState {
  const prefs = loadUserPreferences();
  return {
    ...INITIAL_ONBOARDING_WIZARD_STATE,
    locale: browserLocale,
    lifeContextStatuses: prefs.life_context_statuses ?? [],
    lifeContextNote: prefs.life_context_note ?? '',
  };
}

function restoreQuickDraft(base: WizardState, browserLocale: AppLocale): WizardState {
  const draft = loadDraft();
  if (!draft) return base;

  return {
    ...base,
    lifeContextStatuses: draft.lifeContextStatuses ?? base.lifeContextStatuses,
    lifeContextNote: draft.lifeContextNote ?? base.lifeContextNote,
    selectedDomain: draft.selectedDomain ?? base.selectedDomain,
    locale: browserLocale,
    step: draft.selectedDomain && draft.step && draft.step > 1 ? 2 : 1,
    draftRestored: true,
    error: null,
    saving: false,
  };
}

export function OnboardingWizard() {
  const router = useRouter();
  const browserLocale = useLocale() as AppLocale;
  const t = useTranslations();
  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  useEffect(() => {
    if (isOnboardingComplete()) router.replace('/');
  }, [router]);

  const [s, setS] = useState<WizardState>(() =>
    restoreQuickDraft(createInitialWizardState(browserLocale), browserLocale)
  );

  const set = useCallback((patch: Partial<WizardState>) =>
    setS((prev) => ({
      ...prev,
      ...patch,
      ...(patch.step !== undefined && patch.step !== prev.step ? {draftRestored: false} : {}),
    })), []);

  useEffect(() => {
    if (s.step > 1) {
      saveDraft(s);
      const id = window.setTimeout(() => setDraftSavedAt(Date.now()), 0);
      return () => window.clearTimeout(id);
    }
  }, [s]);

  async function continueToTaskPicker() {
    if (!s.selectedDomain) return;

    const contexts = normalizeLifeContextSelection(s.lifeContextStatuses);
    set({saving: true, error: null});

    saveUserPreferences({
      preferred_language: s.locale,
      life_context_statuses: contexts.length > 0 ? contexts : undefined,
      life_context_note: s.lifeContextNote.trim() || undefined,
    });

    try {
      await formulationApi.updateParticipantProfile({
        life_context_statuses: contexts,
        life_context_note: s.lifeContextNote.trim() || null,
      });
    } catch {
      // Local preferences are already saved; this can be retried from settings later.
    }

    set({saving: false, step: 2, draftRestored: false});
  }

  function startOver() {
    clearDraft();
    setS(createInitialWizardState(browserLocale));
  }

  async function enterApp() {
    router.replace('/');
  }

  const pct = Math.round((Math.min(s.step, QUICK_ONBOARDING_STEPS) / QUICK_ONBOARDING_STEPS) * 100);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-bg)]">
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col px-5 py-8 sm:py-10">
        {s.draftRestored && (
          <div className="mb-6 flex items-center justify-between gap-3 rounded-xl fill-1 px-4 py-3">
            <span className="text-sm txt-soft">{t('onboarding.resumeBanner')}</span>
            <button
              type="button"
              className="focus-ring shrink-0 text-xs font-semibold txt-faint transition hover:txt-soft"
              onClick={startOver}
            >
              {t('onboarding.resumeStartOver')}
            </button>
          </div>
        )}

        <div className="mb-6">
          <div className="mb-2 flex items-center justify-between gap-3">
            <p className="text-xs font-medium txt-faint">
              {t('onboarding.stepCounter', {step: s.step, total: QUICK_ONBOARDING_STEPS})}
            </p>
            {s.step > 1 && <DraftSavedIndicator savedAt={draftSavedAt} />}
          </div>
          <div
            className="h-0.5 w-full overflow-hidden rounded-full fill-3"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div
              className="h-full rounded-full bg-[var(--blue)] transition-[width] duration-500"
              style={{width: `${pct}%`}}
            />
          </div>
        </div>

        {s.step === 1 && (
          <Step1BasicInfo
            s={s}
            set={set}
            onNext={() => void continueToTaskPicker()}
          />
        )}

        {s.step === 2 && s.selectedDomain && (
          <CuratedDailyTaskPicker
            initialDomain={s.selectedDomain}
            onCreated={enterApp}
          />
        )}

        {s.error && (
          <div role="alert" className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">
            {s.error}
          </div>
        )}
      </div>
    </div>
  );
}
