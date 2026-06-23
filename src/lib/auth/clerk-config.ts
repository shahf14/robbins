function isPlaceholderEnv(value: string | undefined): boolean {
  const trimmed = value?.trim() ?? '';
  if (!trimmed) return true;
  return trimmed.endsWith('...') || trimmed.includes('_...');
}

/** True only when both Clerk keys are set to real values (not .env.example placeholders). */
export function isClerkConfigured(): boolean {
  const secret = process.env.CLERK_SECRET_KEY?.trim();
  const publishable = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY?.trim();
  if (!secret || !publishable) return false;
  if (isPlaceholderEnv(secret) || isPlaceholderEnv(publishable)) return false;
  return true;
}
