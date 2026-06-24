import {dateToYMD, todayYMD} from '../date-utils.ts';

/** Monday–Sunday ISO week containing `date` (YYYY-MM-DD). */
export function isoWeekWindow(date: string): {start: string; end: string} {
  const d = new Date(`${date}T12:00:00`);
  const day = d.getDay();
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diffToMonday);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  return {
    start: dateToYMD(monday),
    end: dateToYMD(sunday),
  };
}

/** Monday–Sunday ISO week containing today (local calendar). */
export function currentWeekRange(): {start: string; end: string} {
  return isoWeekWindow(todayYMD());
}

export function dateInWeek(date: string, weekStart: string, weekEnd: string): boolean {
  return date >= weekStart && date <= weekEnd;
}
