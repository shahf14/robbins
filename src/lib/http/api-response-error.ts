import {LifeCoachApiError} from '@/lib/life-coach/api-client';
import {observeAuthResponse} from '@/lib/auth/observe-auth-response';

export async function throwIfNotOk(response: Response): Promise<void> {
  observeAuthResponse(response);
  if (response.ok) return;

  let message = response.statusText || `Request failed (${response.status}).`;
  try {
    const text = await response.text();
    const body = text ? (JSON.parse(text) as {error?: string}) : null;
    if (body?.error) message = body.error;
  } catch {
    // Keep statusText fallback.
  }

  throw new LifeCoachApiError(message, response.status);
}
