import {weeklyReviewResponseSchema, type WeeklyReviewAiResponse} from '@/lib/life-coach/schemas';
import type {WeeklyReview} from '@/lib/life-coach/types';

/** Validate weekly-review core fields before persisting to ai_insights / weekly_reviews. */
export function assertWeeklyReviewPersistable(review: WeeklyReview): WeeklyReviewAiResponse {
  return weeklyReviewResponseSchema.parse({
    completed_steps_count: review.completed_steps_count,
    domain_progress: review.domain_progress,
    main_blocker: review.main_blocker,
    strongest_domain: review.strongest_domain,
    weakest_domain: review.weakest_domain,
    recommended_adjustment: review.recommended_adjustment,
    summary: review.summary,
    emotional_reflection: review.emotional_reflection,
    recurring_pattern: review.recurring_pattern,
    progress_evidence: review.progress_evidence,
    next_best_action: review.next_best_action,
  });
}
