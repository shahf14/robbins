const MAX_PLAN_DAY = 90;

export function goalDayIndex(goalCreatedAt: string, scheduledDate: string): number {
  const start = new Date(goalCreatedAt.slice(0, 10));
  const target = new Date(scheduledDate);
  const diffMs = target.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(Math.max(days, 1), MAX_PLAN_DAY);
}
