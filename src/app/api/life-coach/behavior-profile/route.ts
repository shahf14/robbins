import {getUserBehaviorProfile} from '@/lib/behavior-profile/repository';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {jsonError, jsonOk} from '@/lib/life-coach/server';

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request);
  if (!current.ok) return current.response;

  try {
    const profile = getUserBehaviorProfile(current.user.id);
    return jsonOk({profile});
  } catch (error) {
    return jsonError('Could not load behavior profile.', 500, String(error));
  }
}
