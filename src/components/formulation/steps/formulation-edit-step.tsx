'use client';

import {useCallback, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {FormulationInsightsPanel} from '@/components/formulation/formulation-insights-panel';
import {joinCommaList, splitCommaList} from '@/lib/formulation/formulation-utils';
import type {FormulationSessionResponse} from '@/lib/life-coach/response-dtos';
import type {FormulationApproved, FormulationDimensions} from '@/lib/life-coach/types';

type Props = {
  loading: boolean;
  session: FormulationSessionResponse;
  draft: FormulationApproved | null;
  dimensions: FormulationDimensions | null;
  riskLevel: FormulationApproved['risk_screen']['level'];
  riskAction: FormulationApproved['risk_screen']['action'];
  drafting?: boolean;
  loadError?: string | null;
  onLoadDraft: () => Promise<FormulationApproved | null>;
  onSubmit: (approved: FormulationApproved, userEdited: boolean) => void;
};

export function FormulationEditStep({
  loading,
  session,
  draft,
  dimensions,
  riskLevel,
  riskAction,
  drafting = false,
  loadError,
  onLoadDraft,
  onSubmit,
}: Props) {
  const t = useTranslations('formulation');
  const [central, setCentral] = useState('');
  const [stressors, setStressors] = useState('');
  const [maintaining, setMaintaining] = useState('');
  const [strengths, setStrengths] = useState('');
  const [uncertainties, setUncertainties] = useState('');
  const [aiLoading, setAiLoading] = useState(false);
  const [loadStarted, setLoadStarted] = useState(Boolean(draft));
  const [draftFailed, setDraftFailed] = useState(false);
  const [manualMode, setManualMode] = useState(false);

  const applyDraft = useCallback((d: FormulationApproved) => {
    setCentral(d.presenting_concern_user_words);
    setStressors(joinCommaList(d.stressors));
    setMaintaining(joinCommaList(d.maintaining_factors));
    setStrengths(joinCommaList(d.existing_strengths));
    setUncertainties(joinCommaList(d.uncertainties));
  }, []);

  const runDraftLoad = useCallback(async () => {
    setAiLoading(true);
    setDraftFailed(false);
    try {
      const loadedDraft = await onLoadDraft();
      if (loadedDraft) {
        applyDraft(loadedDraft);
        setDraftFailed(false);
        return true;
      }
      setDraftFailed(true);
      return false;
    } catch {
      setDraftFailed(true);
      return false;
    } finally {
      setAiLoading(false);
    }
  }, [applyDraft, onLoadDraft]);

  useEffect(() => {
    if (draft) {
      const timeout = window.setTimeout(() => {
        applyDraft(draft);
        setLoadStarted(true);
        setDraftFailed(false);
      }, 0);
      return () => window.clearTimeout(timeout);
    }
    if (manualMode || loadStarted) return;

    const timeout = window.setTimeout(() => {
      setLoadStarted(true);
      void runDraftLoad();
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [applyDraft, draft, loadStarted, manualMode, runDraftLoad]);

  const generating = drafting || aiLoading;

  const [validationWarning, setValidationWarning] = useState<string | null>(null);

  function buildApproved(): FormulationApproved {
    const uncertaintiesList = splitCommaList(uncertainties);
    return {
      presenting_concern_user_words: central.trim(),
      intensity_0_10: draft?.intensity_0_10 ?? dimensions?.intensity_0_10 ?? null,
      contexts: draft?.contexts ?? dimensions?.contexts ?? [],
      stressors: splitCommaList(stressors),
      maintaining_factors: splitCommaList(maintaining),
      existing_strengths: splitCommaList(strengths),
      uncertainties:
        uncertaintiesList.length > 0
          ? uncertaintiesList
          : [t('formulationEdit.uncertaintyFallback')],
      risk_screen: {level: riskLevel, action: riskAction},
    };
  }

  function validateAndSubmit() {
    const approved = buildApproved();
    const diagnosticPattern = /\b(depression|anxiety disorder|ADHD|PTSD|OCD|bipolar|דיכאון|הפרעת|אבחנ)/i;
    const allText = [
      approved.presenting_concern_user_words,
      ...approved.stressors,
      ...approved.maintaining_factors,
    ].join(' ');

    if (diagnosticPattern.test(allText)) {
      setValidationWarning(t('formulationEdit.diagnosticWarning'));
      return;
    }
    setValidationWarning(null);
    onSubmit(approved, true);
  }

  if (generating && !draft && !manualMode) {
    return (
      <div className="grid gap-4">
        <p className="text-sm txt-soft">{t('progressState.draftFormulation')}</p>
        <p className="text-xs txt-muted">{t('progressState.draftFormulationHint')}</p>
      </div>
    );
  }

  if (draftFailed && !draft && !manualMode) {
    return (
      <div className="grid gap-4">
        <p className="text-sm text-red-300" role="alert">
          {loadError ?? t('formulationEdit.loadFailed')}
        </p>
        <div className="flex flex-wrap gap-3">
          <button
            className="focus-ring btn-primary"
            type="button"
            disabled={generating}
            onClick={() => void runDraftLoad()}
          >
            {t('formulationEdit.retry')}
          </button>
          <button
            className="focus-ring btn-secondary"
            type="button"
            disabled={generating}
            onClick={() => {
              setDraftFailed(false);
              setManualMode(true);
            }}
          >
            {t('formulationEdit.fillManually')}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid gap-6">
      <p className="text-sm text-[var(--muted)]">{t('formulationEdit.subtitle')}</p>
      <div aria-live="polite">{generating && <p className="text-sm txt-muted">{t('aiWorking')}</p>}</div>

      <FormulationInsightsPanel session={session} />

      <label className="grid gap-2">
        <span className="field-label mb-0">{t('formulationEdit.central')}</span>
        <textarea className="focus-ring textarea-base min-h-20" value={central} onChange={(e) => setCentral(e.target.value)} />
      </label>
      <label className="grid gap-2">
        <span className="field-label mb-0">{t('formulationEdit.stressors')}</span>
        <textarea className="focus-ring textarea-base min-h-16" value={stressors} onChange={(e) => setStressors(e.target.value)} />
      </label>
      <label className="grid gap-2">
        <span className="field-label mb-0">{t('formulationEdit.maintaining')}</span>
        <textarea className="focus-ring textarea-base min-h-16" value={maintaining} onChange={(e) => setMaintaining(e.target.value)} />
      </label>
      <label className="grid gap-2">
        <span className="field-label mb-0">{t('formulationEdit.strengths')}</span>
        <textarea className="focus-ring textarea-base min-h-16" value={strengths} onChange={(e) => setStrengths(e.target.value)} />
      </label>
      <label className="grid gap-2">
        <span className="field-label mb-0">{t('formulationEdit.uncertainties')}</span>
        <textarea className="focus-ring textarea-base min-h-16" value={uncertainties} onChange={(e) => setUncertainties(e.target.value)} />
      </label>

      {validationWarning && (
        <div role="alert" className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-sm text-amber-200">
          <p>{validationWarning}</p>
          <button
            className="focus-ring mt-2 text-xs text-amber-300 underline"
            type="button"
            onClick={() => {
              setValidationWarning(null);
              onSubmit(buildApproved(), true);
            }}
          >
            {t('formulationEdit.submitAnyway')}
          </button>
        </div>
      )}

      <button
        className="focus-ring btn-primary"
        type="button"
        disabled={loading || generating || !central.trim()}
        aria-busy={loading || generating}
        onClick={validateAndSubmit}
      >
        {loading ? t('saving') : t('formulationEdit.approve')}
      </button>
      {!draft && manualMode ? (
        <button
          className="focus-ring btn-secondary"
          type="button"
          disabled={generating}
          onClick={() => {
            setManualMode(false);
            setDraftFailed(true);
          }}
        >
          {t('formulationEdit.retryDraft')}
        </button>
      ) : null}
    </div>
  );
}
