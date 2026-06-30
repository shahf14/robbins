import {dateToYMD} from '@/lib/date-utils';

type RitualSessionLike = {
  completed: boolean;
  completedAt?: string | null;
};

/** Consecutive completed ritual days ending at the most recent completion (today must be included). */
export function computeRitualStreak(sessions: RitualSessionLike[]): number {
  const completed = sessions.filter((s) => s.completed && s.completedAt);
  if (completed.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i <= 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = dateToYMD(checkDate);

    const hasEntry = completed.some(
      (s) => dateToYMD(new Date(s.completedAt!)) === dateStr
    );

    if (hasEntry) {
      streak++;
    } else {
      break;
    }
  }

  return streak;
}
