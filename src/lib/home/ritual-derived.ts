import type {MorningRitualSession} from '@/lib/morning-ritual-types';

export function ritualEnergy(session: MorningRitualSession | undefined): number | null {
  if (!session) return null;
  const score = session.energyScore ?? (session.moodBefore ? Number(session.moodBefore) : null);
  if (score == null || !Number.isFinite(score) || score < 1 || score > 10) return null;
  return Math.round(score);
}

export function completedRitualSessions(sessions: MorningRitualSession[]): MorningRitualSession[] {
  return sessions.filter((session) => session.completed);
}

export function energyTrend(sessions: MorningRitualSession[]): 'up' | 'down' | 'flat' {
  const completed = completedRitualSessions(sessions);
  if (completed.length < 2) return 'flat';
  const recent = completed.slice(0, 3).map((session) => ritualEnergy(session)).filter((value): value is number => value != null);
  if (recent.length < 2) return 'flat';
  const avg = recent.reduce((a, b) => a + b, 0) / recent.length;
  const first = recent[0];
  if (first > avg + 0.5) return 'up';
  if (first < avg - 0.5) return 'down';
  return 'flat';
}

export function survivalSignalsFromSessions(sessions: MorningRitualSession[]) {
  return completedRitualSessions(sessions)
    .map((session) => ({
      energy: ritualEnergy(session) ?? 6,
      primaryTag: session.primaryTag ?? null,
    }))
    .filter((entry) => entry.energy != null);
}
