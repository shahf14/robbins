'use client';

import {useLocale, useTranslations} from 'next-intl';
import {useCallback, useEffect, useMemo, useReducer, useRef, useState} from 'react';
import type {AppLocale} from '@/i18n/config';
import type {
  EveningMode,
  EveningResetSession,
  EveningStep,
} from '@/lib/evening-reset-types';
import {EVENING_STEPS_BY_MODE} from '@/lib/evening-reset-types';
import type {LifeContextStatus} from '@/lib/life-coach/types';
import {
  getEveningScheduleDefaults,
  suggestedEveningModeFromSchedule,
} from '@/lib/schedule-content';
import {
  capEveningRitualMode,
  type EmotionalStageRouting,
} from '@/lib/formulation/emotional-stage-routing';
import {
  computeReadinessScore,
  fetchEveningBootContext,
  fetchEveningSessions,
  getEveningStreak,
  persistEveningSession,
  persistEveningSessionWithFallback,
} from '@/lib/evening-reset-storage';
import type {EveningResetPainContext} from '@/lib/evening-reset/pain-context';
import type {AccountabilityContext} from '@/lib/formulation/accountability-routing';
import type {MeditationRecommendation} from '@/lib/formulation/meditation-routing';
import {buildEveningBriefingFields} from '@/lib/evening-reset/briefing';
import {buildTomorrowTakeawayFallback} from '@/lib/evening-reset/tomorrow-takeaway';
import {generateEveningAiInsight} from '@/lib/evening-reset/ai-insight';
import {loadUserPreferences, subscribeUserPreferences} from '@/lib/user-preferences';
import {fetchPersonalizedVisualization} from '@/lib/ritual-visualization-storage';
import type {PersonalizedVisualization} from '@/lib/formulation/visualization-context';
import {FeatureHint} from '@/components/feedback/feature-hint';
import {useFeatureVisit} from '@/hooks/use-feature-visit';
import {
  ModeSelectScreen,
  ProgressBar,
  StartScreen,
} from '@/components/evening-reset/evening-reset-shell';
import {CompletionScreen} from '@/components/evening-reset/evening-reset-completion';
import {
  AiInsightStep,
  CompletionReviewStep,
  EmotionalDumpStep,
  GratitudeStep,
  MoodCheckStep,
  TomorrowsWinStep,
  WinReviewStep,
} from '@/components/evening-reset/evening-reset-reflection-steps';
import {
  EnvironmentDesignStep,
  VisualizationStep,
} from '@/components/evening-reset/evening-reset-planning-steps';
import {
  eveningFormReducer,
  INITIAL_EVENING_FORM,
  type EveningFormState,
} from '@/lib/evening-reset/form-state';

// ─── Main component ───────────────────────────────────────────────────────────

