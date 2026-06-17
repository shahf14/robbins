'use client';

import {useCallback, useEffect, useRef, useState} from 'react';
import {useLocale, useTranslations} from 'next-intl';
import {useRouter} from '@/i18n/navigation';
import type {AppLocale} from '@/i18n/config';
import type {
  AvailableTimePerDay,
  IntensityPreference,
  LifeContextStatus,
  LifeDomain,
} from '@/lib/life-coach/types';
import {LIFE_DOMAINS} from '@/lib/life-coach/types';
import {normalizeLifeContextSelection} from '@/lib/formulation/life-context';
import {formulationApi, lifeCoachApi} from '@/lib/life-coach/api-client';
import {generateDomainDailySteps} from '@/lib/life-coach/generate-domain-daily-steps';
import {goalIdSchema, requireGoalId} from '@/lib/life-coach/schemas';
import {
  loadUserPreferences,
  saveUserPreferences,
} from '@/lib/user-preferences';
import {
  isOnboardingComplete,
  markOnboardingCompleteOnServer,
  saveOnboardingState,
} from '@/lib/onboarding-state';
import {
  EMPTY_QUICK_CLARIFICATION,
  isQuickClarificationReady,
} from '@/lib/onboarding-clarification';
import {DraftSavedIndicator} from '@/components/feedback/draft-saved-indicator';
import {AiGeneratingProgress} from '@/components/life-coach/shared/ai-generating-progress';
import {Step1BasicInfo} from './step1-basic-info';
import {Step2DomainScores} from './onboarding-step2-domain-scores';
import {Step3Clarification} from './step3-clarification';
import {
  aiPayload,
  callOnboardingAi,
  clearDraft,
  INITIAL_ONBOARDING_WIZARD_STATE,
  loadDraft,
  localDatePlusDays,
  saveDraft,
  TOTAL_STEPS,
  type Answers,
  type ProposedGoal,
  type WizardState,
} from '@/lib/onboarding-wizard-state';
import {
  Step4GoalProposal,
  Step5FirstWin,
  Step6Celebration,
} from './onboarding-final-steps';

function createInitialWizardState(browserLocale: AppLocale): WizardState {
  const prefs = loadUserPreferences();
  return {
    ...INITIAL_ONBOARDING_WIZARD_STATE,
    locale:                 browserLocale,
    name:                   prefs.display_name,
    gender:                 prefs.gender ?? null,
    lifeContextStatuses:    prefs.life_context_statuses ?? [],
    lifeContextNote:        prefs.life_context_note ?? '',
    wakeTime:               prefs.wake_time,
    sleepTime:              prefs.sleep_time,
    preferredActionWindow:  prefs.preferred_action_window,
    availableTime:          prefs.available_time_per_day,
    intensityPreference:    prefs.intensity_preference,
    coachingStyle:          prefs.coaching_style,
    familyStatus:           prefs.family_status ?? '',
    age:                    prefs.age != null ? String(prefs.age) : '',
    agePreferNot:           prefs.age_prefer_not === true,
    physicalConsiderations: prefs.physical_considerations ?? [],
  };
}

// ── Constants ──────────────────────────────────────────────────────────────────


// ── Main component ─────────────────────────────────────────────────────────────

