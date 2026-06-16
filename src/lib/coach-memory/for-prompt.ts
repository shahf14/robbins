import type {LongTermProfile, ShortTermContext} from './types';

export function shortTermContextForPrompt(
  ctx: ShortTermContext | null | undefined
): Record<string, unknown> | null {
  if (!ctx || ctx.completed + ctx.skipped + ctx.partial === 0) return null;
  return {
    window_days: ctx.window_days,
    period_start: ctx.period_start,
    period_end: ctx.period_end,
    completion_rate: ctx.completion_rate,
    completed: ctx.completed,
    skipped: ctx.skipped,
    partial: ctx.partial,
    pending_today: ctx.pending_today,
    recent_blockers: ctx.recent_blockers,
    latest_energy: ctx.latest_energy,
    latest_mood: ctx.latest_mood,
    domain_scores: ctx.domain_scores,
    completed_easy: ctx.completed_easy,
    skipped_hard: ctx.skipped_hard,
    worst_blocker: ctx.worst_blocker,
  };
}

export function longTermProfileForPrompt(
  profile: LongTermProfile | null | undefined
): Record<string, unknown> | null {
  if (!profile || profile.sample_size === 0) return null;
  return {
    window_days: profile.window_days,
    sample_size: profile.sample_size,
    overall_completion_rate: profile.overall_completion_rate,
    best_action_window: profile.best_action_window,
    action_window_stats: profile.action_window_stats,
    winning_patterns: profile.winning_patterns,
    losing_patterns: profile.losing_patterns,
    successful_domains: profile.successful_domains,
    struggling_domains: profile.struggling_domains,
    avg_successful_minutes: profile.avg_successful_minutes,
    recovery_rate: profile.recovery_rate,
    avoid: profile.avoid,
  };
}
