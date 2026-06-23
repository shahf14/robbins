import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {updateDailyBabyStepContent} from '@/lib/life-coach/repository';
import {jsonError, jsonOk, parseLifeCoachJsonBody} from '@/lib/life-coach/server';
import {z} from 'zod';

const schema = z.object({
  title: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional().default(''),
  estimated_minutes: z.number().int().min(1).max(480),
  difficulty: z.enum(['easy', 'medium', 'hard']),
});

export async function PATCH(
  request: Request,
  {params}: {params: Promise<{id: string}>}
) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const parsed = await parseLifeCoachJsonBody(request, schema);
  if (!parsed.ok) {
    return parsed.response;
  }

  const {id} = await params;

  try {
    const step = await updateDailyBabyStepContent(id, parsed.data, current.user.id);
    return jsonOk({step});
  } catch (error) {
    if (String(error).includes('not found')) return jsonError('Daily step not found.', 404);
    return jsonError('Could not update daily step.', 500, String(error));
  }
}