export function OnboardingWizard() {
  const router        = useRouter();
  const browserLocale = useLocale() as AppLocale;
  const t             = useTranslations();

  useEffect(() => {
    if (isOnboardingComplete()) router.replace('/');
  }, [router]);

  const [s, setS] = useState<WizardState>(() => {
    const base = createInitialWizardState(browserLocale);
    const draft = loadDraft();
    if (draft) {
      return {
        ...base,
        ...draft,
        locale:         browserLocale,
        draftRestored:  true,
        error:          null,
        saving:         false,
        insightLoading: false,
        goalLoading:    false,
        stepLoading:    false,
      };
    }
    return base;
  });

  const set = useCallback((patch: Partial<WizardState>) =>
    setS((prev) => ({
      ...prev,
      ...patch,
      // Auto-dismiss draft banner on any step navigation
      ...(patch.step !== undefined && patch.step !== prev.step ? {draftRestored: false} : {}),
    })), []);

  const [draftSavedAt, setDraftSavedAt] = useState<number | null>(null);

  // Persist draft whenever relevant state changes
  useEffect(() => {
    if (s.step === 6) { clearDraft(); return; }
    if (s.step > 1) {
      saveDraft(s);
      const id = window.setTimeout(() => setDraftSavedAt(Date.now()), 0);
      return () => window.clearTimeout(id);
    }
  }, [s]);

  // Corrupted draft may reach step 5/6 without a domain — recover instead of crashing
  useEffect(() => {
    if (
      (s.step === 5 || s.step === 6) &&
      (!s.selectedDomain || !LIFE_DOMAINS.includes(s.selectedDomain))
    ) {
      const id = window.setTimeout(() => {
        set({
          step: 2,
          selectedDomain: null,
          goalId: null,
          firstStep: null,
          proposedGoal: null,
          error: null,
        });
      }, 0);
      return () => window.clearTimeout(id);
    }
  }, [s.step, s.selectedDomain, set]);

  // Holds a prefetched goal_proposal promise started while the user reads insight
  const prefetchedGoalRef = useRef<Promise<Record<string, unknown> | null> | null>(null);
  /** Bumped when the user navigates back or starts a new generation — stale async work is ignored. */
  const generationEpochRef = useRef(0);

  function cancelInFlightGeneration() {
    generationEpochRef.current += 1;
    prefetchedGoalRef.current = null;
  }

  function isGenerationStale(epoch: number) {
    return epoch !== generationEpochRef.current;
  }

  // ── Step transitions ───────────────────────────────────────────────────────────

  function goToStep3() {
    cancelInFlightGeneration();
    set({
      step: 3,
      insight: null,
      quickClarification: EMPTY_QUICK_CLARIFICATION,
      insightLoading: false,
      goalLoading: false,
      error: null,
    });
  }

  function goBackFromStep3() {
    cancelInFlightGeneration();
    set({
      step: 2,
      insight: null,
      quickClarification: EMPTY_QUICK_CLARIFICATION,
      insightLoading: false,
      goalLoading: false,
      error: null,
    });
  }

  function persistStep1Profile(state: WizardState) {
    const contexts = normalizeLifeContextSelection(state.lifeContextStatuses);
    const parsedAge = state.age && !state.agePreferNot ? parseInt(state.age, 10) : undefined;
    const validAge = parsedAge && !Number.isNaN(parsedAge) ? parsedAge : undefined;
    saveUserPreferences({
      display_name: state.name.trim() || undefined,
      preferred_language: state.locale,
      gender: state.gender ?? undefined,
      life_context_statuses: contexts.length > 0 ? contexts : undefined,
      life_context_note: state.lifeContextNote.trim() || undefined,
      family_status: state.familyStatus || undefined,
      age: validAge,
      age_prefer_not: state.agePreferNot || undefined,
      wake_time: state.wakeTime,
      sleep_time: state.sleepTime,
      preferred_action_window: state.preferredActionWindow,
      available_time_per_day: state.availableTime,
      intensity_preference: state.intensityPreference,
      coaching_style: state.coachingStyle,
      physical_considerations: state.physicalConsiderations.length
        ? state.physicalConsiderations
        : undefined,
    });
  }

  function goToStep2() {
    setS((prev) => {
      persistStep1Profile(prev);
      return {...prev, step: 2, draftRestored: false};
    });
  }

  function goBackFromStep4() {
    cancelInFlightGeneration();
    set({step: 3, goalLoading: false, saving: false, stepLoading: false, error: null});
  }

  async function generateInsight(overrideAnswers?: Answers, articulationHelp = false) {
    if (!s.selectedDomain) return;
    const epoch = ++generationEpochRef.current;
    prefetchedGoalRef.current = null;

    const answers = overrideAnswers ?? s.answers;
    set({answers, insightLoading: true, error: null});

    // Fire goal_proposal in the background so step 4 loads instantly
    prefetchedGoalRef.current = callOnboardingAi('goal_proposal', aiPayload(s, s.selectedDomain, {
      mode: 'goal_proposal',
      answers,
      domainScore: s.domainScores[s.selectedDomain],
    })).catch((): null => null);

    try {
      const data = await callOnboardingAi('insight', aiPayload(s, s.selectedDomain, {
        mode: 'insight',
        answers,
        articulationHelp,
      }));
      if (isGenerationStale(epoch)) return;
      set({insight: data.insight as string, insightLoading: false});
    } catch {
      if (isGenerationStale(epoch)) return;
      // Server has built-in fallback text, so a genuine network failure is the
      // only way we land here. Surface a localized message instead of silently
      // leaving the button disabled.
      set({insightLoading: false, error: t('onboarding.aiError')});
    }
  }

  async function advanceFromInsight() {
    if (!s.selectedDomain) return;
    const epoch = generationEpochRef.current;
    set({goalLoading: true, error: null, proposedGoal: null});
    try {
      // Use the prefetched result from generateInsight if ready, otherwise fetch now
      const prefetched = prefetchedGoalRef.current ? await prefetchedGoalRef.current : null;
      if (isGenerationStale(epoch)) return;
      prefetchedGoalRef.current = null;

      const data = prefetched ?? await callOnboardingAi('goal_proposal', aiPayload(s, s.selectedDomain, {
        mode:        'goal_proposal',
        answers:     s.answers,
        domainScore: s.domainScores[s.selectedDomain],
      }));
      if (isGenerationStale(epoch)) return;

      const proposal: ProposedGoal = {
        title:          (data?.title          as string) || '',
        description:    (data?.description    as string) || '',
        success_metric: (data?.success_metric as string) || s.answers.whatIfSucceeds.slice(0, 200),
      };
      set({
        proposedGoal:        proposal,
        editedTitle:         proposal.title,
        editedSuccessMetric: proposal.success_metric,
        goalLoading:         false,
        step:                4,
      });
    } catch {
      if (isGenerationStale(epoch)) return;
      set({goalLoading: false, error: t('onboarding.aiError')});
    }
  }

  async function saveGoalAndContinue() {
    if (!s.selectedDomain) return;
    set({saving: true, error: null});

    // Deadline: 90 local calendar days from today (avoid UTC shift from toISOString)
    const deadlineStr = localDatePlusDays(90);

    const goalTitle     = s.editedTitle.trim()         || s.proposedGoal?.title || '';
    const successMetric = s.editedSuccessMetric.trim() || s.answers.whatIfSucceeds.trim().slice(0, 200) || 'Consistent daily progress over 90 days';

    const parsedExistingGoalId = goalIdSchema.safeParse(s.goalId);
    let goalId: string | null = parsedExistingGoalId.success ? parsedExistingGoalId.data : null;
    let createdGoalThisAttempt = false;

    try {
      if (!goalId) {
        // 1. Save domain assessment
        await lifeCoachApi.saveAssessment(s.selectedDomain, {
          current_score:          s.domainScores[s.selectedDomain],
          current_state:          s.answers.whatBothersToday.slice(0, 400) || `Score: ${s.domainScores[s.selectedDomain]}/10`,
          desired_state:          s.answers.whatIfSucceeds.slice(0, 400)   || 'Consistent improvement over 90 days',
          main_blockers:          [],
          available_time_per_day: s.availableTime,
          intensity_preference:   s.intensityPreference,
        });

        // 2. Create goal
        const goalRes = await lifeCoachApi.createGoal({
          goal: {
            domain:         s.selectedDomain,
            title:          goalTitle,
            description:    s.proposedGoal?.description.trim() || goalTitle,
            success_metric: successMetric,
            deadline:       deadlineStr,
          },
          milestones:    [],
          initial_steps: [],
        });
        goalId = requireGoalId(goalRes.goal?.id, t('onboarding.goalCreateError'));
        createdGoalThisAttempt = true;
        set({goalId});
      }

      // 3. Get first step suggestion
      set({stepLoading: true});
      const stepData = await callOnboardingAi('first_step', aiPayload(s, s.selectedDomain, {
        mode:     'first_step',
        goalText: goalTitle,
      }));

      set({
        saving:      false,
        stepLoading: false,
        goalId,
        firstStep: {
          title:             stepData.title             as string,
          description:       (stepData.description      as string) ?? '',
          estimated_minutes: (stepData.estimated_minutes as number) ?? 5,
        },
        step: 5,
      });
    } catch (e) {
      if (goalId && createdGoalThisAttempt) {
        try {
          await lifeCoachApi.deleteGoal(goalId);
        } catch {
          // Best-effort rollback — surface the original error below
        }
        goalId = null;
      }
      set({
        saving: false,
        stepLoading: false,
        goalId,
        error: e instanceof Error ? e.message : t('onboarding.genericError'),
      });
    }
  }

  async function markFirstStepDone() {
    set({saving: true, error: null});
    try {
      if (!s.firstStep?.title?.trim()) {
        throw new Error(t('onboarding.firstTaskMissingError'));
      }
      if (!s.selectedDomain) {
        throw new Error(t('onboarding.firstTaskSaveError'));
      }

      const goalId = requireGoalId(s.goalId, t('onboarding.firstTaskMissingError'));

      await lifeCoachApi.createDailyStep({
        goal_id:           goalId,
        domain:            s.selectedDomain,
        title:             s.firstStep.title,
        description:       s.firstStep.description,
        estimated_minutes: s.firstStep.estimated_minutes,
        difficulty:        'easy',
        scheduled_date:    localDatePlusDays(0),
        status:            'completed',
      });
      await completeOnboarding(true);
    } catch (e) {
      const message =
        e instanceof Error && e.message.trim()
          ? e.message
          : t('onboarding.firstTaskSaveError');
      set({saving: false, error: message});
    }
  }

  async function skipFirstStep() {
    await completeOnboarding(false);
  }

  async function completeOnboarding(firstStepCompleted: boolean) {
    const contexts = normalizeLifeContextSelection(s.lifeContextStatuses);
    const parsedAge = s.age && !s.agePreferNot ? parseInt(s.age, 10) : undefined;
    const validAge  = parsedAge && !Number.isNaN(parsedAge) ? parsedAge : undefined;

    const savedPrefs = saveUserPreferences({
      display_name:            s.name.trim(),
      preferred_language:      s.locale,
      wake_time:               s.wakeTime,
      sleep_time:              s.sleepTime,
      preferred_action_window: s.preferredActionWindow,
      available_time_per_day:  s.availableTime,
      intensity_preference:    s.intensityPreference,
      coaching_style:          s.coachingStyle,
      gender:                  s.gender ?? undefined,
      life_context_statuses:   contexts.length > 0 ? contexts : undefined,
      life_context_note:       s.lifeContextNote.trim() || undefined,
      family_status:           s.familyStatus || undefined,
      age:                     validAge,
      age_prefer_not:          s.agePreferNot || undefined,
      physical_considerations: s.physicalConsiderations.length
        ? s.physicalConsiderations
        : undefined,
    });

    // Await server sync (incl. schedule fields) before marking complete.
    // If it fails we still complete onboarding locally — data is in localStorage as fallback.
    try {
      await formulationApi.updateParticipantProfile({
        life_context_statuses: contexts,
        life_context_note:     s.lifeContextNote.trim() || null,
        gender:                s.gender,
        age:                   s.agePreferNot ? null : (validAge ?? null),
        wake_time:               savedPrefs.wake_time,
        sleep_time:              savedPrefs.sleep_time,
        preferred_action_window: savedPrefs.preferred_action_window,
        coaching_style:        s.coachingStyle,
        family_status:         s.familyStatus || null,
        physical_considerations: s.physicalConsiderations.length ? s.physicalConsiderations : null,
      });
    } catch {
      // Non-fatal: localStorage already saved — profile will sync on next settings visit
    }

    const completedAt = new Date().toISOString();
    saveOnboardingState({
      completedAt,
      startedAt:     new Date().toISOString(),
      primaryDomain: s.selectedDomain,
    });

    try {
      const goalTitle =
        s.editedTitle.trim() || s.proposedGoal?.title?.trim() || '';
      await markOnboardingCompleteOnServer({
        primaryDomain: s.selectedDomain,
        locale: s.locale,
        life_context_note: s.lifeContextNote.trim() || undefined,
        life_context_statuses: contexts.length > 0 ? contexts : undefined,
        available_time: s.availableTime,
        intensity_preference: s.intensityPreference,
        coaching_style: s.coachingStyle,
        answers: s.answers,
        insight: s.insight,
        goal_title: goalTitle || undefined,
        goal_description: s.proposedGoal?.description?.trim() || undefined,
        domain_score: s.selectedDomain ? s.domainScores[s.selectedDomain] : undefined,
      });
    } catch {
      // Local state saved — server gate may block features until next successful sync
    }

    if (s.goalId) {
      try {
        await generateDomainDailySteps(s.locale, false);
      } catch {
        // Non-fatal — domain page will retry auto-generation
      }
    }

    clearDraft();
    set({saving: false, step: 6, firstStepCompleted});
  }

  function enterApp() {
    router.replace('/');
  }

  function startOver() {
    clearDraft();
    setS(createInitialWizardState(browserLocale));
  }

  // ── Progress bar ───────────────────────────────────────────────────────────────
  const pct = Math.round((s.step / TOTAL_STEPS) * 100);

  return (
    <div className="flex min-h-dvh flex-col bg-[var(--color-bg)]">
      <div className={`mx-auto flex w-full flex-1 flex-col px-5 py-8 sm:py-10 ${
        s.step === 2 ? 'max-w-4xl' : 'max-w-2xl'
      }`}>

        {/* ── Draft restore banner ─────────────────────────────────────────── */}
        {s.draftRestored && s.step < 6 && (
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

        {/* ── Progress ─────────────────────────────────────────────────────── */}
        {s.step < 6 && (
          <div className="mb-8">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-sm font-semibold txt-soft">
                {t('onboarding.stepCounter', {step: s.step, total: TOTAL_STEPS})}
              </p>
              {s.step > 1 && <DraftSavedIndicator savedAt={draftSavedAt} />}
            </div>
            <div
              className="h-1.5 w-full overflow-hidden rounded-full fill-3"
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
        )}

        {(s.insightLoading || s.goalLoading || s.stepLoading) && (
          <div className="mb-6">
            <AiGeneratingProgress variant={s.stepLoading ? 'dailySteps' : 'goal'} />
          </div>
        )}

        {/* ── Step renders ────────────────────────────────────────────────── */}
        {s.step === 1 && (
          <Step1BasicInfo s={s} set={set} onNext={goToStep2} />
        )}
        {s.step === 2 && (
          <Step2DomainScores
            s={s}
            set={set}
            onBack={() => set({step: 1})}
            onNext={goToStep3}
          />
        )}
        {s.step === 3 && s.selectedDomain && (
          <Step3Clarification
            locale={s.locale}
            domain={s.selectedDomain}
            domainScore={s.domainScores[s.selectedDomain]}
            domainScores={s.domainScores}
            lifeContextStatuses={s.lifeContextStatuses}
            quickClarification={s.quickClarification}
            onQuickClarificationChange={(quickClarification) =>
              set({
                quickClarification,
                ...(!isQuickClarificationReady(quickClarification) ? {insight: null} : {}),
              })
            }
            insight={s.insight}
            insightLoading={s.insightLoading}
            goalLoading={s.goalLoading}
            setAnswers={(answers) => set({answers})}
            onBack={goBackFromStep3}
            onGenerateInsight={generateInsight}
            onNext={advanceFromInsight}
          />
        )}
        {s.step === 4 && (
          <Step4GoalProposal
            s={s}
            set={set}
            onBack={goBackFromStep4}
            onNext={saveGoalAndContinue}
          />
        )}
        {s.step === 5 && s.selectedDomain && (
          <Step5FirstWin
            s={s}
            onDone={markFirstStepDone}
            onSkip={skipFirstStep}
          />
        )}
        {s.step === 6 && s.selectedDomain && (
          <Step6Celebration
            s={s}
            domain={s.selectedDomain}
            firstStepCompleted={s.firstStepCompleted}
            onEnter={enterApp}
          />
        )}

        {/* ── Global error banner ─────────────────────────────────────────── */}
        {s.error && (
          <div role="alert" className="mt-4 rounded-2xl border border-red-500/25 bg-red-500/8 px-4 py-3 text-sm text-red-300">
            {s.error}
          </div>
        )}
      </div>
    </div>
  );
}
