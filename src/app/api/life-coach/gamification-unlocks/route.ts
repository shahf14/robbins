import {
  listGamificationUnlocks,
  saveGamificationUnlock,
  type GamificationUnlockKind,
} from '@/lib/db/repositories/gamification-unlocks';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {jsonError, jsonOk} from '@/lib/life-coach/server';

const VALID_KINDS: GamificationUnlockKind[] = ['mystery_unlock', 'reflection_loot', 'identity_title'];

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request);
  if (!current.ok) return current.response;

  try {
    const unlocks = listGamificationUnlocks(current.user.id, 50);
    return jsonOk({unlocks});
  } catch (error) {
    return jsonError('Could not load gamification unlocks.', 500, String(error));
  }
}

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);
  if (!current.ok) return current.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const input = body as {
    kind?: string;
    reward_key?: string;
    week_start?: string | null;
    context?: Record<string, unknown> | null;
  };

  if (!input.kind || !VALID_KINDS.includes(input.kind as GamificationUnlockKind)) {
    return jsonError('Invalid unlock kind.', 400);
  }
  if (!input.reward_key || typeof input.reward_key !== 'string') {
    return jsonError('reward_key is required.', 400);
  }

  try {
    const unlock = saveGamificationUnlock(current.user.id, {
      kind: input.kind as GamificationUnlockKind,
      reward_key: input.reward_key,
      week_start: input.week_start ?? null,
      context: input.context ?? null,
    });
    return jsonOk({unlock});
  } catch (error) {
    return jsonError('Could not save gamification unlock.', 500, String(error));
  }
}
