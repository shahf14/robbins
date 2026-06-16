import type {AppLocale} from '@/i18n/config';

export const COACH_EMOTIONS = [
  'driven',
  'flat',
  'anxious',
  'avoidant',
  'disappointed',
  'excited',
  'overwhelmed',
  'confused',
  'angry',
  'grateful',
] as const;

export type CoachEmotion = (typeof COACH_EMOTIONS)[number];

export type CoachRequestPayload = {
  language: AppLocale;
  tone: 'tony_coach';
  emotionalState: CoachEmotion;
  escape: number;
  energy: number;
  userText: string;
};

import type {NextBestAction} from '@/lib/next-best-action';

export type CoachResponsePayload = {
  response: string;
  source: 'openai' | 'local_fallback' | 'personalized_fallback';
  next_best_action?: NextBestAction | null;
};

export async function askVirtualCoach(
  payload: CoachRequestPayload
): Promise<CoachResponsePayload> {
  const response = await fetch('/api/coach', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as {error?: string};
    throw new Error(body.error ?? 'Coach request failed.');
  }

  return (await response.json()) as CoachResponsePayload;
}