export function EveningReset() {
  const t = useTranslations('eveningReset');
  const tRoot = useTranslations();
  const locale = useLocale() as AppLocale;

  const [step, setStep] = useState<EveningStep>('start');
  const [mode, setMode] = useState<EveningMode>(() => {
    const prefs = loadUserPreferences();
    return suggestedEveningModeFromSchedule(prefs.sleep_time, prefs.life_context_statuses);
  });
  const [session, setSession] = useState<EveningResetSession | null>(null);
  const [sessions, setSessions] = useState<EveningResetSession[]>([]);
  const [form, dispatchForm] = useReducer(eveningFormReducer, INITIAL_EVENING_FORM);
  const {
    dayMood,
    biggestWin,
    successFactors,
    blockers,
    emotionalDump,
    gratitudeItems,
    gratitudeCategories,
    aiInsight,
    tomorrowsWin,
    tomorrowTakeaway,
    preparedItems,
    sleepTarget,
    prepInput,
  } = form;

  const patchForm = useCallback((patch: Partial<EveningFormState>) => {
    dispatchForm({type: 'patch', patch});
  }, []);

  const [personalizedVisualization, setPersonalizedVisualization] =
    useState<PersonalizedVisualization | null>(null);
  const [painContext, setPainContext] = useState<EveningResetPainContext | null>(null);
  const [accountability, setAccountability] = useState<AccountabilityContext | null>(null);
  const [emotionalStage, setEmotionalStage] = useState<EmotionalStageRouting | null>(null);
  const [meditationRecommendation, setMeditationRecommendation] =
    useState<MeditationRecommendation | null>(null);
  const [lifeContexts, setLifeContexts] = useState<LifeContextStatus[]>(
    () => loadUserPreferences().life_context_statuses ?? []
  );

  const startTimeRef = useRef<number>(0);
  const completingRef = useRef(false);
  const skippedStepsRef = useRef<string[]>([]);

  const ignoreBootFetchError = useCallback(() => {
    // Boot context is best-effort; the ritual keeps its offline/default behavior when it fails.
  }, []);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void fetchEveningSessions()
        .then((items) => {
          if (!cancelled) setSessions(items);
        })
        .catch(ignoreBootFetchError);
      void fetchEveningBootContext()
        .then(({painContext: pain, emotionalStage: stage, meditationRecommendation: meditation, accountability: accountabilityCtx}) => {
          if (cancelled) return;
          setPainContext(pain);
          setEmotionalStage(stage);
          setMeditationRecommendation(meditation);
          setAccountability(accountabilityCtx);
        })
        .catch(ignoreBootFetchError);
      void fetchPersonalizedVisualization(locale)
        .then((visualization) => {
          if (!cancelled) setPersonalizedVisualization(visualization);
        })
        .catch(ignoreBootFetchError);
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [ignoreBootFetchError, locale]);

  useEffect(
    () =>
      subscribeUserPreferences(() => {
        setLifeContexts(loadUserPreferences().life_context_statuses ?? []);
      }),
    []
  );

  const streak = useMemo(() => getEveningStreak(sessions), [sessions]);
  const completedCount = useMemo(() => sessions.filter((s) => s.completed).length, [sessions]);

  const modeSteps = useMemo(() => EVENING_STEPS_BY_MODE[mode], [mode]);
  const currentStepIndex = modeSteps.indexOf(step);
  const totalSteps = modeSteps.length - 1;

  const goNext = useCallback((overrideMood?: number) => {
    const mood = overrideMood ?? dayMood;
    const idx = modeSteps.indexOf(step);
    if (idx >= modeSteps.length - 1) return;

    const nextStep = modeSteps[idx + 1];

    // After mood-check: if day was hard (mood ≤ 2) skip win-review entirely
    if (step === 'mood-check' && nextStep === 'win-review' && mood !== null && mood <= 2) {
      // Find emotional-dump or fallback to the step after win-review
      const dumpIdx = modeSteps.indexOf('emotional-dump');
      if (dumpIdx > idx) {
        skippedStepsRef.current = [...skippedStepsRef.current, 'win-review'];
        setStep(modeSteps[dumpIdx]);
        return;
      }
    }

    setStep(nextStep);
  }, [modeSteps, step, dayMood]);

  const goBack = useCallback(() => {
    const idx = modeSteps.indexOf(step);
    if (idx > 0) {
      setStep(modeSteps[idx - 1]);
    } else {
      setStep('mode-select');
    }
  }, [modeSteps, step]);

  const skipStep = useCallback(() => {
    skippedStepsRef.current = [...skippedStepsRef.current, step];
    goNext();
  }, [step, goNext]);

  function startReset(selectedMode: EveningMode) {
    const cappedMode = capEveningRitualMode(selectedMode, emotionalStage);
    setMode(cappedMode);
    startTimeRef.current = Date.now();
    skippedStepsRef.current = [];

    const newSession: EveningResetSession = {
      id: crypto.randomUUID(),
      mode: cappedMode,
      language: locale,
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationSeconds: 0,
      completed: false,
      biggestWin: '',
      successFactors: '',
      blockers: '',
      emotionalDump: '',
      gratitudeItems: ['', '', ''],
      gratitudeCategories: [],
      aiInsight: '',
      tomorrowsWin: '',
      preparedItems: [],
      sleepTarget: '',
      readinessScore: 0,
    };
    setSession(newSession);

    const prefs = loadUserPreferences();
    const eveningDefaults = getEveningScheduleDefaults(prefs.sleep_time, locale);
    dispatchForm({
      type: 'reset',
      preparedItems: [eveningDefaults.screenOffSuggestion],
      sleepTarget: eveningDefaults.sleepTarget,
    });

    setStep(EVENING_STEPS_BY_MODE[selectedMode][0]);
  }

  function advanceToAiInsight() {
    const partial: Partial<EveningResetSession> = {
      biggestWin,
      successFactors,
      blockers,
      emotionalDump,
      gratitudeItems,
      tomorrowsWin,
    };
    const insight = generateEveningAiInsight(partial, t, painContext);
    patchForm({aiInsight: insight});
    goNext();
  }

  function completeReset() {
    if (completingRef.current || !session) return;
    completingRef.current = true;

    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    const partial: Partial<EveningResetSession> = {
      biggestWin,
      successFactors,
      blockers,
      emotionalDump,
      gratitudeItems,
      tomorrowsWin,
      preparedItems,
    };
    const score = computeReadinessScore(partial);
    const briefingFields = buildEveningBriefingFields({
      locale,
      successFactors,
      blockers,
      biggestWin,
      emotionalDump,
      tomorrowsWin,
      dayMood,
    });

    const takeaway = buildTomorrowTakeawayFallback({
      locale,
      session: {
        tomorrowsWin,
        blockers,
        biggestWin,
        successFactors,
        dayMood: dayMood ?? undefined,
        ...briefingFields,
      },
      briefing: briefingFields,
    });

    const finalSession: EveningResetSession = {
      ...session,
      completedAt: new Date().toISOString(),
      durationSeconds: duration,
      completed: true,
      dayMood: dayMood ?? undefined,
      biggestWin,
      successFactors,
      blockers,
      emotionalDump,
      gratitudeItems,
      gratitudeCategories,
      aiInsight,
      tomorrowsWin,
      preparedItems,
      sleepTarget,
      readinessScore: score,
      skippedSteps: skippedStepsRef.current,
      emotionalDumpWordCount: emotionalDump.trim().split(/\s+/).filter(Boolean).length,
      blockerMentioned: !!blockers.trim(),
      tomorrow_takeaway: takeaway,
      ...briefingFields,
    };

    void (async () => {
      try {
        const saved = await persistEveningSession(finalSession);
        const persisted = saved
          ? {
              ...finalSession,
              tomorrow_takeaway: saved.tomorrow_takeaway ?? finalSession.tomorrow_takeaway,
            }
          : finalSession;
        setSession(persisted);
        setSessions((prev) => [persisted, ...prev.filter((s) => s.id !== persisted.id)]);
        patchForm({tomorrowTakeaway: persisted.tomorrow_takeaway ?? takeaway});
        setStep('complete');
      } catch {
        persistEveningSessionWithFallback(finalSession);
        patchForm({tomorrowTakeaway: takeaway});
        setSession(finalSession);
        setSessions((prev) => [finalSession, ...prev.filter((s) => s.id !== finalSession.id)]);
        setStep('complete');
      } finally {
        completingRef.current = false;
      }
    })();
  }

  // ── Screens ─────────────────────────────────────────────────────────────────

  if (step === 'start') {
    return (
      <StartScreen
        t={t}
        streak={streak}
        completedCount={completedCount}
        painContext={painContext}
        locale={locale}
        onSelectMode={startReset}
        onAdvancedStart={() => setStep('mode-select')}
      />
    );
  }

  if (step === 'mode-select') {
    return (
      <ModeSelectScreen
        t={t}
        onSelect={startReset}
        onBack={() => setStep('start')}
        emotionalStage={emotionalStage}
      />
    );
  }

  if (step === 'complete') {
    const score = session?.readinessScore ?? 0;
    return (
      <CompletionScreen
        t={t}
        biggestWin={biggestWin}
        tomorrowsWin={tomorrowsWin}
        tomorrowTakeaway={tomorrowTakeaway}
        gratitudeItems={gratitudeItems}
        preparedItems={preparedItems}
        readinessScore={score}
        streak={streak + 1}
      />
    );
  }

  // Active flow steps
  const progressCurrent = currentStepIndex + 1;

  return (
    <div className="mx-auto max-w-xl space-y-2 py-8">
      <FeatureHint feature="evening_reset" className="mb-2" />
      <ProgressBar current={progressCurrent} total={totalSteps} />
      <p className="text-center text-xs txt-muted">
        {t('common.step', {current: progressCurrent, total: totalSteps})}
      </p>

      {step === 'mood-check' && (
        <MoodCheckStep
          t={t}
          value={dayMood}
          onSelect={(mood) => {
            patchForm({dayMood: mood});
            goNext(mood);
          }}
        />
      )}

      {step === 'win-review' && (
        <WinReviewStep
          t={t}
          tRoot={tRoot}
          locale={locale}
          lifeContexts={lifeContexts}
          painContext={painContext}
          accountability={accountability}
          value={biggestWin}
          onChange={(value) => patchForm({biggestWin: value})}
          onBack={goBack}
          onNext={goNext}
          onSkip={skipStep}
          dayMood={dayMood}
        />
      )}

      {step === 'completion-review' && (
        <CompletionReviewStep
          t={t}
          painContext={painContext}
          successFactors={successFactors}
          setSuccessFactors={(value) => patchForm({successFactors: value})}
          blockers={blockers}
          setBlockers={(value) => patchForm({blockers: value})}
          onBack={goBack}
          onNext={goNext}
          onSkip={skipStep}
        />
      )}

      {step === 'emotional-dump' && (
        <EmotionalDumpStep
          t={t}
          value={emotionalDump}
          onChange={(value) => patchForm({emotionalDump: value})}
          onBack={goBack}
          onNext={goNext}
          onSkip={skipStep}
        />
      )}

      {step === 'gratitude' && (
        <GratitudeStep
          t={t}
          items={gratitudeItems}
          setItems={(value) => patchForm({gratitudeItems: value})}
          categories={gratitudeCategories}
          setCategories={(value) => patchForm({gratitudeCategories: value})}
          onBack={goBack}
          onNext={goNext}
          onSkip={skipStep}
        />
      )}

      {step === 'ai-insight' && (
        <AiInsightStep
          t={t}
          insight={aiInsight}
          onBack={goBack}
          onNext={advanceToAiInsight}
        />
      )}

      {step === 'tomorrows-win' && (
        <TomorrowsWinStep
          t={t}
          tRoot={tRoot}
          lifeContexts={lifeContexts}
          painContext={painContext}
          value={tomorrowsWin}
          onChange={(value) => patchForm({tomorrowsWin: value})}
          onBack={goBack}
          onNext={
            modeSteps.indexOf('tomorrows-win') === modeSteps.length - 2
              ? completeReset
              : goNext
          }
          isFinalStep={modeSteps.indexOf('tomorrows-win') === modeSteps.length - 2}
        />
      )}

      {step === 'environment-design' && (() => {
        const prefs = loadUserPreferences();
        const eveningDefaults = getEveningScheduleDefaults(prefs.sleep_time, locale);
        return (
          <EnvironmentDesignStep
            t={t}
            lifeContexts={lifeContexts}
            items={preparedItems}
            setItems={(value) => patchForm({preparedItems: value})}
            input={prepInput}
            setInput={(value) => patchForm({prepInput: value})}
            sleepTarget={sleepTarget}
            setSleepTarget={(value) => patchForm({sleepTarget: value})}
            sleepTime={prefs.sleep_time}
            screenOffHint={eveningDefaults.screenOffSuggestion}
            onBack={goBack}
            onNext={goNext}
            onSkip={skipStep}
          />
        );
      })()}

      {step === 'visualization' && (
        <VisualizationStep
          t={t}
          tomorrowsWin={tomorrowsWin}
          personalized={personalizedVisualization}
          meditation={meditationRecommendation}
          onBack={goBack}
          onNext={completeReset}
        />
      )}
    </div>
  );
}

// ─── CompletionScreen ─────────────────────────────────────────────────────────
