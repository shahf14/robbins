/**
 * Single seam for OpenAI Responses-API calls. Previously every feature
 * re-implemented the endpoint URL, auth header, request body shape, response
 * parsing, and timeout inline — so a contract change (or adding retries /
 * timeouts / a different provider) meant editing ~7 copies. Callers now pass
 * prompts and parse the returned text themselves.
 */

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';

/** Upstream calls are aborted after this long so a hung provider can't hang the request. */
const REQUEST_TIMEOUT_MS = 15_000;
const MAX_RETRIES = 3;

export type OpenAiResponseBody = {
  output_text?: string;
  output?: Array<{content?: Array<{text?: string}>}>;
  usage?: {total_tokens?: number};
  model?: string;
};

/** Flatten the Responses-API envelope to plain text. */
export function extractOpenAiText(response: OpenAiResponseBody): string {
  if (response.output_text) return response.output_text.trim();
  return (
    response.output
      ?.flatMap((item) => item.content ?? [])
      .map((c) => c.text)
      .filter(Boolean)
      .join('\n')
      .trim() ?? ''
  );
}

export type LlmTextResult = {
  text: string;
  tokensUsed: number | null;
  durationMs: number;
  model: string;
};

/** Persisted AI call metrics shape (ai_coaching_insights / ai_insights). */
export type AiCallMetrics = {
  tokens_used: number | null;
  generation_duration_ms: number | null;
  model_used: string | null;
};

/**
 * Call the OpenAI Responses API and return the extracted text plus basic
 * metrics. Returns `null` when no API key is configured, the request fails, or
 * the response is not OK — callers fall back to their own defaults.
 */
export async function callOpenAiResponses(opts: {
  model: string;
  instructions: string;
  input: string;
  maxOutputTokens: number;
  jsonObject?: boolean;
  /** Override the env key (mainly for tests). */
  apiKey?: string;
}): Promise<LlmTextResult | null> {
  const apiKey = opts.apiKey ?? process.env.OPENAI_API_KEY;
  if (!apiKey) return null;

  const startMs = Date.now();
  const body = JSON.stringify({
    model: opts.model,
    instructions: opts.instructions,
    input: opts.input,
    max_output_tokens: opts.maxOutputTokens,
    ...(opts.jsonObject ? {text: {format: {type: 'json_object'}}} : {}),
  });

  for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
    try {
      const response = await fetch(OPENAI_RESPONSES_URL, {
        method: 'POST',
        signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body,
      });

      if (!response.ok) {
        if (attempt < MAX_RETRIES - 1 && (response.status === 429 || response.status >= 500)) {
          continue;
        }
        return null;
      }

      const responseBody = (await response.json()) as OpenAiResponseBody;
      return {
        text: extractOpenAiText(responseBody),
        tokensUsed: responseBody.usage?.total_tokens ?? null,
        durationMs: Date.now() - startMs,
        model: responseBody.model ?? opts.model,
      };
    } catch {
      if (attempt < MAX_RETRIES - 1) continue;
      return null;
    }
  }
  return null;
}
