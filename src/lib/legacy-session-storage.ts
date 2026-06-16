import {parseJsonArrayOr} from '@/lib/safe-json';

type LegacySession = {
  id: string;
  startedAt: string;
  completedAt?: string | null;
};

export function readLegacyItems<T>(key: string): T[] | null {
  const raw = window.localStorage.getItem(key);
  if (raw === null) return null;
  return parseJsonArrayOr<T>(raw);
}

export function mergeSessions<T extends LegacySession>(primary: T[], secondary: T[]): T[] {
  return [...new Map([...secondary, ...primary].map((session) => [session.id, session])).values()]
    .sort((a, b) => (b.completedAt ?? b.startedAt).localeCompare(a.completedAt ?? a.startedAt));
}

export function removePendingSession(key: string, id: string): void {
  const pending = readLegacyItems<LegacySession>(key);
  if (!pending) return;
  const next = pending.filter((session) => session.id !== id);
  if (next.length === 0) {
    window.localStorage.removeItem(key);
  } else {
    window.localStorage.setItem(key, JSON.stringify(next));
  }
}
