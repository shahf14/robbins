import {
  saveGamificationUnlock,
  type GamificationUnlock,
  type GamificationUnlockKind,
} from '@/lib/db/repositories/gamification-unlocks';

export type GamificationEventInput = {
  kind: GamificationUnlockKind;
  reward_key: string;
  week_start?: string | null;
  context?: Record<string, unknown> | null;
};

export function recordGamificationEvent(
  userId: string,
  input: GamificationEventInput
): GamificationUnlock | null {
  return saveGamificationUnlock(userId, input);
}
