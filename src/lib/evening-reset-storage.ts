import {mergeLocalAuthHeaders} from '@/lib/auth/client-headers';
import {observeAuthResponse} from '@/lib/auth/observe-auth-response';
import {throwIfNotOk} from '@/lib/http/api-response-error';
import {storageFetch} from '@/lib/http/storage-fetch';
import type {EveningResetSession} from './evening-reset-types';
import type {EveningResetPainContext} from './evening-reset/pain-context';
import type {AccountabilityContext} from '@/lib/formulation/accountability-routing';
import type {EmotionalStageRouting} from '@/lib/formulation/emotional-stage-routing';
import type {MeditationRecommendation} from '@/lib/formulation/meditation-routing';
import {mergeSessions, readLegacyItems, removePendingSession} from '@/lib/legacy-session-storage';
import {computeRitualStreak} from '@/lib/ritual-streak';

const SESSIONS_KEY = 'evening_reset_sessions';

export type EveningResetBootContext = {
  painContext: EveningResetPainContext | null;
  emotionalStage: EmotionalStageRouting | null;
  meditationRecommendation: MeditationRecommendation | null;
  accountability: AccountabilityContext | null;
};

export async function fetchEveningBootContext(): Promise<EveningResetBootContext> {
  try {
    const response = await fetch('/api/evening-reset/pain-context', {
      headers: mergeLocalAuthHeaders(),
    });
    observeAuthResponse(response);
    if (!response.ok) return {painContext: null, emotionalStage: null, meditationRecommendation: null, accountability: null};
    const data = (await response.json()) as {
      pain_context?: EveningResetPainContext | null;
      emotional_stage?: EmotionalStageRouting | null;
      meditation_recommendation?: MeditationRecommendation | null;
      accountability?: AccountabilityContext | null;
    };
    return {
      painContext: data.pain_context ?? null,
      emotionalStage: data.emotional_stage ?? null,
      meditationRecommendation: data.meditation_recommendation ?? null,
      accountability: data.accountability ?? null,
    };
  } catch {
    return {painContext: null, emotionalStage: null, meditationRecommendation: null, accountability: null};
  }
}

export async function fetchEveningSessions(options?: {strict?: boolean}): Promise<EveningResetSession[]> {
  const pending = readLegacyItems<EveningResetSession>(SESSIONS_KEY) ?? [];
  try {
    const res = await fetch('/api/evening-reset?limit=400', {headers: mergeLocalAuthHeaders()});
    if (options?.strict) {
      await throwIfNotOk(res);
    } else {
      observeAuthResponse(res);
      if (!res.ok) return pending;
    }
    const data = (await res.json()) as {sessions?: EveningResetSession[]};
    if (pending.length > 0) {
      await Promise.all(pending.map(persistEveningSession));
    }
    const remainingPending = readLegacyItems<EveningResetSession>(SESSIONS_KEY) ?? [];
    return mergeSessions(data.sessions ?? [], remainingPending);
  } catch (error) {
    if (options?.strict) throw error;
    return pending;
  }
}

export async function persistEveningSession(
  session: EveningResetSession
): Promise<EveningResetSession | null> {
  const MAX_ATTEMPTS = 3;
  let lastError: unknown;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    if (attempt > 0) {
      await new Promise((r) => setTimeout(r, 1000 * Math.pow(2, attempt - 1)));
    }
    try {
      const data = await storageFetch<{session?: EveningResetSession}>('/api/evening-reset', {
        method: 'POST',
        body: JSON.stringify(session),
      });
      removePendingSession(SESSIONS_KEY, session.id);
      return data.session ?? session;
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError ?? new Error('Could not save evening reset session.');
}

export function persistEveningSessionWithFallback(session: EveningResetSession): void {
  void persistEveningSession(session).catch(() => {
    const pending = readLegacyItems<EveningResetSession>(SESSIONS_KEY) ?? [];
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(mergeSessions([session], pending)));
  });
}

export function getEveningStreak(sessions: EveningResetSession[]): number {
  return computeRitualStreak(sessions);
}

export function computeReadinessScore(session: Partial<EveningResetSession>): number {
  let score = 0;
  if (session.biggestWin?.trim()) score += 15;
  if (session.successFactors?.trim() || session.blockers?.trim()) score += 10;
  if (session.emotionalDump?.trim()) score += 15;
  if (session.gratitudeItems?.some((g) => g.trim())) score += 25;
  if (session.tomorrowsWin?.trim()) score += 25;
  if (session.preparedItems && session.preparedItems.length > 0) score += 10;
  return Math.min(100, score);
}
