import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {deleteDailyBabyStep, rescheduleDailyBabyStep} from '@/lib/life-coach/repository';
import {isIsoDate, jsonError, jsonOk} from '@/lib/life-coach/server';

export async function PATCH(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return jsonError('Invalid JSON body.', 400);
  }

  const scheduledDate = (body as {scheduled_date?: unknown})?.scheduled_date;
  const rescheduledFrom = (body as {rescheduled_from?: unknown})?.rescheduled_from;

  if (typeof scheduledDate !== 'string' || !isIsoDate(scheduledDate)) {
    return jsonError('Invalid scheduled_date. Expected YYYY-MM-DD.', 400);
  }

  const {id} = await params;

  try {
    const step = await rescheduleDailyBabyStep(
      id, scheduledDate,
      typeof rescheduledFrom === 'string' ? rescheduledFrom : undefined,
      current.user.id
    );
    return jsonOk({step});
  } catch (error) {
    if (String(error).includes('not found')) return jsonError('Daily step not found.', 404);
    return jsonError('Could not reschedule daily step.', 500, String(error));
  }
}

export async function DELETE(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const {id} = await params;

  try {
    await deleteDailyBabyStep(id, current.user.id);
    return jsonOk({ok: true});
  } catch (error) {
    if (String(error).includes('not found')) return jsonError('Daily step not found.', 404);
    return jsonError('Could not delete daily step.', 500, String(error));
  }
}
