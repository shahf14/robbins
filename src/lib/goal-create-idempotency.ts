/** Client idempotency key for AI goal preview saves (one bundle per preview session). */
export function createGoalCreateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export function isSqliteUniqueConstraintError(error: unknown): boolean {
  return error instanceof Error && error.message.includes('UNIQUE constraint failed');
}
