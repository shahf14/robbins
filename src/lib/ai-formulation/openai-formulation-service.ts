import type {ZodType} from 'zod';
import type {AppLocale} from '@/i18n/config';
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
import {parseJsonOr} from '@/lib/safe-json';
import {formulationApprovedSchema} from '@/lib/life-coach/schemas';
import type {
  CoachHandoff,
  FormulationApproved,
  FormulationSession,
  LlmExplorationQuestion,
} from '@/lib/life-coach/types';
import {getFormulationFlags, getLifeCoachModelConfig} from '@/lib/life-coach/env';
import {z} from 'zod';
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
import {callOpenAiResponses} from '@/lib/llm/client';

const explorationQuestionSchema = z.object({
  id: z.string().regex(/^q\d{2}$/),
  text: z.string().trim().min(8).max(600),
  focus_area: z.string().trim().max(80).optional(),
});
const explorationQuestionsSchema = z.object({
  questions: z.array(explorationQuestionSchema).length(15),
});
const microGoalOptionSchema = z.object({
  id: z.string().trim().min(1).max(40),
  goal_type: z.enum(['practical', 'mindset', 'freestyle']).optional(),
  title: z.string().trim().min(1).max(120),
  value: z.string().trim().min(1).max(500),
  micro_goal_week: z.string().trim().min(1).max(500),
  anticipated_barrier: z.string().trim().max(500).optional(),
  plan_b: z.string().trim().max(500).optional(),
  why_this_exercise: z.string().trim().max(300).optional(),
  mindset_exercise_id: z.string().trim().max(40).optional(),
});

const microGoalSchema = z.object({
  burning_focus: z.string().trim().min(8).max(400),
  goal_options: z.array(microGoalOptionSchema).length(5),
  value: z.string().trim().max(500).optional(),
  micro_goal_week: z.string().trim().max(500).optional(),
  anticipated_barrier: z.string().trim().max(500).optional(),
  plan_b: z.string().trim().max(500).optional(),
});

function llmGoalOptionsValid(
  data: z.infer<typeof microGoalSchema>,
  session: FormulationSession,
  locale: AppLocale
): boolean {
  const options = normalizeGoalOptions(data.goal_options as MicroGoalOption[]);
  return validateLlmGoalOptions(options, session, locale, data.burning_focus?.trim());
}

function microGoalSuggestionFromLlm(
  data: z.infer<typeof microGoalSchema>,
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

type AiCallMetrics = {
  tokens_used: number | null;
  generation_duration_ms: number | null;
  model_used: string | null;
};

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

function parseJsonFromText<T>(text: string, schema: ZodType<T>): T | null {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1]?.trim() ?? trimmed;
  try {
    const parsed = parseJsonOr<unknown>(candidate, null);
    const result = schema.safeParse(parsed);
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}

async function requestJsonFromLlm<T>({
  systemPrompt,
  userPrompt,
  schema,
  maxOutputTokens = 800,
  jsonObject = false,
  model: modelOverride,
}: {
  systemPrompt: string;
  userPrompt: string;
  schema: ZodType<T>;
  maxOutputTokens?: number;
  jsonObject?: boolean;
  model?: string;
}): Promise<{data: T | null; metrics: AiCallMetrics}> {
  const nullMetrics: AiCallMetrics = {tokens_used: null, generation_duration_ms: null, model_used: null};
  const model = modelOverride ?? modelConfig.structuring;

  const result = await callOpenAiResponses({
    model,
    instructions: systemPrompt,
    input: userPrompt,
    maxOutputTokens,
    jsonObject,
  });
  if (!result) {
    return {data: null, metrics: nullMetrics};
  }

  const parsed = result.text ? parseJsonFromText(result.text, schema) : null;

  return {
    data: parsed,
    metrics: {
      tokens_used: result.tokensUsed,
      generation_duration_ms: result.durationMs,
      model_used: model,
    },
  };
}

async function requestJson<T>({
  systemPrompt,
  userPrompt,
  schema,
  fallback,
  maxOutputTokens = 800,
  jsonObject = false,
  model,
}: {
  systemPrompt: string;
  userPrompt: string;
  schema: ZodType<T>;
  fallback: T;
  maxOutputTokens?: number;
  jsonObject?: boolean;
  model?: string;
}): Promise<{data: T; metrics: AiCallMetrics}> {
  const {data, metrics} = await requestJsonFromLlm({
    systemPrompt,
    userPrompt,
    schema,
    maxOutputTokens,
    jsonObject,
    model,
  });
  return {data: data ?? fallback, metrics};
}

export const openaiFormulationService = {
  async generateExplorationQuestions(session: FormulationSession, locale: AppLocale) {
    const fallback = buildFallbackExplorationQuestions(session, locale);
    const flags = getFormulationFlags();

    // Step 16: Deterministic mode — skip LLM entirely, use rule-based questions
    if (flags.deterministicExploration) {
      return {
        questions: fallback,
        metrics: {tokens_used: null, generation_duration_ms: null, model_used: 'deterministic'} as AiCallMetrics,
        validation_passed: true,
      };
    }

    const {data, metrics} = await requestJson({
      systemPrompt: buildGenerateExplorationQuestionsSystemPrompt(locale),
      userPrompt: buildGenerateExplorationQuestionsUserPrompt(session, locale),
      schema: explorationQuestionsSchema,
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

    const wrapperSchema = z.object({formulation: formulationApprovedSchema});

    const {data, metrics} = await requestJson({
      systemPrompt: buildDraftFormulationSystemPrompt(locale),
      userPrompt: buildDraftFormulationUserPrompt({locale, session}),
      schema: wrapperSchema,
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
      const {data, metrics} = await requestJsonFromLlm({
        systemPrompt,
        userPrompt,
        schema: microGoalSchema,
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
        ? 'לא הצלחנו ליצור 5 יעדים מותאמים מהנתונים. נסה/י שוב בעוד רגע.'
        : 'Could not generate 5 personalized goals from your data. Please try again.'
    );
  },
};
