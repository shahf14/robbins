'use client';

import {useCallback, useEffect, useMemo, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useSearchParams} from 'next/navigation';
import type {AppLocale} from '@/i18n/config';
import {ConsentStep} from '@/components/formulation/steps/consent-step';
import {RiskScreenStep} from '@/components/formulation/steps/risk-screen-step';
import {PassiveRatingsStep} from '@/components/formulation/steps/passive-ratings-step';
import {FollowUpStep} from '@/components/formulation/steps/follow-up-step';
import {ExplorationStep} from '@/components/formulation/steps/exploration-step';
import {FormulationEditStep} from '@/components/formulation/steps/formulation-edit-step';
import {MicroGoalStep} from '@/components/formulation/steps/micro-goal-step';
import {CompleteStep} from '@/components/formulation/steps/complete-step';
import {FormulationExportMenu} from '@/components/formulation/formulation-export-menu';
import {FormulationLiveSummary} from '@/components/formulation/formulation-live-summary';
import {WizardBusyOverlay} from '@/components/formulation/wizard-busy-overlay';
import {WizardStepNav} from '@/components/formulation/wizard-step-nav';
import type {WizardLiveDraft} from '@/lib/formulation/wizard-live-draft';
import {
  clearFormulationDraftPointer,
  saveFormulationDraftPointer,
} from '@/lib/formulation/draft-storage';
import {
  getRelevantGuidedQuestions,
  profileFromFormulationSession,
} from '@/lib/formulation/guided-questions';
import {
  isParticipantGender,
  type ParticipantGender,
} from '@/lib/formulation/participant-profile';
import {
  loadUserPreferences,
  participantProfileLocksFromPreferences,
} from '@/lib/user-preferences';
import {previousWizardPhase, wizardPhaseNumber} from '@/lib/formulation/phase-nav';
import {formulationApi} from '@/lib/life-coach/api-client';
import type {FormulationSession} from '@/lib/life-coach/types';
import {FeatureHint} from '@/components/feedback/feature-hint';
import {useFeatureVisit} from '@/hooks/use-feature-visit';

