import type {AppLocale} from '@/i18n/config';
import {resolveGenderedHebrewText, resolveParticipantGender} from '@/lib/gendered-copy';
import {buildFallbackExplorationQuestions} from '@/lib/formulation/exploration-fallback';
import {buildFallbackFormulationFromInsights} from '@/lib/formulation/formulation-insights';
import {MicroGoalLlmError, enrichMindsetGoalOptions, normalizeGoalOptions, validateLlmGoalOptions} from '@/lib/formulation/micro-goal-llm';
import type {MicroGoalOption} from '@/lib/formulation/micro-goal-options';
import {mergeExplorationQuestionsWithLikertFallback} from '@/lib/formulation/exploration-likert';
import {refineFormulationDraft} from '@/lib/formulation/formulation-draft-quality';
import {sanitizeLikertStatementText} from '@/lib/formulation/theme-phrases';
import {
  guardExplorationQuestions,
  guardFormulationDraft,
} from '@/lib/formulation/output-guard';
import {explorationQuestionsResponseSchema, formulationDraftLlmResponseSchema, microGoalLlmResponseSchema} from '@/lib/life-coach/schemas';
import type {MicroGoalLlmResponse} from '@/lib/life-coach/schemas';
import type {
  CoachHandoff,
  FormulationApproved,
  FormulationSession,
  LlmExplorationQuestion,
} from '@/lib/life-coach/types';
import {getFormulationFlags, getLifeCoachModelConfig} from '@/lib/life-coach/env';
import {
  buildDraftFormulationSystemPrompt,
  buildDraftFormulationUserPrompt,
  buildGenerateExplorationQuestionsSystemPrompt,
  buildGenerateExplorationQuestionsUserPrompt,
  buildMicroGoalRetryHint,
  buildMicroGoalSystemPrompt,
  buildMicroGoalUserPrompt,
  type MicroGoalSuggestion,
} from './prompts';
import type {AiCallMetrics} from '@/lib/llm/client';
import {requestStructuredJson, tryRequestStructuredJson} from '@/lib/llm/request-structured-json';

function llmGoalOptionsValid(
  data: MicroGoalLlmResponse,
  session: FormulationSession,
  locale: AppLocale
): boolean {
  const options = normalizeGoalOptions(data.goal_options as MicroGoalOption[]);
  return validateLlmGoalOptions(options, session, locale, data.burning_focus?.trim());
}

function microGoalSuggestionFromLlm(
  data: MicroGoalLlmResponse,
  session: FormulationSession,
  locale: AppLocale
): MicroGoalSuggestion {
  const options = enrichMindsetGoalOptions(
    normalizeGoalOptions(data.goal_options as MicroGoalOption[]),
    session,
    locale
  );
  const pick = options.find((o) => o.goal_type === 'practical') ?? options[0];
  return {
    generated_by: 'llm',
    burning_focus: data.burning_focus.trim(),
    goal_options: options,
    value: data.value?.trim() || pick.value,
    micro_goal_week: data.micro_goal_week?.trim() || pick.micro_goal_week,
    anticipated_barrier: data.anticipated_barrier?.trim() || pick.anticipated_barrier,
    plan_b: data.plan_b?.trim() || pick.plan_b,
  };
}

const modelConfig = getLifeCoachModelConfig();

/** Normalize LLM ids (q1, Q01) → q01…q15 */
function normalizeExplorationQuestionIds(
  questions: LlmExplorationQuestion[]
): LlmExplorationQuestion[] {
  return questions.map((q, i) => {
    const expected = `q${String(i + 1).padStart(2, '0')}`;
    const raw = q.id?.trim() ?? '';
    const digits = raw.match(/(\d{1,2})/)?.[1];
    const id =
      /^q\d{2}$/i.test(raw) && digits
        ? `q${String(Number(digits)).padStart(2, '0')}`
        : expected;
    return {...q, id};
  });
}

