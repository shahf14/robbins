import {isClerkConfigured} from '@/lib/auth/clerk-config';

export function assertLocalAuthConfigured() {
  if (process.env.NODE_ENV !== 'production') return;

  if (isClerkConfigured()) return;

  if (process.env.LOCAL_AUTH_TOKEN?.trim()) return;

  const message =
    'LOCAL_AUTH_TOKEN must be set in production when Clerk is not configured. Generate one with: openssl rand -hex 32';

  if (process.env.STRICT_AUTH_BOOT === 'true') {
    throw new Error(message);
  }

  console.warn(`[auth] ${message}`);
}
