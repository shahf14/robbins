import {getLatestMorningRitualForUser} from '@/lib/db/repositories/morning-rituals';
import {parseMoodScore} from '@/lib/morning-ritual-adaptation/calibration';
import {requireCurrentUser} from '@/lib/auth/get-current-user';
import {listEveningResetSessions} from '@/lib/db/repositories/evening-reset';
import {
  buildMorningRitualYesterdayContext,
  dateFromIso,
  localDateStr,
  yesterdayIsoDate,
} from '@/lib/morning-ritual/yesterday-context';
import {buildEmotionalStageRouting} from '@/lib/formulation/emotional-stage-routing';
import {buildMeditationRecommendation} from '@/lib/formulation/meditation-routing';
import {buildMorningRitualGoalContext} from '@/lib/morning-ritual/goal-context';
import {
  getDailyReflectionForDate,
  getLatestCompletedFormulation,
  listDailyBabyStepsForDate,
  listGoals,
} from '@/lib/life-coach/repository';

export async function GET(request: Request) {
  const current = await requireCurrentUser(request);
  if (!current.ok) return current.response;

  const yesterday = yesterdayIsoDate();
  const today = localDateStr(new Date());

  try {
    const [steps, reflection, eveningSessions, goals, todayRitual, formulation] = await Promise.all([
      listDailyBabyStepsForDate(yesterday, current.user.id).catch(() => []),
      getDailyReflectionForDate(current.user.id, yesterday).catch(() => null),
      Promise.resolve(listEveningResetSessions(current.user.id, 21)),
      listGoals({status: 'active', userId: current.user.id}).catch(() => []),
      Promise.resolve(getLatestMorningRitualForUser(current.user.id, today)),
      getLatestCompletedFormulation(current.user.id).catch(() => null),
    ]);

    const eveningSession =
      eveningSessions.find(
        (session) =>
          session.completed &&
          session.completedAt &&
          dateFromIso(session.completedAt) === yesterday
      ) ?? null;

    const context = buildMorningRitualYesterdayContext({
      yesterdayDate: yesterday,
      steps,
      reflection,
      eveningSession,
    });

    context.active_goal_domain = goals[0]?.domain ?? null;
    context.today_energy =
      todayRitual?.energyScore ?? parseMoodScore(todayRitual?.moodBefore ?? null);
    context.today_mood_tag = todayRitual?.primaryTag ?? null;

    const goal_context = formulation
      ? buildMorningRitualGoalContext(formulation, context.today_energy)
      : null;

    const emotional_stage = formulation
      ? buildEmotionalStageRouting(formulation, formulation.locale)
      : null;

    const meditation_recommendation = formulation
      ? buildMeditationRecommendation(formulation, formulation.locale)
      : null;

    if (goal_context?.domain) {
      context.active_goal_domain = goal_context.domain;
    }

    return Response.json({context, goal_context, emotional_stage, meditation_recommendation});
  } catch {
    return Response.json({
      context: null,
      goal_context: null,
      emotional_stage: null,
      meditation_recommendation: null,
    });
  }
}
