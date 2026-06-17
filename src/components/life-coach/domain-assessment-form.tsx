'use client';

import {useEffect, useMemo, useState} from 'react';
import {useTranslations} from 'next-intl';
import {assessmentContentHints} from '@/lib/life-context-content';
import {getLifeWheelRatingKeys} from '@/lib/life-wheel';
import {
  DOMAIN_BLOCKERS,
  type LifeDomain,
  type LifeDomainState,
} from '@/lib/life-coach/types';
import {defaultUserPreferences, loadUserPreferences} from '@/lib/user-preferences';
import {useToast} from '@/components/feedback/toast-provider';
import {DomainScoreExplainer} from './shared/domain-score-explainer';

type AssessmentInput = Omit<
  LifeDomainState,
  'id' | 'user_id' | 'domain' | 'created_at' | 'updated_at'
>;

type Props = {
  domain: LifeDomain;
  initialState: LifeDomainState | null;
  onSave: (input: AssessmentInput) => Promise<void>;
};

function getInitialLifeContexts() {
  return loadUserPreferences().life_context_statuses ?? [];
}

function hasSavedAssessment(state: LifeDomainState | null): boolean {
  if (!state) return false;
  return Boolean(
    state.desired_state?.trim() ||
      state.current_state?.trim() ||
      (state.main_blockers?.length ?? 0) > 0
  );
}

