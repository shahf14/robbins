import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {AiRateLimitExceededError} from '@/lib/ai-rate-limit';
import {DailyStepsGenerationLockedError} from '@/lib/life-coach/daily-steps-generation-lock';
import {generateDailyStepsForUser} from '@/lib/life-coach/generate-daily-steps-for-user';
import {getOnboardingServerStatus, getUserParticipantProfile, listDailyBabyStepsForDate} from '@/lib/life-coach/repository';
import {toDailyBabyStepsResponse} from '@/lib/life-coach/response-dtos';
import {jsonError, jsonOk, resolveLocale, startOfToday, parseLifeCoachJsonBody} from '@/lib/life-coach/server';
import {aiGenerateDailyStepsRequestSchema} from '@/lib/life-coach/schemas';
import {isFirstWinStep} from '@/lib/formulation/first-win-routing';
import {
  filterStepsForDomain,
  hasReusablePendingAiSteps,
} from '@/lib/life-coach/generate-daily-steps-scope';

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const onboarding = await getOnboardingServerStatus(current.user.id);
  if (!onboarding.completedAt) {
    return jsonError('Onboarding required.', 403);
  }

  const parsed = await parseLifeCoachJsonBody(request, aiGenerateDailyStepsRequestSchema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const date = parsed.data.date ?? startOfToday();
  const force = parsed.data.force === true;
  const domain = parsed.data.domain;
  const includeFirstWin = parsed.data.include_first_win === true;

  try {
    const existing = await listDailyBabyStepsForDate(date, current.user.id);
    const scopedExisting = filterStepsForDomain(existing, domain);

    if (hasReusablePendingAiSteps(existing, domain) && !force) {
      const needsFirstWin =
        !domain && includeFirstWin && !existing.some(isFirstWinStep);
      if (!needsFirstWin) {
        return jsonOk({
          date,
          steps: toDailyBabyStepsResponse(scopedExisting),
          generation_in_progress: false,
        });
      }
    }

    const profile = await getUserParticipantProfile(current.user.id);
    const locale = resolveLocale(profile.preferred_language ?? null);
    const wakeTime =
      profile.wake_time && /^\d{2}:\d{2}$/.test(profile.wake_time) ? profile.wake_time : '07:00';
    const sleepTime =
      profile.sleep_time && /^\d{2}:\d{2}$/.test(profile.sleep_time) ? profile.sleep_time : '22:30';
    const coachingStyle = profile.coaching_style ?? 'supportive';
    const physicalConsiderations = Array.isArray(profile.physical_considerations)
      ? profile.physical_considerations
      : [];
    const preferredActionWindow = (profile.preferred_action_window ?? 'flexible') as import('@/lib/user-preferences').PreferredActionWindow;
    const steps = await generateDailyStepsForUser(
      current.user.id,
      date,
      locale,
      wakeTime,
      coachingStyle,
      physicalConsiderations,
      preferredActionWindow,
      sleepTime,
      includeFirstWin,
      domain
    );
    return jsonOk({
      date,
      steps: toDailyBabyStepsResponse(filterStepsForDomain(steps, domain)),
      generation_in_progress: false,
    });
  } catch (error) {
    if (error instanceof AiRateLimitExceededError) {
      const retryAfterSeconds = Math.max(1, Math.ceil((error.resetAt - Date.now()) / 1000));
      return jsonError('AI rate limit exceeded.', 429, undefined, {
        extra: {retry_after_seconds: retryAfterSeconds},
        headers: {'Retry-After': String(retryAfterSeconds)},
      });
    }
    if (error instanceof DailyStepsGenerationLockedError) {
      const inFlightExisting = await listDailyBabyStepsForDate(date, current.user.id);
      const scoped = filterStepsForDomain(inFlightExisting, domain);
      if (scoped.length > 0) {
        return jsonOk({
          date,
          steps: toDailyBabyStepsResponse(scoped),
          generation_in_progress: true,
        });
      }
      return jsonError('Daily steps generation already in progress.', 409);
    }
    return jsonError('Could not generate daily steps.', 500, String(error));
  }
}
