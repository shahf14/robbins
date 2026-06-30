import {requireLifeCoachAccess} from '@/lib/life-coach/require-access';
import {getLatestWeeklyReview} from '@/lib/life-coach/repository';
import {toNullableAiCoachingInsightResponse} from '@/lib/life-coach/response-dtos';
import {jsonError, jsonOk} from '@/lib/life-coach/server';

export async function GET(request: Request) {
  const current = await requireLifeCoachAccess(request);

  if (!current.ok) {
    return current.response;
  }

  try {
    const review = await getLatestWeeklyReview(current.user.id);
    return jsonOk({review: toNullableAiCoachingInsightResponse(review)});
  } catch (error) {
    return jsonError('Could not load latest weekly review.', 500, String(error));
  }
}
