import {isPastWakeTimeInTimezone} from '@/lib/schedule-content';
import {generateDailyStepsForUser} from '@/lib/life-coach/generate-daily-steps-for-user';
import {getUserGenerationContext, getUserParticipantProfile, listActiveGoalUsers} from '@/lib/life-coach/repository';
import {jsonError, jsonOk, startOfToday, verifyCronRequest} from '@/lib/life-coach/server';
import {logCronRun} from '@/lib/db/cron-log';

export async function POST(request: Request) {
  const unauthorized = verifyCronRequest(request);

  if (unauthorized) {
    return unauthorized;
  }

  try {
    const userIds = await listActiveGoalUsers();
    let generatedCount = 0;
    let failedCount = 0;
    const errors: {userId: string; error: string}[] = [];

    for (const userId of userIds) {
      try {
        const context = await getUserGenerationContext(userId);

        if (context.goals.length === 0) {
          continue;
        }

        const existing = context.dailySteps.filter((step) => step.scheduled_date === startOfToday());

        if (existing.some((step) => step.generated_by_ai)) {
          continue;
        }

        const profile = await getUserParticipantProfile(userId);
        const wakeTime = profile.wake_time ?? '07:00';
        const sleepTime = profile.sleep_time ?? '22:30';
        const locale = profile.preferred_language ?? 'he';
        const actionWindow = profile.preferred_action_window ?? 'flexible';

        if (!isPastWakeTimeInTimezone(wakeTime, profile.timezone ?? 'UTC')) {
          continue;
        }

        const today = startOfToday();
        await generateDailyStepsForUser(
          userId,
          today,
          locale,
          wakeTime,
          'supportive',
          [],
          actionWindow,
          sleepTime
        );
        generatedCount += 1;
      } catch (error) {
        failedCount += 1;
        errors.push({userId, error: String(error)});
        console.error(`daily-steps cron failed for user ${userId}:`, error);
      }
    }

    logCronRun({
      job: 'daily-steps',
      status: failedCount === 0 ? 'success' : generatedCount === 0 ? 'failed' : 'partial',
      generatedCount,
      failedCount,
      errors,
    });
    return jsonOk({ok: true, generatedCount, failedCount, errors});
  } catch (error) {
    logCronRun({job: 'daily-steps', status: 'failed', generatedCount: 0, failedCount: 1, errors: [{userId: 'unknown', error: String(error)}]});
    return jsonError('Could not run daily life coach cron.', 500, String(error));
  }
}
