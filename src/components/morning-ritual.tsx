'use client';

import {useLocale, useTranslations} from 'next-intl';
import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import type {AppLocale} from '@/i18n/config';
import {mergeAffirmationLibrary, persistableAffirmations} from '@/lib/morning-ritual/affirmation-library';
import {DEFAULT_AFFIRMATIONS} from '@/lib/default-affirmations';
import type {GratitudeTriggerKey} from '@/lib/gratitude-data';
import type {
  AffirmationItem,
  BreathingType,
  IdentityOption,
  MorningRitualSession,
  RitualMode,
  RitualStep,
  TimeBlock,
} from '@/lib/morning-ritual-types';
import {BREATHING_PATTERNS, STEPS_BY_MODE} from '@/lib/morning-ritual-types';
import {
  getStreak,
  fetchRitualContent,
  fetchMorningRitualBootContext,
  fetchSessions,
  saveAffirmations,
  saveIdentities,
  persistSessionWithFallback,
} from '@/lib/morning-ritual-storage';
import {
  buildMorningAffirmationContext,
  pickMorningAffirmation,
  type MorningAffirmationContext,
} from '@/lib/morning-ritual/affirmation-context';
import {
  type MorningRitualYesterdayContext,
} from '@/lib/morning-ritual/yesterday-context';
import {
  resolveEffectiveMorningTone,
  suggestedMorningModeForGoalContext,
  type MorningRitualGoalContext,
} from '@/lib/morning-ritual/goal-context';
import {
  classifyGratitudeTarget,
  classifyVisualizationContent,
  isGratitudeGeneric,
} from '@/lib/clinical-analysis';
import {FeatureHint} from '@/components/feedback/feature-hint';
import {useFeatureVisit} from '@/hooks/use-feature-visit';
import {defaultBreathingType} from '@/lib/life-context-content';
import {loadUserPreferences} from '@/lib/user-preferences';
import {
  capMorningRitualMode,
  capMorningToneForEmotionalStage,
  resolveBreathingForEmotionalStage,
  suggestedMorningModeWithEmotionalStage,
  type EmotionalStageRouting,
} from '@/lib/formulation/emotional-stage-routing';
import {
  resolveBreathingTypeForMeditation,
  type MeditationRecommendation,
} from '@/lib/formulation/meditation-routing';
import {fetchPersonalizedVisualization} from '@/lib/ritual-visualization-storage';
import type {PersonalizedVisualization} from '@/lib/formulation/visualization-context';
import {fallbackTagForScores} from '@/lib/morning-ritual-adaptation/calibration';
import {
  ModeSelectScreen,
  ProgressBar,
  StartScreen,
} from '@/components/morning-ritual/morning-ritual-shell';
import {CompletionScreen} from '@/components/morning-ritual/morning-ritual-completion';
import {StepNavigation} from '@/components/morning-ritual/morning-ritual-navigation';
import {
  IdentityStep,
  MissionStep,
  VisualizationStep,
} from '@/components/morning-ritual/morning-ritual-basic-steps';
import {AffirmationStep} from '@/components/morning-ritual/morning-ritual-affirmation-step';
import {BreathingStep} from '@/components/morning-ritual/morning-ritual-breathing-step';
import {GratitudeStep} from '@/components/morning-ritual/morning-ritual-gratitude-step';
import {useToast} from '@/components/feedback/toast-provider';
import {scheduleDeferredRitualCommit} from '@/lib/morning-ritual/deferred-ritual-persist';

