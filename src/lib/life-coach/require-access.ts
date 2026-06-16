import {requireCurrentUser, type CurrentUserResult} from '@/lib/auth/get-current-user';
import {isUserOnboardingComplete} from '@/lib/life-coach/repository';
import {jsonError} from '@/lib/life-coach/server';

type AccessOptions = {
  /** Allow access before onboarding is marked complete on the server (onboarding flow). */
  allowDuringOnboarding?: boolean;
};

/**
 * Authenticates the user and, unless opted out, requires server-side onboarding completion.
 */
export async function requireLifeCoachAccess(
  request: Request,
  options: AccessOptions = {}
): Promise<CurrentUserResult> {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current;

  if (options.allowDuringOnboarding) return current;

  const onboarded = await isUserOnboardingComplete(current.user.id);
  if (!onboarded) {
    return {ok: false, response: jsonError('Onboarding required.', 403)};
  }

  return current;
}
