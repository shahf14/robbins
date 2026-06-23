import {stepActionWindow} from '@/lib/behavior-profile/skip-windows';
import {
  getUserBehaviorProfile,
  refreshUserBehaviorProfile,
  upsertUserBehaviorProfile,
} from '@/lib/behavior-profile/repository';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import type {SkipEventInput} from './skip-adaptation-routing';

export function recordNewSkipBarrier(
  userId: string,
  input: SkipEventInput,
  fallbackWindow: PreferredActionWindow = 'flexible'
): void {
  if (!input.blocker_reason) return;

  const profile = getUserBehaviorProfile(userId, fallbackWindow);
  const common_blockers = profile.common_blockers.includes(input.blocker_reason)
    ? profile.common_blockers
    : [...profile.common_blockers, input.blocker_reason];

  let avoid_windows = [...profile.avoid_windows];
  const pseudoStep = {
    id: 'temp',
    user_id: userId,
    goal_id: null,
    domain: 'mind' as const,
    title: input.step_title,
    description: '',
    estimated_minutes: input.step_estimated_minutes,
    difficulty: 'easy' as const,
    scheduled_date: input.scheduled_date,
    status: input.status,
    generated_by_ai: true,
    is_general: true,
    created_at: `${input.scheduled_date}T18:00:00.000Z`,
    updated_at: `${input.scheduled_date}T18:00:00.000Z`,
    blocker_reason: input.blocker_reason,
  };

  if (
    input.blocker_reason === 'low_energy' &&
    stepActionWindow(pseudoStep) === 'evening' &&
    !avoid_windows.includes('evening')
  ) {
    avoid_windows = [...avoid_windows, 'evening'];
  }

  upsertUserBehaviorProfile({
    ...profile,
    common_blockers,
    avoid_windows,
  });
  refreshUserBehaviorProfile(userId, fallbackWindow);
}
