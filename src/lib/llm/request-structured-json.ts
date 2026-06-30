import type {ZodType} from 'zod';
import {parseZodJsonFromLlmText} from '@/lib/safe-json';
import {callOpenAiResponses, type AiCallMetrics} from '@/lib/llm/client';

const NULL_METRICS: AiCallMetrics = {
  tokens_used: null,
  generation_duration_ms: null,
  model_used: null,
};

type LlmRequestOpts = {
  model: string;
  systemPrompt: string;
  userPrompt: string;
  maxOutputTokens: number;
  jsonObject?: boolean;
  apiKey?: string;
};

function metricsFromResult(
  result: NonNullable<Awaited<ReturnType<typeof callOpenAiResponses>>>
): AiCallMetrics {
  return {
    tokens_used: result.tokensUsed,
    generation_duration_ms: result.durationMs,
    model_used: result.model,
  };
}

/** Plain-text LLM call with fallback when the provider is unavailable or empty. */
export async function requestLlmText(
  opts: LlmRequestOpts & {fallback: string}
): Promise<{text: string; metrics: AiCallMetrics}> {
  const result = await callOpenAiResponses({
    model: opts.model,
    instructions: opts.systemPrompt,
    input: opts.userPrompt,
    maxOutputTokens: opts.maxOutputTokens,
    jsonObject: opts.jsonObject,
    apiKey: opts.apiKey,
  });

  if (!result?.text) {
    return {text: opts.fallback, metrics: NULL_METRICS};
  }

  return {text: result.text, metrics: metricsFromResult(result)};
}

/**
 * Single-shot structured JSON call. Returns parsed data or null when the call
 * fails or output does not match the schema (for caller-side retry loops).
 */
export async function tryRequestStructuredJson<T>(
  opts: LlmRequestOpts & {schema: ZodType<T>}
): Promise<{data: T | null; metrics: AiCallMetrics}> {
  const result = await callOpenAiResponses({
    model: opts.model,
    instructions: opts.systemPrompt,
    input: opts.userPrompt,
    maxOutputTokens: opts.maxOutputTokens,
    jsonObject: opts.jsonObject,
    apiKey: opts.apiKey,
  });

  if (!result?.text) {
    return {data: null, metrics: NULL_METRICS};
  }

  return {
    data: parseZodJsonFromLlmText(result.text, opts.schema),
    metrics: metricsFromResult(result),
  };
}

/** Structured JSON call with schema validation and fallback on any failure. */
export async function requestStructuredJson<T>(
  opts: LlmRequestOpts & {schema: ZodType<T>; fallback: T}
): Promise<{data: T; metrics: AiCallMetrics}> {
  const {data, metrics} = await tryRequestStructuredJson(opts);
  const candidate = data ?? opts.fallback;
  const parsed = opts.schema.safeParse(candidate);
  if (parsed.success) {
    return {data: parsed.data, metrics};
  }

  const fallbackParsed = opts.schema.safeParse(opts.fallback);
  if (!fallbackParsed.success) {
    throw new Error('LLM fallback failed schema validation.');
  }

  if (data == null) {
    console.warn('[llm] structured JSON call failed; using validated fallback');
  } else {
    console.warn('[llm] model output failed schema validation; using validated fallback', {
      issues: parsed.error.flatten(),
    });
  }

  return {data: fallbackParsed.data, metrics};
}