export function MorningRitual() {
  const t = useTranslations('morningRitual');
  const locale = useLocale() as AppLocale;
  const toast = useToast();
  useFeatureVisit('morning_ritual');

  const [step, setStep] = useState<RitualStep>('start');
  const [mode, setMode] = useState<RitualMode>('standard');
  const [session, setSession] = useState<MorningRitualSession | null>(null);
  const [sessions, setSessions] = useState<MorningRitualSession[]>([]);
  const [affirmations, setAffirmations] = useState<AffirmationItem[]>([]);
  const [identities, setIdentities] = useState<IdentityOption[]>([]);
  const [yesterdayContext, setYesterdayContext] = useState<MorningRitualYesterdayContext | null>(
    null
  );
  const [goalContext, setGoalContext] = useState<MorningRitualGoalContext | null>(null);
  const [emotionalStage, setEmotionalStage] = useState<EmotionalStageRouting | null>(null);
  const [meditationRecommendation, setMeditationRecommendation] =
    useState<MeditationRecommendation | null>(null);
  const affirmationContextRef = useRef<MorningAffirmationContext | null>(null);
  const [affirmationContext, setAffirmationContext] =
    useState<MorningAffirmationContext | null>(null);

  const [breathingType, setBreathingType] = useState<BreathingType>(() =>
    defaultBreathingType(loadUserPreferences().life_context_statuses)
  );
  const [breathingDone, setBreathingDone] = useState(false);

  const [gratitudeEntries, setGratitudeEntries] = useState<string[]>(['', '', '']);

  const [selectedAffirmation, setSelectedAffirmation] = useState<AffirmationItem | null>(null);

  const [visualizationText, setVisualizationText] = useState('');
  const [showGuidedViz, setShowGuidedViz] = useState(false);
  const [personalizedVisualization, setPersonalizedVisualization] =
    useState<PersonalizedVisualization | null>(null);

  const [identityText, setIdentityText] = useState('');

  const [missionText, setMissionText] = useState('');
  const [timeBlock, setTimeBlock] = useState<TimeBlock | null>(null);
  const [energyScore, setEnergyScore] = useState(6);
  const [focusScore, setFocusScore] = useState(6);

  const startTimeRef = useRef<number>(0);
  const completingRef = useRef(false);
  // Raw behavioral metrics
  const skippedStepsRef = useRef<string[]>([]);
  const breathingRoundsDoneRef = useRef<number>(0);
  const vizStepStartRef = useRef<number | null>(null);
  // Psychological metrics
  const lastGratitudeTriggerRef = useRef<GratitudeTriggerKey | null>(null);
  const gratitudeTriggerKeysRef = useRef<Array<GratitudeTriggerKey | null>>([null, null, null]);
  const gratitudeWasEditedRef = useRef<boolean[]>([false, false, false]);
  const gratitudeEntryDurationsRef = useRef<number[]>([0, 0, 0]);

  useEffect(() => {
    let cancelled = false;
    const timeout = window.setTimeout(() => {
      void fetchSessions()
        .then((items) => {
          if (!cancelled) setSessions(items);
        })
        .catch(() => {});
      void fetchMorningRitualBootContext()
        .then(({yesterday, goal, emotionalStage: stage, meditationRecommendation: meditation}) => {
          if (cancelled) return;
          setYesterdayContext(yesterday);
          setGoalContext(goal);
          setEmotionalStage(stage);
          setMeditationRecommendation(meditation);
        })
        .catch(() => {});
      void fetchPersonalizedVisualization(locale)
        .then((visualization) => {
          if (!cancelled) setPersonalizedVisualization(visualization);
        })
        .catch(() => {});
      void fetchRitualContent().then(({affirmations: userAff, identities: savedIdentities}) => {
        if (cancelled) return;
        const merged = mergeAffirmationLibrary(userAff);
        setAffirmations(merged.length > 0 ? merged : DEFAULT_AFFIRMATIONS);
        setIdentities(savedIdentities);
      }).catch(() => {});
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [locale]);

  const lifeContexts = useMemo(
    () =>
      goalContext?.life_context_statuses.length
        ? goalContext.life_context_statuses
        : (loadUserPreferences().life_context_statuses ?? []),
    [goalContext]
  );

  const effectiveTone = useMemo(
    () =>
      capMorningToneForEmotionalStage(
        resolveEffectiveMorningTone(
          yesterdayContext?.tone ?? 'steady',
          goalContext,
          yesterdayContext?.today_energy ?? null
        ),
        emotionalStage
      ),
    [yesterdayContext, goalContext, emotionalStage]
  );

  const suggestedMode = useMemo(
    () =>
      suggestedMorningModeWithEmotionalStage(
        suggestedMorningModeForGoalContext(lifeContexts, effectiveTone, goalContext),
        emotionalStage
      ),
    [lifeContexts, effectiveTone, goalContext, emotionalStage]
  );

  const streak = useMemo(() => getStreak(sessions), [sessions]);
  const completedCount = useMemo(() => sessions.filter((s) => s.completed).length, [sessions]);
  const lastSession = sessions.find((s) => s.completed);

  const modeSteps = useMemo(() => STEPS_BY_MODE[mode], [mode]);
  const currentStepIndex = modeSteps.indexOf(step);
  const totalSteps = modeSteps.length - 1;

  const goNext = useCallback(() => {
    const idx = modeSteps.indexOf(step);
    if (idx < modeSteps.length - 1) {
      setStep(modeSteps[idx + 1]);
    }
  }, [modeSteps, step]);

  const goBack = useCallback(() => {
    const idx = modeSteps.indexOf(step);
    if (idx > 0) {
      setStep(modeSteps[idx - 1]);
    } else {
      setStep('mode-select');
    }
  }, [modeSteps, step]);

  function startRitual(selectedMode: RitualMode, moodBefore: number | null = null) {
    const cappedMode = capMorningRitualMode(selectedMode, emotionalStage);
    setMode(cappedMode);
    startTimeRef.current = Date.now();

    const newSession: MorningRitualSession = {
      id: crypto.randomUUID(),
      mode: cappedMode,
      language: locale,
      startedAt: new Date().toISOString(),
      completedAt: null,
      durationSeconds: 0,
      completed: false,
      breathingCompleted: false,
      breathingType: 'default',
      gratitudeEntries: [],
      selectedAffirmationId: null,
      identityText: '',
      dailyMission: '',
      missionTimeBlock: null,
      visualizationText: '',
      moodBefore: moodBefore ? String(moodBefore) : null,
      moodAfter: null,
    };
    setSession(newSession);

    const ritualTone = effectiveTone;
    const affirmationContext = buildMorningAffirmationContext({
      yesterday: {
        ...(yesterdayContext ?? {
          yesterday_date: '',
          yesterday_completed_count: 0,
          yesterday_skip_count: 0,
          yesterday_total_steps: 0,
          evening_mood: null,
          main_blocker: null,
          tone: 'steady',
          active_goal_domain: null,
          today_energy: null,
          today_mood_tag: null,
          tomorrows_win: null,
          tomorrow_takeaway: null,
        }),
        tone: ritualTone,
        active_goal_domain: goalContext?.domain ?? yesterdayContext?.active_goal_domain ?? null,
      },
      moodBefore,
      lifeContexts,
    });
    affirmationContextRef.current = affirmationContext;
    setAffirmationContext(affirmationContext);

    setBreathingDone(false);
    setBreathingType(
      resolveBreathingTypeForMeditation(
        meditationRecommendation,
        resolveBreathingForEmotionalStage(emotionalStage, lifeContexts, ritualTone)
      )
    );
    setGratitudeEntries(cappedMode === 'quick' ? [''] : ['', '', '']);
    setVisualizationText('');
    setShowGuidedViz(false);
    setIdentityText('');
    setMissionText('');
    setTimeBlock(null);
    setEnergyScore(6);
    setFocusScore(6);
    // Reset behavioral & psychological metric trackers
    completingRef.current = false;
    skippedStepsRef.current = [];
    breathingRoundsDoneRef.current = 0;
    vizStepStartRef.current = null;
    lastGratitudeTriggerRef.current = null;
    gratitudeTriggerKeysRef.current = [null, null, null];
    gratitudeWasEditedRef.current = [false, false, false];
    gratitudeEntryDurationsRef.current = [0, 0, 0];

    const aff = pickMorningAffirmation(affirmations, locale, affirmationContext);
    setSelectedAffirmation(aff);

    setStep(STEPS_BY_MODE[selectedMode][0]);
  }

  function completeRitual() {
    if (!session || completingRef.current) return;
    completingRef.current = true;

    const collectBehavioralAnalytics = loadUserPreferences().behavioral_analytics_enabled;
    const duration = Math.round((Date.now() - startTimeRef.current) / 1000);
    // Capture visualization duration (set when leaving visualization step, or still open)
    const vizDuration = vizStepStartRef.current
      ? Math.round((Date.now() - vizStepStartRef.current) / 1000)
      : session.visualizationDurationSec ?? undefined;

    // Compute psychological metrics
    const filledEntries = gratitudeEntries.filter((e) => e.trim());
    const recentGratitudeTexts: string[] = sessions
      .slice(0, 7)
      .flatMap((s) => s.gratitudeEntries);
    const gratitudeTargetTypes = filledEntries.map((e) => classifyGratitudeTarget(e, locale));
    const gratitudeGenericFlags = filledEntries.map((e, i) =>
      isGratitudeGeneric(e, recentGratitudeTexts.filter((_, j) => j !== i), locale) ? 1 : 0
    );
    const visualizationContentType = visualizationText.trim()
      ? classifyVisualizationContent(visualizationText, locale)
      : undefined;
    const breathingPattern = BREATHING_PATTERNS[breathingType];
    const breathingFullPatternDone =
      breathingRoundsDoneRef.current >= breathingPattern.rounds;
    const lastMission = sessions.find((item) => item.completed)?.dailyMission ?? '';
    const missionChangedFromYesterday = !!(lastMission && lastMission.trim() !== missionText.trim());
    const completed: MorningRitualSession = {
      ...session,
      completedAt: new Date().toISOString(),
      durationSeconds: collectBehavioralAnalytics ? duration : 0,
      completed: true,
      breathingCompleted: breathingDone,
      breathingType,
      gratitudeEntries: filledEntries,
      selectedAffirmationId: selectedAffirmation?.id ?? null,
      identityText,
      dailyMission: missionText,
      missionTimeBlock: timeBlock,
      energyScore,
      focusScore,
      primaryTag: fallbackTagForScores(focusScore, energyScore),
      visualizationText,
      // Raw behavioral metrics
      breathingRoundsDone: collectBehavioralAnalytics ? breathingRoundsDoneRef.current || undefined : undefined,
      skippedSteps: collectBehavioralAnalytics && skippedStepsRef.current.length > 0 ? skippedStepsRef.current : undefined,
      visualizationDurationSec: collectBehavioralAnalytics ? vizDuration : undefined,
      // Psychological metrics
      gratitudeTargetTypes: collectBehavioralAnalytics ? gratitudeTargetTypes : undefined,
      gratitudeGenericFlags: collectBehavioralAnalytics ? gratitudeGenericFlags : undefined,
      gratitudeTriggerKey: collectBehavioralAnalytics ? lastGratitudeTriggerRef.current : undefined,
      gratitudeTriggerKeys: collectBehavioralAnalytics ? gratitudeTriggerKeysRef.current.slice(0, filledEntries.length) : undefined,
      gratitudeWasEdited: collectBehavioralAnalytics ? gratitudeWasEditedRef.current.slice(0, filledEntries.length) : undefined,
      gratitudeEntryDurationsSec: collectBehavioralAnalytics ? gratitudeEntryDurationsRef.current.slice(0, filledEntries.length) : undefined,
      visualizationContentType: collectBehavioralAnalytics ? visualizationContentType : undefined,
      breathingFullPatternDone: collectBehavioralAnalytics ? breathingFullPatternDone : undefined,
      missionChangedFromYesterday: collectBehavioralAnalytics ? missionChangedFromYesterday : undefined,
    };

    persistSessionWithFallback(completed);
    setSession(completed);
    setSessions((prev) => [completed, ...prev.filter((s) => s.id !== completed.id)]);

    if (selectedAffirmation) {
      const updated = affirmations.map((a) =>
        a.id === selectedAffirmation.id ? {...a, lastUsedAt: new Date().toISOString()} : a
      );
      setAffirmations(updated);
      saveAffirmations(persistableAffirmations(updated));
    }

    setStep('complete');
  }

  if (step === 'start') {
    return (
      <StartScreen
        streak={streak}
        completedCount={completedCount}
        lastSession={lastSession}
        yesterdayContext={yesterdayContext}
        goalContext={goalContext}
        effectiveTone={effectiveTone}
        locale={locale}
        onSelectMode={(m) => startRitual(m)}
        onAdvancedStart={() => setStep('mode-select')}
      />
    );
  }

  if (step === 'mode-select') {
    return (
      <ModeSelectScreen
        goalContext={goalContext}
        effectiveTone={effectiveTone}
        suggestedMode={suggestedMode}
        lifeContexts={lifeContexts}
        locale={locale}
        onSelect={(mode, mood) => startRitual(mode, mood)}
        onBack={() => setStep('start')}
      />
    );
  }

  if (step === 'complete') {
    return (
      <CompletionScreen
        session={session!}
        gratitudeEntries={gratitudeEntries.filter((e) => e.trim())}
        identityText={identityText}
        missionText={missionText}
        affirmation={selectedAffirmation}
        onMoodAfter={(score) => {
          if (!session) return;
          const updated = {...session, moodAfter: String(score)};
          setSession(updated);
          setSessions((prev) => [updated, ...prev.filter((s) => s.id !== updated.id)]);
          persistSessionWithFallback(updated);
        }}
      />
    );
  }

  return (
    <div className="mx-auto max-w-4xl">
      <FeatureHint feature="morning_ritual" className="mb-4" />
      <ProgressBar current={currentStepIndex} total={totalSteps} />

      <div className="panel-surface-strong p-6 sm:p-8 lg:p-10">
        <StepTransition key={step}>
          {step === 'breathing' && (
            <BreathingStep
              mode={mode}
              breathingType={breathingType}
              meditation={meditationRecommendation}
              onTypeChange={setBreathingType}
              onComplete={(roundsDone?: number) => {
                setBreathingDone(true);
                if (roundsDone) breathingRoundsDoneRef.current = roundsDone;
                goNext();
              }}
              onSkip={() => {
                skippedStepsRef.current = [...skippedStepsRef.current, 'breathing'];
                goNext();
              }}
            />
          )}

          {step === 'gratitude' && (
            <GratitudeStep
              mode={mode}
              lifeContexts={lifeContexts}
              entries={gratitudeEntries}
              onChange={setGratitudeEntries}
              onNext={goNext}
              onBack={goBack}
              onTriggerUsed={(index, key) => {
                lastGratitudeTriggerRef.current = key;
                gratitudeTriggerKeysRef.current[index] = key;
              }}
              onWasEdited={(index) => { gratitudeWasEditedRef.current[index] = true; }}
              onDurationRecorded={(index, seconds) => { gratitudeEntryDurationsRef.current[index] = seconds; }}
            />
          )}

          {step === 'affirmation' && (
            <AffirmationStep
              affirmation={selectedAffirmation}
              allAffirmations={affirmations}
              locale={locale}
              affirmationContext={affirmationContext}
              onPickAnother={() => {
                const ctx = affirmationContextRef.current;
                if (!ctx) return;
                const next = pickMorningAffirmation(
                  affirmations.filter((a) => a.id !== selectedAffirmation?.id),
                  locale,
                  ctx
                );
                if (next) setSelectedAffirmation(next);
              }}
              onPickByType={(type) => {
                const ctx = affirmationContextRef.current;
                if (!ctx) return;
                const next = pickMorningAffirmation(
                  affirmations.filter((a) => a.type === type),
                  locale,
                  ctx
                );
                setSelectedAffirmation(next);
              }}
              onPickAffirmation={setSelectedAffirmation}
              onNext={goNext}
              onBack={goBack}
              onAffirmationsChange={(items, options) => {
                const previous = affirmations;
                setAffirmations(items);
                if (options?.persist === 'deferred') {
                  scheduleDeferredRitualCommit({
                    key: 'ritual-affirmations',
                    commit: () => saveAffirmations(persistableAffirmations(items)),
                    undo: () => setAffirmations(previous),
                    toast,
                    message: t('affirmation.deletedUndo'),
                    undoLabel: t('common.undo'),
                  });
                  return;
                }
                saveAffirmations(persistableAffirmations(items));
              }}
            />
          )}

          {step === 'visualization' && (
            <VisualizationStep
              text={visualizationText}
              onChange={setVisualizationText}
              showGuided={showGuidedViz}
              onToggleGuided={() => setShowGuidedViz(!showGuidedViz)}
              personalized={personalizedVisualization}
              onMount={() => { vizStepStartRef.current = Date.now(); }}
              onNext={() => {
                if (vizStepStartRef.current) {
                  const dur = Math.round((Date.now() - vizStepStartRef.current) / 1000);
                  vizStepStartRef.current = null;
                  // store temporarily on session so completeRitual can pick it up
                  setSession((prev) => prev ? {...prev, visualizationDurationSec: dur} : prev);
                }
                goNext();
              }}
              onBack={goBack}
            />
          )}

          {step === 'identity' && (
            <IdentityStep
              text={identityText}
              onChange={setIdentityText}
              identities={identities}
              onIdentitiesChange={(items, options) => {
                const previous = identities;
                setIdentities(items);
                if (options?.persist === 'deferred') {
                  scheduleDeferredRitualCommit({
                    key: 'ritual-identities',
                    commit: () => saveIdentities(items),
                    undo: () => setIdentities(previous),
                    toast,
                    message: t('identity.deletedUndo'),
                    undoLabel: t('common.undo'),
                  });
                  return;
                }
                saveIdentities(items);
              }}
              onNext={goNext}
              onBack={goBack}
            />
          )}

          {step === 'mission' && (
            <MissionStep
              lifeContexts={lifeContexts}
              goalContext={goalContext}
              effectiveTone={effectiveTone}
              text={missionText}
              onChange={setMissionText}
              energyScore={energyScore}
              focusScore={focusScore}
              onEnergyChange={setEnergyScore}
              onFocusChange={setFocusScore}
              timeBlock={timeBlock}
              onTimeBlockChange={setTimeBlock}
              onComplete={completeRitual}
              onBack={goBack}
            />
          )}
        </StepTransition>
      </div>
    </div>
  );
}

function StepTransition({children}: {children: React.ReactNode}) {
  return <div className="ritual-step-enter">{children}</div>;
}
