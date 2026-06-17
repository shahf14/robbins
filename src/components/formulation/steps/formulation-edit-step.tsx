'use client';

import {useCallback, useEffect, useState} from 'react';
import {useTranslations} from 'next-intl';
import {FormulationInsightsPanel} from '@/components/formulation/formulation-insights-panel';
import {joinCommaList, splitCommaList} from '@/lib/formulation/formulation-utils';
import type {FormulationApproved, FormulationDimensions, FormulationSession} from '@/lib/life-coach/types';

type Props = {
  loading: boolean;
  session: FormulationSession;
  draft: FormulationApproved | null;
  dimensions: FormulationDimensions | null;
  riskLevel: FormulationApproved['risk_screen']['level'];
  riskAction: FormulationApproved['risk_screen']['action'];
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
  const [loaded, setLoaded] = useState(false);

  const applyDraft = useCallback((d: FormulationApproved) => {
    setCentral(d.presenting_concern_user_words);
    setStressors(joinCommaList(d.stressors));
    setMaintaining(joinCommaList(d.maintaining_factors));
    setStrengths(joinCommaList(d.existing_strengths));
    setUncertainties(joinCommaList(d.uncertainties));
  }, []);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      if (draft) {
        applyDraft(draft);
        setLoaded(true);
        return;
      }
      if (!loaded) {
        setAiLoading(true);
        onLoadDraft()
          .then((d) => {
            if (d) applyDraft(d);
            setLoaded(true);
          })
          .catch(() => { setLoaded(true); })
          .finally(() => setAiLoading(false));
      }
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [applyDraft, draft, loaded, onLoadDraft]);

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

  return (
    <div className="grid gap-6">
      <p className="text-sm text-[var(--muted)]">{t('formulationEdit.subtitle')}</p>
      <div aria-live="polite">{aiLoading && <p className="text-sm txt-muted">{t('aiWorking')}</p>}</div>

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
        disabled={loading || aiLoading || !central.trim()}
        aria-busy={loading || aiLoading}
        onClick={validateAndSubmit}
      >
        {loading ? t('saving') : t('formulationEdit.approve')}
      </button>
    </div>
  );
}