export const openaiFormulationService = {
  async generateExplorationQuestions(session: FormulationSession, locale: AppLocale) {
    const fallback = buildFallbackExplorationQuestions(session, locale);
    const flags = getFormulationFlags();

    // Deterministic mode — skip LLM entirely, use rule-based questions
    if (flags.deterministicExploration) {
      return {
        questions: fallback,
        metrics: {tokens_used: null, generation_duration_ms: null, model_used: 'deterministic'} as AiCallMetrics,
        validation_passed: true,
      };
    }

    const {data, metrics} = await requestStructuredJson({
      systemPrompt: buildGenerateExplorationQuestionsSystemPrompt(locale),
      userPrompt: buildGenerateExplorationQuestionsUserPrompt(session, locale),
      schema: explorationQuestionsResponseSchema,
      fallback: {questions: fallback},
      maxOutputTokens: 2800,
      jsonObject: true,
      model: modelConfig.exploration,
    });

    let questions: LlmExplorationQuestion[] = mergeExplorationQuestionsWithLikertFallback(
      normalizeExplorationQuestionIds(data.questions).map((q) => ({
        ...q,
        text: sanitizeLikertStatementText(q.text, locale),
      })),
      fallback,
      locale
    );
    let guard = guardExplorationQuestions(questions, locale);
    if (!guard.ok) {
      console.warn('[formulation] exploration guard failed:', guard.reasons, {model: metrics.model_used, tokens: metrics.tokens_used});
      const relaxed = guardExplorationQuestions(fallback, locale);
      questions = relaxed.ok ? fallback : questions;
      guard = relaxed.ok ? relaxed : guard;
    }

    const usedFallback =
      questions.length === 15 &&
      questions.every((q, i) => q.text === fallback[i]?.text);

    return {
      questions,
      metrics,
      validation_passed: guard.ok && !usedFallback,
    };
  },

  async draftFormulation(session: FormulationSession, locale: AppLocale) {
    const fallback = buildFallbackFormulationFromInsights(session, locale);

    const {data, metrics} = await requestStructuredJson({
      systemPrompt: buildDraftFormulationSystemPrompt(locale),
      userPrompt: buildDraftFormulationUserPrompt({locale, session}),
      schema: formulationDraftLlmResponseSchema,
      fallback: {formulation: fallback},
      maxOutputTokens: 2000,
      jsonObject: true,
      model: modelConfig.formulation,
    });

    let formulation = data.formulation;
    formulation.risk_screen = {
      level: session.risk_level ?? 'none',
      action: session.risk_action ?? 'continue',
    };

    const guard = guardFormulationDraft(formulation);
    if (!guard.ok) {
      console.warn('[formulation] draft guard failed:', guard.reasons, {model: metrics.model_used, tokens: metrics.tokens_used});
      formulation = fallback;
    } else {
      formulation = refineFormulationDraft(formulation, session, locale);
    }

    return {formulation, metrics, validation_passed: guard.ok};
  },

  async suggestMicroGoal(session: FormulationSession, locale: AppLocale): Promise<{
    suggestions: MicroGoalSuggestion;
    metrics: AiCallMetrics;
    generated_by: 'llm';
  }> {
    if (!process.env.OPENAI_API_KEY) {
      throw new MicroGoalLlmError(
        locale === 'he'
          ? 'חסר מפתח OpenAI — לא ניתן ליצור יעדים מותאמים.'
          : 'OpenAI API key missing — cannot generate personalized goals.'
      );
    }

    const systemPrompt = buildMicroGoalSystemPrompt(locale);
    const baseUserPrompt = buildMicroGoalUserPrompt(session, locale);

    let lastMetrics: AiCallMetrics = {
      tokens_used: null,
      generation_duration_ms: null,
      model_used: null,
    };

    for (let attempt = 0; attempt < 3; attempt++) {
      const userPrompt = baseUserPrompt + buildMicroGoalRetryHint(locale, attempt);
      const {data, metrics} = await tryRequestStructuredJson({
        systemPrompt,
        userPrompt,
        schema: microGoalLlmResponseSchema,
        maxOutputTokens: 3200,
        jsonObject: true,
        model: modelConfig.microGoal,
      });
      lastMetrics = metrics;

      if (data && llmGoalOptionsValid(data, session, locale)) {
        return {
          suggestions: microGoalSuggestionFromLlm(data, session, locale),
          metrics,
          generated_by: 'llm',
        };
      }
    }

    throw new MicroGoalLlmError(
      locale === 'he'
        ? resolveGenderedHebrewText(
            'לא הצלחנו ליצור 5 יעדים מותאמים מהנתונים. נסה/י שוב בעוד רגע.',
            resolveParticipantGender(session.participant_gender)
          )
        : 'Could not generate 5 personalized goals from your data. Please try again.'
    );
  },
};
