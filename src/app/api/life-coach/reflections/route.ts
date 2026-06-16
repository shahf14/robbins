import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {upsertDailyReflection} from '@/lib/life-coach/repository';
import {jsonError, jsonOk} from '@/lib/life-coach/server';
import {reflectionCreateInputSchema} from '@/lib/life-coach/schemas';

export async function POST(request: Request) {
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

  const parsed = reflectionCreateInputSchema.safeParse(body);

  if (!parsed.success) {
    return jsonError('Invalid reflection payload.', 400, parsed.error.flatten());
  }

  try {
    const reflection = await upsertDailyReflection(current.user.id, {
      date: parsed.data.date,
      mood_score: parsed.data.mood_score,
      energy_score: parsed.data.energy_score,
      reflection_text: parsed.data.reflection_text || null,
      blocker_reason: parsed.data.blocker_reason,
      writing_duration_sec: parsed.data.writing_duration_sec,
      reflection_word_count: parsed.data.reflection_word_count,
      self_blame_language: parsed.data.self_blame_language,
    });

    return jsonOk({reflection}, 201);
  } catch (error) {
    return jsonError('Could not save reflection.', 500, String(error));
  }
}
