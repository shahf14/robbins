import {lifeCoachApi} from '@/lib/life-coach/api-client';
import {classifyLoadFailure, type ApiLoadFailureKind} from '@/lib/life-coach/api-error';
import {currentWeekRange, todayYMD} from '@/lib/date-utils';
import {fetchEveningSessions} from '@/lib/evening-reset-storage';
import {
  fetchFormulationCoachContext,
  type FormulationCoachContext,
} from '@/lib/formulation/personalized-challenge-storage';
import type {HomeDashboardData} from '@/lib/home/dashboard-derived';
import {fetchSessions, getStreak} from '@/lib/morning-ritual-storage';
import type {MorningRitualSession} from '@/lib/morning-ritual-types';
import type {EveningResetSession} from '@/lib/evening-reset-types';
import {sumWeeklyInvestedMinutes} from '@/lib/life-coach/weekly-minutes';

export type HomeOptionalSection = 'rituals' | 'evening' | 'coachContext' | 'dailyFocus';

const EMPTY_COACH_CONTEXT: FormulationCoachContext = {
  challenge: null,
  load_adaptation: null,
  comeback_messaging: null,
  accountability: null,
  behavior_change: null,
  skip_adaptation: null,
};

export type HomeDashboardLoadSuccess = {
  ok: true;
  data: HomeDashboardData;
  partialFailures: HomeOptionalSection[];
};

export type HomeDashboardLoadFailure = {
  ok: false;
  failure: ApiLoadFailureKind;
};

export type HomeDashboardLoadResult = HomeDashboardLoadSuccess | HomeDashboardLoadFailure;

type LoadInput = {
  displayName: string;
  previous: HomeDashboardData | null;
};

async function loadOptionalSection<T>(
  section: HomeOptionalSection,
  loader: () => Promise<T>,
  fallback: T,
  partialFailures: HomeOptionalSection[],
  previousValue: T | undefined
): Promise<T> {
  try {
    return await loader();
  } catch {
    partialFailures.push(section);
    return previousValue ?? fallback;
  }
}

function ritualFlagsFromSessions(sessions: MorningRitualSession[]) {
  const todayStr = new Date().toDateString();
  return {
    ritualStreak: getStreak(sessions),
    hasTodayRitual: sessions.some(
      (session) =>
        session.completed &&
        session.completedAt &&
        new Date(session.completedAt).toDateString() === todayStr
    ),
  };
}

function hasTodayEveningFromSessions(sessions: EveningResetSession[]) {
  const todayStr = new Date().toDateString();
  return sessions.some(
    (session) =>
      session.completed &&
      session.completedAt &&
      new Date(session.completedAt).toDateString() === todayStr
  );
}

export async function loadHomeDashboardData({
  displayName,
  previous,
}: LoadInput): Promise<HomeDashboardLoadResult> {
  const today = todayYMD();
  const {start, end} = currentWeekRange();
  const partialFailures: HomeOptionalSection[] = [];

  try {
    const [goalsRes, stepsRes, weekStepsRes, domainsRes] = await Promise.all([
      lifeCoachApi.listGoals(),
      lifeCoachApi.getDailySteps(today),
      lifeCoachApi.getDailyStepsRange(start, end),
      lifeCoachApi.listDomains(),
    ]);

    const [sessions, eveningSessions, coachContext, dailyFocusRes] = await Promise.all([
      loadOptionalSection(
        'rituals',
        () => fetchSessions({strict: true}),
        [] as MorningRitualSession[],
        partialFailures,
        previous?.ritualSessions
      ),
      loadOptionalSection(
        'evening',
        () => fetchEveningSessions({strict: true}),
        [] as EveningResetSession[],
        partialFailures,
        undefined
      ),
      loadOptionalSection(
        'coachContext',
        () => fetchFormulationCoachContext({strict: true}),
        EMPTY_COACH_CONTEXT,
        partialFailures,
        previous
          ? {
              challenge: previous.personalizedChallenge,
              load_adaptation: previous.loadAdaptation,
              comeback_messaging: previous.comebackMessaging,
              accountability: previous.accountability,
              behavior_change: previous.behaviorChange,
              skip_adaptation: previous.skipAdaptation,
            }
          : undefined
      ),
      loadOptionalSection(
        'dailyFocus',
        () => lifeCoachApi.getDailyFocus(today),
        {dailyFocus: null},
        partialFailures,
        previous ? {dailyFocus: previous.dailyFocus} : undefined
      ),
    ]);

    const weekSteps = weekStepsRes.steps;
    const weeklyDone = weekSteps.filter((step) => step.status === 'completed').length;
    const ritualFlags = partialFailures.includes('rituals') && previous
      ? {
          ritualStreak: previous.ritualStreak,
          hasTodayRitual: previous.hasTodayRitual,
        }
      : ritualFlagsFromSessions(sessions);
    const hasTodayEvening =
      partialFailures.includes('evening') && previous
        ? previous.hasTodayEvening
        : hasTodayEveningFromSessions(eveningSessions);

    return {
      ok: true,
      data: {
        goals: goalsRes.goals,
        todaySteps: stepsRes.steps,
        domainStates: domainsRes.states,
        ritualStreak: ritualFlags.ritualStreak,
        hasTodayRitual: ritualFlags.hasTodayRitual,
        hasTodayEvening,
        ritualSessions: sessions,
        weeklyDone,
        weeklyTotal: weekSteps.length,
        weeklyMinutes: sumWeeklyInvestedMinutes(weekSteps),
        weekSteps,
        displayName,
        personalizedChallenge: coachContext.challenge,
        loadAdaptation: coachContext.load_adaptation,
        comebackMessaging: coachContext.comeback_messaging,
        accountability: coachContext.accountability,
        behaviorChange: coachContext.behavior_change,
        skipAdaptation: coachContext.skip_adaptation,
        dailyFocus: dailyFocusRes.dailyFocus,
      },
      partialFailures,
    };
  } catch (error) {
    return {ok: false, failure: classifyLoadFailure(error)};
  }
}
