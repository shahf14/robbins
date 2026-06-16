import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {getOnboardingServerStatus, isUserOnboardingComplete} from '@/lib/life-coach/repository';
import {jsonError, jsonOk} from '@/lib/life-coach/server';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  try {
    await isUserOnboardingComplete(current.user.id);
    const status = await getOnboardingServerStatus(current.user.id);
    return jsonOk({
      completedAt: status.completedAt,
      primaryDomain: status.primaryDomain,
      complete: status.completedAt !== null,
    });
  } catch (error) {
    return jsonError('Could not load onboarding status.', 500, String(error));
  }
}
