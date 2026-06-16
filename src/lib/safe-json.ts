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
