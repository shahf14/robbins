import {notifyLocalAuthRequired} from '@/lib/auth/local-auth-events';

export type LocalAuthVerifyResult =
  | {ok: true}
  | {ok: false; reason: 'missing' | 'unauthorized' | 'offline' | 'server'};

export type VerifyLocalAuthTokenOptions = {
  /** When false, 401/403 are returned without raising the global LocalAuthGate. */
  notifyOnUnauthorized?: boolean;
};

export async function verifyLocalAuthToken(
  token: string,
  options: VerifyLocalAuthTokenOptions = {}
): Promise<LocalAuthVerifyResult> {
  const notifyOnUnauthorized = options.notifyOnUnauthorized ?? true;
  const trimmed = token.trim();
  if (!trimmed) {
    return {ok: false, reason: 'missing'};
  }

  try {
    const res = await fetch('/api/auth/session', {
      headers: {Authorization: `Bearer ${trimmed}`},
    });
    if (res.status === 401 || res.status === 403) {
      if (notifyOnUnauthorized) {
        notifyLocalAuthRequired();
      }
      return {ok: false, reason: 'unauthorized'};
    }
    if (!res.ok) {
      return {ok: false, reason: 'server'};
    }
    return {ok: true};
  } catch {
    return {ok: false, reason: 'offline'};
  }
}
