/**
 * POST /api/life-coach/goals/freestyle
 *
 * Creates a lightweight "freestyle" goal (a self-defined recurring daily task)
 * together with its pre-generated daily_steps. Unified into the goals/daily_steps
 * model — no parallel tables.
 *
 * Body: { domain, title, times_per_day, target_days, success_metric? }
 */
import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {createFreestyleGoal} from '@/lib/db/repositories/goals';
import {jsonError, jsonOk, parseLifeCoachJsonBody} from '@/lib/life-coach/server';
import {LIFE_DOMAINS} from '@/lib/life-coach/types';

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);
  if (!current.ok) return current.response;

  const bodyResult = await parseLifeCoachJsonBody<{
    domain?: string;
    title?: string;
    times_per_day?: number;
    target_days?: number;
    success_metric?: string;
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
  if (body.success_metric && body.success_metric.length > 280) {
    return jsonError('success_metric is too long.', 400);
  }

  try {
    const goal = createFreestyleGoal(current.user.id, {
      domain: body.domain,
      title,
      success_metric: body.success_metric,
      times_per_day: timesPerDay,
      target_days: targetDays,
    });
    return jsonOk({goal}, 201);
  } catch (error) {
    return jsonError('Could not create freestyle goal.', 500, String(error));
  }
}
