import type {AppLocale} from '@/i18n/config';
import {
  getGuidedQuestionBody,
  getGuidedQuestionById,
  getPolarityForQuestionId,
  profileFromFormulationSession,
} from '@/lib/formulation/guided-questions';
import {difficultyLabelFromRating} from '@/lib/formulation/rating-difficulty-label';
import {buildFormulationInsights} from '@/lib/formulation/formulation-insights';
import {buildMindsetExerciseRecommendation} from '@/lib/formulation/mindset-exercises';
import {
  buildEmotionalStageRouting,
  emotionalStageForPrompt,
} from '@/lib/formulation/emotional-stage-routing';
import {
  buildGoalAlignmentContext,
  goalAlignmentForPrompt,
} from '@/lib/formulation/goal-alignment';
import {
  buildPersonalizedChallenge,
  personalizedChallengeForPrompt,
} from '@/lib/formulation/personalized-challenge';
import {
  buildHabitTriggerContext,
  habitTriggerForPrompt,
} from '@/lib/formulation/habit-trigger-routing';
import {
  buildBarrierPlanBStrategy,
  barrierPlanBForPrompt,
} from '@/lib/formulation/plan-b-routing';
import {
  buildLoadAdaptationContext,
  loadAdaptationForPrompt,
} from '@/lib/formulation/load-adaptation-routing';
import {
  buildComebackMessaging,
  comebackMessagingForPrompt,
} from '@/lib/formulation/comeback-messaging';
import {
  buildAccountabilityContext,
  accountabilityForPrompt,
} from '@/lib/formulation/accountability-routing';
import {
  buildBehaviorChangeContext,
  behaviorChangeForPrompt,
} from '@/lib/formulation/behavior-change-tracking';
import {
  buildMeditationRecommendation,
  meditationForPrompt,
} from '@/lib/formulation/meditation-routing';
import {buildVisualizationContextForWizard} from '@/lib/formulation/visualization-context';
import type {FormulationSession} from '@/lib/life-coach/types';

/** Structured snapshot of everything collected before LLM exploration (step 5). */
export function buildFormulationSessionContext(session: FormulationSession, locale: AppLocale) {
  const ratings = session.passive_ratings.map((r) => {
    const q = getGuidedQuestionById(r.key);
    const label = q
      ? getGuidedQuestionBody(q, locale, profileFromFormulationSession(session).gender)
      : r.key;
    return {
      id: r.key,
      score: r.score,
      label,
      polarity: getPolarityForQuestionId(r.key),
      difficulty_label: difficultyLabelFromRating(r.key, r.score, locale),
    };
  });

  const alreadyRatedStatements = ratings.map((r) => r.label);
  const insights = buildFormulationInsights(session, locale);
  const emotionalStage = buildEmotionalStageRouting(session, locale);
  const personalizedChallenge = buildPersonalizedChallenge(session, locale);
  const meditationRecommendation = buildMeditationRecommendation(session, locale);
  const habitTrigger = buildHabitTriggerContext(session, locale);
  const planBStrategy = buildBarrierPlanBStrategy(session, locale);
  const loadAdaptation = buildLoadAdaptationContext(session, locale);
  const comebackMessaging = buildComebackMessaging(session, locale);
  const accountability = buildAccountabilityContext(session, locale);
  const behaviorChange = buildBehaviorChangeContext(session, locale);

  const chipFollowUps = insights.chip_follow_ups.map((c) => ({
    key:
      session.prior_question_answers.find((a) => {
        const meta = session.rating_follow_ups.find((f) => f.key === a.key);
        return meta?.questionKey === c.question_key;
      })?.key ?? c.question_key,
    question_key: c.question_key,
    answer: c.answer,
    chip: c.chip,
    rating_ids: c.rating_ids,
  }));

  const exploration_ratings = session.llm_exploration_answers.map((a) => {
    const q = session.llm_exploration_questions.find((x) => x.id === a.key);
    return {id: a.key, text: q?.text ?? a.key, score: a.score};
  });

  return {
    locale,
    synthesis: insights,
    emotional_stage: emotionalStageForPrompt(emotionalStage),
    personalized_challenge: personalizedChallengeForPrompt(personalizedChallenge),
    habit_trigger: habitTriggerForPrompt(habitTrigger),
    plan_b_strategy: barrierPlanBForPrompt(planBStrategy),
    load_adaptation: loadAdaptationForPrompt(loadAdaptation),
    comeback_messaging: comebackMessagingForPrompt(comebackMessaging),
    accountability: accountabilityForPrompt(accountability),
    behavior_change: behaviorChangeForPrompt(behaviorChange, null),
    meditation_recommendation: meditationForPrompt(meditationRecommendation),
    exploration_ratings,
    rating_task: {
      scale_min_label: locale === 'he' ? 'לא מסכים' : 'disagree',
      scale_max_label: locale === 'he' ? 'מסכים בהחלט' : 'strongly agree',
      format: 'first_person_likert_statement_not_question',
    },
    do_not_repeat_these_step3_statements: alreadyRatedStatements,
    profile: {
      life_context_statuses: session.life_context_statuses,
      life_context_status_note: session.life_context_status_note,
      participant_gender: session.participant_gender,
      participant_age: session.participant_age,
    },
    safety: {
      risk_q1: session.risk_q1,
      risk_q2: session.risk_q2,
      risk_level: session.risk_level,
      risk_action: session.risk_action,
    },
    passive_ratings: ratings,
    chip_follow_ups: chipFollowUps,
    dimensions: session.dimensions,
    concern_summary: session.presenting_concern_user_words ?? session.presenting_concern_raw,
    passive_reflection: session.reflection_llm_text,
    phases_skipped: session.phases_skipped,
    exploration_already_answered: session.llm_exploration_answers,
  };
}

