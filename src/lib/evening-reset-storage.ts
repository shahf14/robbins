import {mergeLocalAuthHeaders} from '@/lib/auth/client-headers';
import {observeAuthResponse} from '@/lib/auth/observe-auth-response';
import {throwIfNotOk} from '@/lib/http/api-response-error';
import type {EveningResetSession} from './evening-reset-types';
import type {EveningResetPainContext} from './evening-reset/pain-context';
import type {AccountabilityContext} from '@/lib/formulation/accountability-routing';
import type {EmotionalStageRouting} from '@/lib/formulation/emotional-stage-routing';
import type {MeditationRecommendation} from '@/lib/formulation/meditation-routing';
import {mergeSessions, readLegacyItems, removePendingSession} from '@/lib/legacy-session-storage';

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
    const res = await fetch('/api/evening-reset', {headers: mergeLocalAuthHeaders()});
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
  const response = await fetch('/api/evening-reset', {
    method: 'POST',
    headers: mergeLocalAuthHeaders(),
    body: JSON.stringify(session),
  });
  if (!response.ok) {
    throw new Error('Could not save evening reset session.');
  }
  removePendingSession(SESSIONS_KEY, session.id);
  const data = (await response.json()) as {session?: EveningResetSession};
  return data.session ?? session;
}

export function persistEveningSessionWithFallback(session: EveningResetSession): void {
  void persistEveningSession(session).catch(() => {
    const pending = readLegacyItems<EveningResetSession>(SESSIONS_KEY) ?? [];
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(mergeSessions([session], pending)));
  });
}

export function getEveningStreak(sessions: EveningResetSession[]): number {
  const completed = sessions.filter((s) => s.completed && s.completedAt);
  if (completed.length === 0) return 0;

  let streak = 0;
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i <= 365; i++) {
    const checkDate = new Date(today);
    checkDate.setDate(checkDate.getDate() - i);
    const dateStr = checkDate.toDateString();

    const hasEntry = completed.some(
      (s) => new Date(s.completedAt!).toDateString() === dateStr
    );

    if (hasEntry) {
      streak++;
    } else if (i > 0) {
      break;
    }
  }
  return streak;
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
