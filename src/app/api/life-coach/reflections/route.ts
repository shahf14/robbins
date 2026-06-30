import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {upsertDailyReflection} from '@/lib/life-coach/repository';
import {toDailyReflectionResponse} from '@/lib/life-coach/response-dtos';
import {jsonError, jsonMutation, parseLifeCoachJsonBody} from '@/lib/life-coach/server';
import {reflectionCreateInputSchema} from '@/lib/life-coach/schemas';

export async function POST(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  const parsed = await parseLifeCoachJsonBody(request, reflectionCreateInputSchema);
  if (!parsed.ok) {
    return parsed.response;
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

    return jsonMutation({reflection: toDailyReflectionResponse(reflection)}, 201);
  } catch (error) {
    return jsonError('Could not save reflection.', 500, String(error));
  }
}