/** Slim context for draft-formulation LLM — only the fields the model needs. */
export function buildSlimFormulationContext(session: FormulationSession, locale: AppLocale) {
  const full = buildFormulationSessionContext(session, locale);
  return {
    locale,
    synthesis: {
      burning_now_themes: full.synthesis.burning_now_themes,
      suppressed_by_chips: full.synthesis.suppressed_by_chips,
      chip_filter_rule: full.synthesis.chip_filter_rule,
      primary_goal_focus: full.synthesis.primary_goal_focus,
    },
    visualization_prompt_input: buildVisualizationContextForWizard(session, locale),
    emotional_stage: full.emotional_stage,
    exploration_ratings: full.exploration_ratings,
    passive_ratings: full.passive_ratings,
    chip_follow_ups: full.chip_follow_ups,
    dimensions: full.dimensions,
    concern_summary: full.concern_summary,
    profile: full.profile,
  };
}

/** Full wizard snapshot for step 7 — LLM generates five goal options from all collected data. */
export function buildMicroGoalWizardContext(session: FormulationSession, locale: AppLocale) {
  const snapshot = buildFormulationSessionContext(session, locale);
  const approved = session.formulation_approved;

  const mindsetExercise = buildMindsetExerciseRecommendation(session, locale);
  const visualizationInput = buildVisualizationContextForWizard(session, locale);
  const goalAlignment = buildGoalAlignmentContext(session, locale);
  const emotionalStage = buildEmotionalStageRouting(session, locale);
  const personalizedChallenge = buildPersonalizedChallenge(session, locale);
  const meditationRecommendation = buildMeditationRecommendation(session, locale);

  return {
    locale,
    mindset_exercise_recommendation: mindsetExercise,
    visualization_prompt_input: visualizationInput,
    goal_alignment: goalAlignmentForPrompt(goalAlignment),
    emotional_stage: emotionalStageForPrompt(emotionalStage),
    personalized_challenge: personalizedChallengeForPrompt(personalizedChallenge),
    meditation_recommendation: meditationForPrompt(meditationRecommendation),
    goal_structure: {
      practical: 1,
      mindset: 1,
      freestyle: 3,
      order: ['practical', 'mindset', 'freestyle', 'freestyle', 'freestyle'],
    },
    instruction: {
      task:
        locale === 'he'
          ? 'נתח את כל הנתונים וצור 5 יעדים: 1 פרקטי + 1 מיינדסט + 3 פרייסטייל (לשיחה עם המאמן/צ\'אט)'
          : 'Analyze all data and create 5 goals: 1 practical + 1 mindset + 3 freestyle (for coach/chat)',
      anchor_burning_now:
        snapshot.synthesis.burning_now_themes[0]?.label ??
        approved?.presenting_concern_user_words ??
        snapshot.concern_summary,
      primary_goal_focus: snapshot.synthesis.primary_goal_focus,
      secondary_goal_themes: snapshot.synthesis.secondary_goal_themes,
      suppressed_do_not_center: snapshot.synthesis.suppressed_by_chips.map((s) => s.label),
    },
    wizard_snapshot: snapshot,
    formulation_approved: approved
      ? {
          core: approved.presenting_concern_user_words,
          intensity_0_10: approved.intensity_0_10,
          contexts: approved.contexts,
          stressors: approved.stressors,
          maintaining_factors: approved.maintaining_factors,
          existing_strengths: approved.existing_strengths,
          uncertainties: approved.uncertainties,
        }
      : null,
  };
}
