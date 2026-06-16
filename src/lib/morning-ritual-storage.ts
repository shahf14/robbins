import type {AffirmationItem, IdentityOption, MorningRitualSession} from './morning-ritual-types';
import type {MorningRitualYesterdayContext} from './morning-ritual/yesterday-context';
import type {MorningRitualGoalContext} from './morning-ritual/goal-context';
import type {EmotionalStageRouting} from '@/lib/formulation/emotional-stage-routing';
import type {MeditationRecommendation} from '@/lib/formulation/meditation-routing';
import {mergeSessions, readLegacyItems, removePendingSession} from '@/lib/legacy-session-storage';

export type MorningRitualBootContext = {
  yesterday: MorningRitualYesterdayContext | null;
  goal: MorningRitualGoalContext | null;
  emotionalStage: EmotionalStageRouting | null;
  meditationRecommendation: MeditationRecommendation | null;
};

const AFFIRMATIONS_KEY = 'morning_ritual_affirmations';
const IDENTITIES_KEY = 'morning_ritual_identities';
const SESSIONS_KEY = 'morning_ritual_sessions';

/**
 * Ritual sessions are stored in the local SQLite DB (via /api/morning-rituals),
 * not in localStorage. These helpers talk to that API.
 */
export async function fetchMorningRitualBootContext(): Promise<MorningRitualBootContext> {
  try {
    const response = await fetch('/api/morning-ritual/yesterday-context', {
      headers: {'Content-Type': 'application/json'},
    });
    if (!response.ok) return {yesterday: null, goal: null, emotionalStage: null, meditationRecommendation: null};
    const data = (await response.json()) as {
      context?: MorningRitualYesterdayContext | null;
      goal_context?: MorningRitualGoalContext | null;
      emotional_stage?: EmotionalStageRouting | null;
      meditation_recommendation?: MeditationRecommendation | null;
    };
    return {
      yesterday: data.context ?? null,
      goal: data.goal_context ?? null,
      emotionalStage: data.emotional_stage ?? null,
      meditationRecommendation: data.meditation_recommendation ?? null,
    };
  } catch {
    return {yesterday: null, goal: null, emotionalStage: null, meditationRecommendation: null};
  }
}

export async function fetchSessions(): Promise<MorningRitualSession[]> {
  const pending = readLegacyItems<MorningRitualSession>(SESSIONS_KEY) ?? [];
  try {
    const res = await fetch('/api/morning-rituals', {headers: {'Content-Type': 'application/json'}});
    if (!res.ok) return pending;
    const data = (await res.json()) as {sessions?: MorningRitualSession[]};
    if (pending.length > 0) {
      await Promise.all(pending.map(persistSession));
      window.localStorage.removeItem(SESSIONS_KEY);
    }
    return mergeSessions(data.sessions ?? [], pending);
  } catch {
    return pending;
  }
}

async function persistSession(session: MorningRitualSession): Promise<void> {
  const response = await fetch('/api/morning-rituals', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(session),
  });
  if (!response.ok) {
    throw new Error('Could not save morning ritual session.');
  }
  removePendingSession(SESSIONS_KEY, session.id);
}

export function persistSessionWithFallback(session: MorningRitualSession): void {
  void persistSession(session).catch(() => {
    const pending = readLegacyItems<MorningRitualSession>(SESSIONS_KEY) ?? [];
    window.localStorage.setItem(SESSIONS_KEY, JSON.stringify(mergeSessions([session], pending)));
  });
}

export function saveAffirmations(items: AffirmationItem[]) {
  void persistRitualContent({affirmations: items})
    .then(() => window.localStorage.removeItem(AFFIRMATIONS_KEY))
    .catch(() => window.localStorage.setItem(AFFIRMATIONS_KEY, JSON.stringify(items)));
}

export function saveIdentities(items: IdentityOption[]) {
  void persistRitualContent({identities: items})
    .then(() => window.localStorage.removeItem(IDENTITIES_KEY))
    .catch(() => window.localStorage.setItem(IDENTITIES_KEY, JSON.stringify(items)));
}

export async function fetchRitualContent() {
  let databaseContent: {affirmations: AffirmationItem[]; identities: IdentityOption[]} = {
    affirmations: [],
    identities: [],
  };

  try {
    const response = await fetch('/api/morning-rituals/content', {
      headers: {'Content-Type': 'application/json'},
    });
    if (response.ok) {
      databaseContent = await response.json() as typeof databaseContent;
    }
  } catch {
    // Keep the local UI usable if the local API is temporarily unavailable.
  }

  const legacyAffirmations = readLegacyItems<AffirmationItem>(AFFIRMATIONS_KEY);
  const legacyIdentities = readLegacyItems<IdentityOption>(IDENTITIES_KEY);

  if (legacyAffirmations || legacyIdentities) {
    try {
      await persistRitualContent({
        ...(legacyAffirmations ? {affirmations: legacyAffirmations} : {}),
        ...(legacyIdentities ? {identities: legacyIdentities} : {}),
      });
      window.localStorage.removeItem(AFFIRMATIONS_KEY);
      window.localStorage.removeItem(IDENTITIES_KEY);
    } catch {
      // Retain the browser copy until migration to SQLite succeeds.
    }
  }

  return {
    affirmations: legacyAffirmations ?? databaseContent.affirmations,
    identities: legacyIdentities ?? databaseContent.identities,
  };
}

export function getStreak(sessions: MorningRitualSession[]): number {
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

async function persistRitualContent(body: {
  affirmations?: AffirmationItem[];
  identities?: IdentityOption[];
}) {
  const response = await fetch('/api/morning-rituals/content', {
    method: 'POST',
    headers: {'Content-Type': 'application/json'},
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error('Could not save ritual content.');
  }
}
