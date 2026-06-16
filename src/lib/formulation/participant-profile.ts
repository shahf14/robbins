import type {LifeContextStatus} from '@/lib/life-coach/types';

export const PARTICIPANT_GENDERS = ['female', 'male'] as const;

export type ParticipantGender = (typeof PARTICIPANT_GENDERS)[number];

export type ParticipantProfileLocks = {
  life_context_statuses: boolean;
  gender: boolean;
  age: boolean;
};

export function isParticipantGender(value: string): value is ParticipantGender {
  return (PARTICIPANT_GENDERS as readonly string[]).includes(value);
}

export function normalizeParticipantAge(value: unknown): number | null {
  if (value == null || value === '') return null;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  if (!Number.isFinite(n) || n < 16 || n > 120) return null;
  return n;
}