export function FormulationSessionWizard() {
  const t = useTranslations('formulation');
  const locale = useLocale() as AppLocale;
  const searchParams = useSearchParams();
  const resumeId = searchParams.get('resume');
  useFeatureVisit('formulation');

  const [session, setSession] = useState<FormulationSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [riskNeedsFollowUp, setRiskNeedsFollowUp] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [serverProfile, setServerProfile] = useState<{
    life_context_statuses: FormulationSession['life_context_statuses'];
    gender: string | null;
    age: number | null;
  } | null>(null);
  const [liveDraft, setLiveDraft] = useState<WizardLiveDraft>({});
  const [wizardStepKey, setWizardStepKey] = useState(0);
  const [busy, setBusy] = useState<'saving' | 'generating_questions' | 'draft_formulation' | null>(
    null
  );

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      if (resumeId) {
        const {session: s} = await formulationApi.get(resumeId);
        setSession(s);
        saveFormulationDraftPointer({sessionId: s.id, phase: s.current_phase});
        return;
      }
      const {draft} = await formulationApi.getLatest();
      if (draft) {
        setSession(draft);
        saveFormulationDraftPointer({sessionId: draft.id, phase: draft.current_phase});
        return;
      }
      const {session: created} = await formulationApi.create(locale);
      setSession(created);
      saveFormulationDraftPointer({sessionId: created.id, phase: created.current_phase});
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [locale, resumeId]);

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadSession(), 0);
    return () => window.clearTimeout(timeout);
  }, [loadSession]);

  useEffect(() => {
    formulationApi
      .getParticipantProfile()
      .then((p) =>
        setServerProfile({
          life_context_statuses: p.life_context_statuses,
          gender: p.gender,
          age: p.age,
        })
      )
      .catch(() =>
        setServerProfile({
          life_context_statuses: [],
          gender: null,
          age: null,
        })
      );
  }, []);

  const progress = useMemo(() => {
    if (!session) return {current: 1, total: 7};
    return {current: wizardPhaseNumber(session.current_phase), total: 7};
  }, [session]);

  const guidedQuestions = useMemo(() => {
    if (!session) return [];
    return getRelevantGuidedQuestions(profileFromFormulationSession(session));
  }, [session]);

  const onConsentDraft = useCallback(
    (consent: WizardLiveDraft['consent']) => setLiveDraft((d) => ({...d, consent})),
    []
  );
  const onRatingsDraft = useCallback(
    (passive_ratings: WizardLiveDraft['passive_ratings']) =>
      setLiveDraft((d) => ({...d, passive_ratings})),
    []
  );
  const onFollowUpDraft = useCallback(
    (follow_up_answers: WizardLiveDraft['follow_up_answers']) =>
      setLiveDraft((d) => ({...d, follow_up_answers})),
    []
  );
  const onExplorationDraft = useCallback(
    (llm_exploration_answers: WizardLiveDraft['llm_exploration_answers']) =>
      setLiveDraft((d) => ({...d, llm_exploration_answers})),
    []
  );

  async function patchAndSet(
    id: string,
    body: Parameters<typeof formulationApi.patch>[1]
  ) {
    setSaving(true);
    setBusy('saving');
    setError(null);
    try {
      const {session: updated, risk_needs_follow_up} = await formulationApi.patch(id, body);
      setSession(updated);
      saveFormulationDraftPointer({sessionId: updated.id, phase: updated.current_phase});
      if (risk_needs_follow_up) setRiskNeedsFollowUp(true);
      setLiveDraft((d) => {
        const next = {...d};
        if (body.phase === 'consent') delete next.consent;
        if (body.phase === 'open' && 'passive_ratings' in body) delete next.passive_ratings;
        if (body.phase === 'dimensions' && 'prior_question_answers' in body) {
          delete next.follow_up_answers;
        }
        if (body.phase === 'exploration' && 'llm_exploration_answers' in body) {
          delete next.llm_exploration_answers;
        }
        return next;
      });
      return updated;
    } catch (e) {
      const message = e instanceof Error ? e.message : t('progressState.errorGeneric');
      setError(message);
      return null;
    } finally {
      setSaving(false);
      setBusy(null);
    }
  }

  async function loadExplorationQuestions(sessionId: string) {
    setBusy('generating_questions');
    setError(null);
    try {
      const {questions, session: updated} = await formulationApi.runAi(
        sessionId,
        'generate_exploration_questions',
        locale
      );
      if (updated) setSession(updated);
      return questions ?? updated?.llm_exploration_questions ?? null;
    } catch (e) {
      const message = e instanceof Error ? e.message : t('progressState.errorGeneric');
      setError(message);
      return null;
    } finally {
      setBusy(null);
    }
  }

  if (loading) {
    return <p className="text-sm txt-muted">{t('loading')}</p>;
  }

  if (error || !session) {
    return <p className="text-sm text-red-300" role="alert">{error ?? t('loading')}</p>;
  }

  const sessionId = session.id;
  const phase = session.status === 'crisis_stopped' ? 'risk' : session.current_phase;
  const prevPhase = previousWizardPhase(phase);
  const showWizardNav = phase !== 'complete' && session.status !== 'completed';

  async function navigate(action: 'back' | 'restart') {
    const result = await patchAndSet(sessionId, {phase: 'navigate', action});
    if (action === 'restart' && result) {
      setRiskNeedsFollowUp(false);
      setLiveDraft({});
      setError(null);
      setWizardStepKey((k) => k + 1);
    }
  }

  const stepPercent = Math.round((progress.current / progress.total) * 100);
  const busyOverlay =
    busy === 'saving'
      ? {label: t('progressState.saving'), hint: t('progressState.savingHint')}
      : busy === 'generating_questions'
        ? {
            label: t('progressState.generatingQuestions'),
            hint: t('progressState.generatingQuestionsHint'),
          }
        : busy === 'draft_formulation'
          ? {
              label: t('progressState.draftFormulation'),
              hint: t('progressState.draftFormulationHint'),
            }
          : null;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="panel-surface p-6 md:p-8">
        <p className="eyebrow">{t('eyebrow')}</p>
        <h1 className="mt-4 text-2xl font-black txt-strong">{t('pageTitle')}</h1>
        <FeatureHint feature="formulation" className="mt-4" />
        {phase !== 'complete' && (
          <>
            <p className="mt-2 text-xs txt-muted">
              {t('progress', {current: progress.current, total: progress.total})}
            </p>
            <div className="mt-3 h-1 overflow-hidden rounded-full fill-3">
              <div
                className="h-full rounded-full bg-[var(--accent)] transition-all duration-500"
                style={{width: `${stepPercent}%`}}
              />
            </div>
          </>
        )}
        {error && (
          <p className="mt-3 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            {error}
          </p>
        )}
        <FormulationExportMenu session={session} liveDraft={liveDraft} />
      </header>

      <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <section className="panel-surface p-6 md:p-8">
      {busyOverlay && (
        <div className="mb-6">
          <WizardBusyOverlay label={busyOverlay.label} hint={busyOverlay.hint} />
        </div>
      )}
      <div key={wizardStepKey} className={busyOverlay ? 'pointer-events-none opacity-40' : undefined}>
        {phase === 'consent' && serverProfile && (
          <ConsentStep
            loading={saving}
            locks={participantProfileLocksFromPreferences(loadUserPreferences())}
            initial={(() => {
              const prefs = loadUserPreferences();
              const locks = participantProfileLocksFromPreferences(prefs);
              const sessionGender = session.participant_gender;
              const gender: ParticipantGender | null =
                locks.gender && prefs.gender
                  ? prefs.gender
                  : sessionGender && isParticipantGender(sessionGender)
                    ? sessionGender
                    : serverProfile.gender && isParticipantGender(serverProfile.gender)
                      ? serverProfile.gender
                      : prefs.gender ?? null;
              const agePreferNot = prefs.age_prefer_not === true;
              const age =
                locks.age && (prefs.age != null || agePreferNot)
                  ? prefs.age ?? null
                  : session.participant_age ?? serverProfile.age ?? prefs.age ?? null;
              const contexts =
                session.life_context_statuses.length > 0
                  ? session.life_context_statuses
                  : locks.life_context_statuses
                    ? (prefs.life_context_statuses ?? serverProfile.life_context_statuses)
                    : serverProfile.life_context_statuses.length > 0
                      ? serverProfile.life_context_statuses
                      : (prefs.life_context_statuses ?? []);
              return {
                life_context_statuses: contexts,
                life_context_status_note: session.life_context_status_note ?? undefined,
                gender,
                age: agePreferNot && locks.age ? null : age,
                age_prefer_not: agePreferNot,
              };
            })()}
            onDraftChange={onConsentDraft}
            onSubmit={async (input) => {
              await patchAndSet(session.id, {
                phase: 'consent',
                life_context_statuses: input.life_context_statuses,
                life_context_status_note: input.life_context_status_note,
                gender: input.gender,
                age: input.age,
                age_prefer_not: input.age_prefer_not,
                boundaries_ack: input.boundaries_ack,
                consent_version: 'v1',
                next_phase: 'risk',
              });
            }}
          />
        )}

        {phase === 'risk' && (
          <RiskScreenStep
            loading={saving}
            crisisStopped={session.status === 'crisis_stopped'}
            needsFollowUp={riskNeedsFollowUp}
            onSubmit={async (input) => {
              const updated = await patchAndSet(session.id, {
                phase: 'risk',
                ...input,
              });
              if (updated && updated.status !== 'crisis_stopped') {
                setRiskNeedsFollowUp(false);
              }
            }}
          />
        )}

        {phase === 'open' && session.status !== 'crisis_stopped' && (
          <PassiveRatingsStep
            loading={saving}
            questions={guidedQuestions}
            initialRatings={session.passive_ratings}
            onDraftChange={onRatingsDraft}
            onSubmit={async (ratings) => {
              await patchAndSet(session.id, {
                phase: 'open',
                passive_ratings: ratings,
                next_phase: 'dimensions',
              });
            }}
          />
        )}

        {phase === 'dimensions' && (
          <FollowUpStep
            loading={saving}
            followUps={session.rating_follow_ups}
            onDraftChange={onFollowUpDraft}
            onSubmit={async (answers) => {
              await patchAndSet(session.id, {
                phase: 'dimensions',
                prior_question_answers: answers,
                next_phase: 'exploration',
              });
            }}
            onSkipAll={async () => {
              await patchAndSet(session.id, {
                phase: 'dimensions',
                phases_skipped: ['follow_ups'],
                next_phase: 'exploration',
              });
            }}
          />
        )}

        {phase === 'exploration' && (
          <ExplorationStep
            loading={saving}
            session={session}
            locale={locale}
            questions={session.llm_exploration_questions}
            initialAnswers={session.llm_exploration_answers}
            generating={busy === 'generating_questions'}
            loadError={error}
            onDraftChange={onExplorationDraft}
            onLoadQuestions={() => loadExplorationQuestions(session.id)}
            onSubmit={async (answers) => {
              await patchAndSet(session.id, {
                phase: 'exploration',
                llm_exploration_answers: answers,
                next_phase: 'formulation',
              });
            }}
          />
        )}

        {phase === 'formulation' && (
          <FormulationEditStep
            loading={saving}
            session={session}
            draft={session.formulation_draft}
            dimensions={session.dimensions}
            riskLevel={session.risk_level ?? 'none'}
            riskAction={session.risk_action ?? 'continue'}
            onLoadDraft={async () => {
              setBusy('draft_formulation');
              setError(null);
              try {
                const {formulation} = await formulationApi.runAi(
                  session.id,
                  'draft_formulation',
                  locale
                );
                if (formulation) {
                  setSession((s) => (s ? {...s, formulation_draft: formulation} : s));
                  return formulation;
                }
                return null;
              } catch (e) {
                const message = e instanceof Error ? e.message : t('progressState.errorGeneric');
                setError(message);
                return null;
              } finally {
                setBusy(null);
              }
            }}
            onSubmit={async (approved, userEdited) => {
              await patchAndSet(session.id, {
                phase: 'formulation',
                formulation_draft: session.formulation_draft ?? approved,
                formulation_approved: approved,
                user_edited_formulation: userEdited,
                next_phase: 'goal',
              });
            }}
          />
        )}

        {phase === 'goal' && (
          <MicroGoalStep
            loading={saving}
            session={session}
            onSuggest={async () => {
              const res = await formulationApi.runAi(
                session.id,
                'suggest_micro_goal',
                locale
              );
              const suggestions = res.suggestions ?? {};
              return {
                ...suggestions,
                generated_by: suggestions.generated_by ?? res.generated_by,
              };
            }}
            onSubmit={async (handoff) => {
              const patched = await patchAndSet(session.id, {
                phase: 'goal',
                coach_handoff: handoff,
                next_phase: 'complete',
              });
              if (!patched) return;
              setSaving(true);
              try {
                const {session: completed} = await formulationApi.complete(session.id);
                setSession(completed);
                clearFormulationDraftPointer();
              } catch (e) {
                const message = e instanceof Error ? e.message : t('progressState.errorGeneric');
                setError(message);
              } finally {
                setSaving(false);
              }
            }}
          />
        )}

        {phase === 'complete' && <CompleteStep session={session} />}

        {showWizardNav && (
          <WizardStepNav
            loading={saving}
            canGoBack={prevPhase != null}
            canRestart={phase !== 'consent'}
            onBack={() => navigate('back')}
            onRestart={() => navigate('restart')}
          />
        )}
      </div>
        </section>

        <FormulationLiveSummary
          session={session}
          phase={phase}
          locale={locale}
          guidedQuestions={guidedQuestions}
          draft={liveDraft}
        />
      </div>
    </div>
  );
}
