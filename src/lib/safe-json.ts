import type {ZodType} from 'zod';

export function parseJsonOr<T>(value: unknown, fallback: T): T {
  if (value == null || value === '') return fallback;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

export function parseJsonArrayOr<T>(value: unknown, fallback: T[] = []): T[] {
  const parsed = parseJsonOr<unknown>(value, fallback);
  return Array.isArray(parsed) ? (parsed as T[]) : fallback;
}

export function parseJsonObjectOr<T extends Record<string, unknown>>(
  value: unknown,
  fallback: T
): T {
  const parsed = parseJsonOr<unknown>(value, fallback);
  return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
    ? (parsed as T)
    : fallback;
}

/** Strip optional ```json fences from LLM output before JSON.parse. */
export function stripJsonCodeFence(text: string): string {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  return fenced?.[1]?.trim() ?? trimmed;
}

/** Parse LLM text (plain or fenced) and validate with a zod schema. */
export function parseZodJsonFromLlmText<T>(text: string, schema: ZodType<T>): T | null {
  const candidate = stripJsonCodeFence(text);
  const parsed = parseJsonOr<unknown>(candidate, null);
  if (parsed === null) return null;
  const result = schema.safeParse(parsed);
  return result.success ? result.data : null;
}
