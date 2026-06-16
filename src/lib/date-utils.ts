/** Format a Date as YYYY-MM-DD in local time. */
export function dateToYMD(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export function todayYMD(): string {
  return dateToYMD(new Date());
}

export function currentWeekRange(): {start: string; end: string} {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {start: dateToYMD(monday), end: dateToYMD(sunday)};
}

/** Add calendar days to a YYYY-MM-DD string (local calendar). */
export function addDaysYMD(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + days);
  return dateToYMD(date);
}

/** Inclusive day count between two YYYY-MM-DD dates. */
export function daysBetweenYMD(startYmd: string, endYmd: string): number {
  const start = new Date(`${startYmd}T12:00:00`);
  const end = new Date(`${endYmd}T12:00:00`);
  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

/** Format YYYY-MM-DD for display (locale-aware short date). */
export function formatYmdLocale(ymd: string, locale: string): string {
  const [y, m, d] = ymd.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString(locale, {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}
