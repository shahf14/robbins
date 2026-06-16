import type {CheckInTag} from '@/lib/check-in-types';

export function parseMoodScore(value: string | null | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 10) return null;
  return Math.round(parsed);
}

export function fallbackTagForScores(focus: number, energy: number): CheckInTag {
  if (energy <= 4) return 'exhausted';
  if (focus <= 4) return 'distracted';
  if (focus >= 8 && energy >= 8) return 'driven';
  return 'aligned';
}
