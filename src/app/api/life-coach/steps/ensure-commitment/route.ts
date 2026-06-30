import {ensureAllActiveCommitmentSteps} from '@/lib/life-coach/ensure-active-commitment-steps';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {jsonError, jsonMutation} from '@/lib/life-coach/server';

/** Backfill missing commitment-window daily steps for all active goals. */
export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});

  if (!current.ok) {
    return current.response;
  }

  try {
    await ensureAllActiveCommitmentSteps(current.user.id);
    return jsonMutation();
  } catch (error) {
    return jsonError('Could not ensure commitment steps.', 500, String(error));
  }
}
