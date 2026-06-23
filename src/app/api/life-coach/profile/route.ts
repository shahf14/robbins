import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {
  ensureUserProfile,
  getUserParticipantProfile,
  updateUserLifeContexts,
  updateUserParticipantProfile,
} from '@/lib/life-coach/repository';
import {formulationProfilePatchSchema} from '@/lib/life-coach/schemas';
import {jsonError, jsonOk, parseLifeCoachJsonBody} from '@/lib/life-coach/server';

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});
  if (!current.ok) return current.response;

  try {
    await ensureUserProfile(current.user);
    const profile = await getUserParticipantProfile(current.user.id);
    return jsonOk({
      gender: profile.gender,
      age: profile.age,
      life_context_statuses: profile.life_context_statuses,
      life_context_note: profile.life_context_note ?? null,
      wake_time: profile.wake_time ?? null,
      sleep_time: profile.sleep_time ?? null,
      preferred_action_window: profile.preferred_action_window ?? null,
    });
  } catch (error) {
    return jsonError('Could not load profile.', 500, String(error));
  }
}

export async function PATCH(request: Request) {
  const current = await requireLifeCoachAccess(request, {allowDuringOnboarding: true});
  if (!current.ok) return current.response;

  const parsed = await parseLifeCoachJsonBody(request, formulationProfilePatchSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  try {
    await ensureUserProfile(current.user);
    if (parsed.data.life_context_statuses !== undefined) {
      await updateUserLifeContexts(current.user.id, parsed.data.life_context_statuses);
    }
    await updateUserParticipantProfile(current.user.id, {
      gender: parsed.data.gender,
      age: parsed.data.age,
      wake_time: parsed.data.wake_time,
      sleep_time: parsed.data.sleep_time,
      preferred_action_window: parsed.data.preferred_action_window,
      coaching_style: parsed.data.coaching_style,
      family_status: parsed.data.family_status,
      physical_considerations: parsed.data.physical_considerations,
      life_context_note: parsed.data.life_context_note,
    });
    const profile = await getUserParticipantProfile(current.user.id);
    return jsonOk({
      profile,
      gender: profile.gender,
      age: profile.age,
      life_context_statuses: profile.life_context_statuses,
      life_context_note: profile.life_context_note ?? null,
      wake_time: profile.wake_time ?? null,
      sleep_time: profile.sleep_time ?? null,
      preferred_action_window: profile.preferred_action_window ?? null,
    });
  } catch (error) {
    return jsonError('Could not update profile.', 500, String(error));
  }
}
