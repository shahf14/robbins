const MAX_PLAN_DAY = 90;

export function goalDayIndex(goalCreatedAt: string, scheduledDate: string): number {
  const start = parseLocalDateYmd(goalCreatedAt);
  const target = parseLocalDateYmd(scheduledDate);
  const diffMs = target.getTime() - start.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
  return Math.min(Math.max(days, 1), MAX_PLAN_DAY);
}

function parseLocalDateYmd(ymd: string): Date {
  const [year, month, day] = ymd.slice(0, 10).split('-').map(Number);
  return new Date(year, month - 1, day);
}
