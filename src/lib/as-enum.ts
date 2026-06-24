/** Narrow unknown DB values to a string enum member, or return fallback. */
export function asEnum<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T | null = null
): T | null {
  return typeof value === 'string' && (allowed as readonly string[]).includes(value)
    ? (value as T)
    : fallback;
}

export function isEnumMember<T extends string>(
  value: unknown,
  allowed: readonly T[]
): value is T {
  return asEnum(value, allowed) !== null;
}
