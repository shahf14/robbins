import type {AiCoachingInsight} from '@/lib/life-coach/types';

export type WeeklyReviewContext = {
  period_start: string | null;
  period_end: string | null;
  summary: string | null;
  recommended_adjustment: string | null;
  next_best_action: {label: string; description: string} | null;
  progress_evidence: string | null;
  strongest_domain: string | null;
  weakest_domain: string | null;
};

export function extractWeeklyReviewContext(
  review: AiCoachingInsight | null | undefined
): WeeklyReviewContext | null {
  if (!review) return null;
  const m = review.metadata as Record<string, unknown>;

  const nba = m.next_best_action as {label?: string; description?: string} | null | undefined;

  return {
    period_start: (m.period_start as string) ?? null,
    period_end: (m.period_end as string) ?? null,
    summary: (m.summary as string) ?? null,
    recommended_adjustment: (m.recommended_adjustment as string) ?? null,
    next_best_action:
      nba?.label
        ? {label: nba.label, description: nba.description ?? ''}
        : null,
    progress_evidence: (m.progress_evidence as string) ?? null,
    strongest_domain: (m.strongest_domain as string) ?? null,
    weakest_domain: (m.weakest_domain as string) ?? null,
  };
}
