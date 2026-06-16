import type {MorningRitualSession} from '@/lib/morning-ritual-types';

export type MorningRitualWeeklySummary = {
  sessions_completed: number;
  avg_duration_seconds: number | null;
  mood_before_trend: string[];
  mood_after_trend: string[];
  avg_mood_lift: number | null;
  breathing_completion_rate: number | null;
  gratitude_avg_entries: number | null;
  skipped_steps_common: string[];
  visualization_types: string[];
};

export function summarizeMorningRitualsForWeek(
  sessions: MorningRitualSession[],
  periodStart: string,
  periodEnd: string
): MorningRitualWeeklySummary | null {
  const weekSessions = sessions.filter(
    (s) => s.completedAt && s.completedAt >= periodStart && s.completedAt <= periodEnd && s.completed
  );

  if (weekSessions.length === 0) return null;

  const avg_duration_seconds =
    weekSessions.length > 0
      ? Math.round(weekSessions.reduce((sum, s) => sum + s.durationSeconds, 0) / weekSessions.length)
      : null;

  const moodBeforeList = weekSessions
    .map((s) => s.moodBefore)
    .filter((m): m is string => m != null && m.trim().length > 0);

  const moodAfterList = weekSessions
    .map((s) => s.moodAfter)
    .filter((m): m is string => m != null && m.trim().length > 0);

  const breathingDone = weekSessions.filter((s) => s.breathingCompleted).length;
  const breathing_completion_rate =
    weekSessions.length > 0 ? Math.round((breathingDone / weekSessions.length) * 100) : null;

  const gratitude_avg_entries =
    weekSessions.length > 0
      ? Math.round(
          weekSessions.reduce((sum, s) => sum + (s.gratitudeEntries?.length ?? 0), 0) /
            weekSessions.length
        )
      : null;

  const skippedCounts = new Map<string, number>();
  for (const s of weekSessions) {
    for (const step of s.skippedSteps ?? []) {
      skippedCounts.set(step, (skippedCounts.get(step) ?? 0) + 1);
    }
  }
  const skipped_steps_common = [...skippedCounts.entries()]
    .filter(([, count]) => count >= Math.ceil(weekSessions.length / 2))
    .map(([step]) => step);

  const vizTypes = weekSessions
    .map((s) => s.visualizationContentType)
    .filter((v): v is NonNullable<typeof v> => v != null);

  const vizCounts = new Map<string, number>();
  for (const type of vizTypes) {
    vizCounts.set(type, (vizCounts.get(type) ?? 0) + 1);
  }
  const visualization_types = ([...vizCounts.entries()] as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .map(([type]) => type);

  // Compute mood lift as percentage of sessions where mood improved
  const moodLiftCount = weekSessions.filter(
    (s) => s.moodBefore && s.moodAfter && s.moodAfter !== s.moodBefore
  ).length;
  const avg_mood_lift =
    weekSessions.length > 0 && moodBeforeList.length > 0
      ? Math.round((moodLiftCount / weekSessions.length) * 100)
      : null;

  return {
    sessions_completed: weekSessions.length,
    avg_duration_seconds,
    mood_before_trend: moodBeforeList,
    mood_after_trend: moodAfterList,
    avg_mood_lift,
    breathing_completion_rate,
    gratitude_avg_entries,
    skipped_steps_common,
    visualization_types,
  };
}
