import {getDb} from '../sqlite';
import {parseJsonOr} from '@/lib/safe-json';
import type {AiCoachingInsight, WeeklyReview} from '@/lib/life-coach/types';

/** Keep the optional weekly review read model synchronized with its source insight. */
export function upsertWeeklyReviewProjection(insight: AiCoachingInsight): void {
  if (insight.insight_type === 'weekly_review' && insight.metadata) {
    const meta = typeof insight.metadata === 'string'
      ? parseJsonOr<WeeklyReview | null>(insight.metadata, null)
      : (insight.metadata as WeeklyReview);
    if (!meta) return;

    getDb().prepare(
      `INSERT INTO weekly_reviews
        (id, user_id, period_start, period_end, completed_steps_count, main_blocker,
         strongest_domain, weakest_domain, recommended_adjustment, summary,
         domain_progress, created_at)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)
       ON CONFLICT(id) DO UPDATE SET
         user_id = excluded.user_id,
         period_start = excluded.period_start,
         period_end = excluded.period_end,
         completed_steps_count = excluded.completed_steps_count,
         main_blocker = excluded.main_blocker,
         strongest_domain = excluded.strongest_domain,
         weakest_domain = excluded.weakest_domain,
         recommended_adjustment = excluded.recommended_adjustment,
         summary = excluded.summary,
         domain_progress = excluded.domain_progress`
    ).run(
      insight.id, insight.user_id,
      (meta as {period_start?: string}).period_start ?? null,
      (meta as {period_end?: string}).period_end ?? null,
      (meta as WeeklyReview).completed_steps_count ?? null,
      (meta as WeeklyReview).main_blocker ?? null,
      (meta as WeeklyReview).strongest_domain ?? null,
      (meta as WeeklyReview).weakest_domain ?? null,
      (meta as WeeklyReview).recommended_adjustment ?? null,
      (meta as WeeklyReview).summary ?? insight.content ?? null,
      JSON.stringify((meta as WeeklyReview).domain_progress ?? []),
      insight.created_at
    );
  }
}
