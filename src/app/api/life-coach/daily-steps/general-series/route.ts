/**
 * POST /api/life-coach/daily-steps/general-series
 *
 * Creates a repeated domain-level daily task without a goal. This replaces the
 * old "freestyle goal" flow: each occurrence is stored directly as a
 * daily_steps row with is_general=1 and goal_id=NULL.
 *
 * Body: { domain, title, times_per_day, target_days }
 */
import {addDaysYMD, dateToYMD} from '@/lib/date-utils';
import {ensureDomainAssessmentForGoal} from '@/lib/db/repositories/goals';
import {createDailyBabyStep, DailyStepRelationError} from '@/lib/life-coach/repository';
import {toDailyBabyStepsResponse} from '@/lib/life-coach/response-dtos';
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {jsonError, jsonMutation, parseLifeCoachJsonBody} from '@/lib/life-coach/server';
import {LIFE_DOMAINS, type DailyBabyStep} from '@/lib/life-coach/types';

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);
  if (!current.ok) return current.response;

  const bodyResult = await parseLifeCoachJsonBody<{
    domain?: string;
    title?: string;
    times_per_day?: number;
    target_days?: number;
  }>(request);
  if (!bodyResult.ok) return bodyResult.response;
  const body = bodyResult.data ?? {};

  const title = body.title?.trim();
  if (!title) return jsonError('Missing task title.', 400);
  if (title.length > 80) return jsonError('Task title is too long.', 400);
  if (!body.domain || !(LIFE_DOMAINS as readonly string[]).includes(body.domain)) {
    return jsonError('Invalid or missing domain.', 400);
  }

  const timesPerDay = Number(body.times_per_day ?? 1);
  const targetDays = Number(body.target_days ?? 1);
  if (!Number.isInteger(timesPerDay) || timesPerDay < 1 || timesPerDay > 20) {
    return jsonError('times_per_day must be an integer between 1 and 20.', 400);
  }
  if (!Number.isInteger(targetDays) || targetDays < 1 || targetDays > 365) {
    return jsonError('target_days must be an integer between 1 and 365.', 400);
  }

  try {
    const domain = body.domain as DailyBabyStep['domain'];
    const today = dateToYMD(new Date());
    const steps: DailyBabyStep[] = [];
    ensureDomainAssessmentForGoal(current.user.id, domain);

    for (let day = 0; day < targetDays; day++) {
      const scheduled = addDaysYMD(today, day);
      for (let occ = 0; occ < timesPerDay; occ++) {
        steps.push(
          await createDailyBabyStep(current.user.id, {
            goal_id: null,
            domain,
            title,
            description: '',
            estimated_minutes: 5,
            difficulty: 'easy',
            scheduled_date: scheduled,
            status: 'pending',
            generated_by_ai: false,
            is_general: true,
          })
        );
      }
    }

    return jsonMutation({steps: toDailyBabyStepsResponse(steps)}, 201);
  } catch (error) {
    if (error instanceof DailyStepRelationError) {
      return jsonError(error.message, 400);
    }
    return jsonError('Could not create general daily tasks.', 500, String(error));
  }
}