export function DomainAssessmentForm({domain, initialState, onSave}: Props) {
  const t = useTranslations();
  const toast = useToast();
  const [viewMode, setViewMode] = useState<'summary' | 'edit'>(() =>
    hasSavedAssessment(initialState) ? 'summary' : 'edit'
  );
  const [currentScore, setCurrentScore] = useState(initialState?.current_score ?? 5);
  const [currentState, setCurrentState] = useState(initialState?.current_state ?? '');
  const [desiredState, setDesiredState] = useState(initialState?.desired_state ?? '');
  const [mainBlockers, setMainBlockers] = useState<string[]>(initialState?.main_blockers ?? []);
  const [customBlocker, setCustomBlocker] = useState('');
  const [saving, setSaving] = useState(false);
  const [lifeContexts, setLifeContexts] = useState(() => getInitialLifeContexts());

  useEffect(() => {
    if (!initialState) return;
    const timeout = window.setTimeout(() => {
      setCurrentScore(initialState.current_score ?? 5);
      setCurrentState(initialState.current_state ?? '');
      setDesiredState(initialState.desired_state ?? '');
      setMainBlockers(initialState.main_blockers ?? []);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, [initialState]);

  useEffect(() => {
    const id = window.setTimeout(() => {
      setLifeContexts(getInitialLifeContexts());
    }, 0);
    return () => window.clearTimeout(id);
  }, []);

  const hints = useMemo(() => assessmentContentHints(lifeContexts), [lifeContexts]);
  const suggestedBlockerSet = useMemo(() => new Set(hints.suggestedBlockers), [hints.suggestedBlockers]);
  const scoreTierLabel = getScoreTierLabel(domain, currentScore, t);

  const blockers = useMemo(() => {
    if (!customBlocker.trim()) {
      return mainBlockers;
    }
    return [...mainBlockers.filter((item) => item !== customBlocker.trim()), customBlocker.trim()];
  }, [customBlocker, mainBlockers]);

  const bottomLine =
    desiredState.trim() ||
    currentState.trim() ||
    t('lifeCoach.assessmentSummaryEmpty');

  const blockerLabels = blockers
    .slice(0, 4)
    .map((blocker) =>
      DOMAIN_BLOCKERS.includes(blocker as (typeof DOMAIN_BLOCKERS)[number])
        ? t(`lifeCoach.blockers.${blocker}`)
        : blocker
    );

  function toggleBlocker(blocker: string) {
    setMainBlockers((current) =>
      current.includes(blocker) ? current.filter((item) => item !== blocker) : [...current, blocker]
    );
  }

  async function handleSave() {
    setSaving(true);
    try {
      await onSave({
        current_score: currentScore,
        current_state: currentState,
        desired_state: desiredState,
        main_blockers: blockers.filter(Boolean),
        available_time_per_day: defaultUserPreferences.available_time_per_day,
        intensity_preference: defaultUserPreferences.intensity_preference,
      });
      setViewMode('summary');
      toast.success(t('lifeCoach.assessmentSavedToast'));
    } catch {
      toast.error(t('feedback.failed'));
    } finally {
      setSaving(false);
    }
  }

  if (viewMode === 'summary') {
    return (
      <section className="panel-surface p-5 sm:p-6" aria-label={t('lifeCoach.assessmentSummaryTitle')}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-[var(--blue)]">
              {t('lifeCoach.assessmentSummaryEyebrow')}
            </p>
            <h3 className="mt-2 text-lg font-bold text-white">{t('lifeCoach.assessmentSummaryTitle')}</h3>
          </div>
          <span
            className={`shrink-0 rounded-full border px-3 py-1 text-xs font-semibold ${scoreBadgeClass(currentScore)}`}
          >
            {scoreTierLabel} {currentScore}/10
          </span>
        </div>

        <p className="mt-4 text-base leading-7 text-white/90">{bottomLine}</p>

        {(blockerLabels.length > 0) && (
          <p className="mt-3 text-sm leading-6 text-white/45">
            {t('lifeCoach.assessmentSummaryBlockers', {blockers: blockerLabels.join(' · ')})}
          </p>
        )}

        <button
          type="button"
          className="focus-ring mt-5 text-sm font-semibold text-[var(--blue)] underline decoration-[var(--blue)]/25 underline-offset-4"
          onClick={() => setViewMode('edit')}
        >
          {t('lifeCoach.assessmentEdit')}
        </button>
      </section>
    );
  }

  return (
    <section className="panel-surface p-6" aria-label={t('lifeCoach.assessmentTitle')}>
      <p className="eyebrow">{t('lifeCoach.assessment')}</p>
      <h3 className="mt-4 text-xl font-black text-white">{t('lifeCoach.assessmentTitle')}</h3>

      <div className="mt-6 grid gap-6">
        <div className="grid gap-3">
          <RangeField
            label={t('lifeCoach.currentScore')}
            value={currentScore}
            onChange={setCurrentScore}
            scoreTierLabel={scoreTierLabel}
          />
          <DomainScoreExplainer compact />
        </div>

        <div className="grid gap-2">
          <span className="field-label mb-0">{t('lifeCoach.currentState')}</span>
          {hints.starterKeys ? (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="focus-ring rounded-full border border-[var(--blue)]/30 bg-[var(--blue)]/10 px-3 py-1 text-xs font-semibold text-white/80 transition hover:text-white"
                onClick={() =>
                  setCurrentState((prev) => prev || t(hints.starterKeys?.current ?? 'lifeCoach.currentStateStarter1'))
                }
              >
                {t(hints.starterKeys.current)}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(['currentStateStarter1', 'currentStateStarter2', 'currentStateStarter3'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  className="focus-ring rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs font-semibold text-white/60 transition hover:border-white/20 hover:text-white"
                  onClick={() => setCurrentState((prev) => (prev ? prev : t(`lifeCoach.${key}`)))}
                >
                  {t(`lifeCoach.${key}`)}
                </button>
              ))}
            </div>
          )}
          <textarea
            className="focus-ring textarea-base min-h-28"
            value={currentState}
            aria-label={t('lifeCoach.currentState')}
            onChange={(event) => setCurrentState(event.target.value)}
            placeholder={t('lifeCoach.currentStatePlaceholder')}
          />
        </div>

        <div className="grid gap-2">
          <span className="field-label mb-0">{t('lifeCoach.desiredState')}</span>
          {hints.starterKeys ? (
            <div className="flex flex-wrap gap-1.5">
              <button
                type="button"
                className="focus-ring rounded-full border border-[var(--blue)]/30 bg-[var(--blue)]/10 px-3 py-1 text-xs font-semibold text-white/80 transition hover:text-white"
                onClick={() =>
                  setDesiredState((prev) => prev || t(hints.starterKeys?.desired ?? 'lifeCoach.desiredStateStarter1'))
                }
              >
                {t(hints.starterKeys.desired)}
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {(['desiredStateStarter1', 'desiredStateStarter2', 'desiredStateStarter3'] as const).map((key) => (
                <button
                  key={key}
                  type="button"
                  className="focus-ring rounded-full border border-white/10 bg-white/4 px-3 py-1 text-xs font-semibold text-white/60 transition hover:border-white/20 hover:text-white"
                  onClick={() => setDesiredState((prev) => (prev ? prev : t(`lifeCoach.${key}`)))}
                >
                  {t(`lifeCoach.${key}`)}
                </button>
              ))}
            </div>
          )}
          <textarea
            className="focus-ring textarea-base min-h-28"
            value={desiredState}
            aria-label={t('lifeCoach.desiredState')}
            onChange={(event) => setDesiredState(event.target.value)}
            placeholder={t('lifeCoach.desiredStatePlaceholder')}
          />
        </div>

        <div className="grid gap-3" role="group" aria-labelledby="assessment-blockers-label">
          <span id="assessment-blockers-label" className="field-label mb-0">
            {t('lifeCoach.mainBlockers')}
          </span>
          <div className="flex flex-wrap gap-2">
            {DOMAIN_BLOCKERS.map((blocker) => (
              <button
                key={blocker}
                type="button"
                aria-pressed={blockers.includes(blocker)}
                className={`focus-ring rounded-full border px-4 py-2 text-sm font-semibold transition ${
                  blockers.includes(blocker)
                    ? 'border-[var(--blue)] bg-[rgba(26,109,255,0.16)] text-white'
                    : suggestedBlockerSet.has(blocker)
                      ? 'border-[var(--blue)]/35 bg-[var(--blue)]/8 text-white/85'
                      : 'border-white/10 bg-white/3 text-white/72'
                }`}
                onClick={() => toggleBlocker(blocker)}
              >
                {t(`lifeCoach.blockers.${blocker}`)}
              </button>
            ))}
          </div>
          <input
            className="focus-ring input-base"
            value={customBlocker}
            aria-label={t('lifeCoach.customBlocker')}
            onChange={(event) => setCustomBlocker(event.target.value)}
            placeholder={t('lifeCoach.customBlocker')}
          />
        </div>

        <button
          className="focus-ring btn-primary"
          type="button"
          disabled={saving}
          aria-busy={saving}
          onClick={() => void handleSave()}
        >
          {saving ? t('lifeCoach.saving') : t('lifeCoach.saveAssessment')}
        </button>
      </div>
    </section>
  );
}

function scoreBadgeClass(value: number): string {
  if (value <= 3) return 'border-red-500/30 bg-red-500/10 text-red-300';
  if (value <= 5) return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300';
  if (value <= 7) return 'border-blue-500/30 bg-blue-500/10 text-blue-300';
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300';
}

function getScoreTierLabel(domain: LifeDomain, value: number, t: ReturnType<typeof useTranslations>): string {
  const {bandLabelKey} = getLifeWheelRatingKeys(domain, value);
  return t(bandLabelKey);
}

function RangeField({
  label,
  value,
  onChange,
  scoreTierLabel,
}: {
  label: string;
  value: number;
  onChange: (value: number) => void;
  scoreTierLabel?: string;
}) {
  const badgeClass = scoreBadgeClass(value);

  return (
    <label className="grid gap-2">
      <span className="flex items-center justify-between gap-4">
        <span className="field-label mb-0">{label}</span>
        <span
          className={`flex items-center gap-2 rounded-full border px-4 py-1.5 text-sm font-semibold transition-colors duration-200 ${badgeClass}`}
        >
          {scoreTierLabel && <span className="opacity-80">{scoreTierLabel}</span>}
          <span>{value}/10</span>
        </span>
      </span>
      <input
        className="focus-ring"
        type="range"
        min="1"
        max="10"
        value={value}
        aria-label={label}
        aria-valuenow={value}
        aria-valuemin={1}
        aria-valuemax={10}
        aria-valuetext={scoreTierLabel ? `${value}/10 – ${scoreTierLabel}` : `${value}/10`}
        onChange={(event) => onChange(Number(event.target.value))}
      />
    </label>
  );
}
