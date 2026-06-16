import {hadMissedYesterday} from '@/lib/behavior-science/never-miss-twice';
import {getUserBehaviorProfile} from '@/lib/behavior-profile/repository';
import {dateDaysAgo, listStepsSince} from '@/lib/coach-memory/data';
import {dbAll, dbGet} from '@/lib/db/sqlite';
import {pickStartHereStep} from '@/lib/life-coach/step-priority';
import {
  computeStepFit,
  deriveFitContextFromSteps,
} from '@/lib/life-coach/step-fit-score';
import type {DailyBabyStep} from '@/lib/life-coach/types';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import type {
  BlockerRiskLevel,
  DailyCoachMessageInputs,
  EnergyTrend,
  YesterdayStatus,
} from './types';

function yesterdayYmd(date: string): string {
  return dateDaysAgo(1, new Date(`${date}T12:00:00`));
}

function deriveEnergyTrend(scores: number[]): EnergyTrend {
  if (scores.length < 2) return 'flat';
  const recent = scores.slice(0, 3);
  const avg = recent.reduce((sum, value) => sum + value, 0) / recent.length;
  const latest = scores[0];
  if (latest > avg + 0.5) return 'up';
  if (latest < avg - 0.5) return 'down';
  return 'flat';
}

function deriveYesterdayStatus(
  weekSteps: DailyBabyStep[],
  date: string
): YesterdayStatus {
  const yday = yesterdayYmd(date);
  const daySteps = weekSteps.filter((s) => s.scheduled_date === yday);
  if (daySteps.length === 0) return 'none';
  const completed = daySteps.filter(
    (s) => s.status === 'completed' || s.status === 'partial'
  ).length;
  const skipped = daySteps.filter((s) => s.status === 'skipped').length;
  if (completed === 0 && skipped > 0) return 'missed';
  if (completed > 0 && skipped === 0) return 'strong';
  return 'mixed';
}

function blockerRiskLevel(score: number): BlockerRiskLevel {
  if (score >= 60) return 'high';
  if (score >= 35) return 'medium';
  return 'low';
}

function energyFromMorningRitualJson(sessionJson: string | null): number | null {
  if (!sessionJson) return null;
  try {
    const session = JSON.parse(sessionJson) as {
      energyScore?: number | null;
      moodBefore?: string | null;
    };
    const score = session.energyScore ?? (session.moodBefore ? Number(session.moodBefore) : null);
    if (score == null || !Number.isFinite(score) || score < 1 || score > 10) return null;
    return Math.round(score);
  } catch {
    return null;
  }
}

function energyOnDate(userId: string, date: string): number | null {
  const row = dbGet<{session_json: string | null}>(
    `SELECT session_json FROM morning_rituals
     WHERE user_id = ? AND date = ? AND completed = 1
     ORDER BY created_at DESC LIMIT 1`,
    [userId, date]
  );
  return energyFromMorningRitualJson(row?.session_json ?? null);
}

function listRecentEnergyScores(userId: string, since: string): number[] {
  const rows = dbAll<{session_json: string | null}>(
    `SELECT session_json FROM morning_rituals
     WHERE user_id = ? AND date >= ? AND completed = 1
     ORDER BY date DESC LIMIT 7`,
    [userId, since]
  );
  return rows
    .map((row) => energyFromMorningRitualJson(row.session_json))
    .filter((value): value is number => value != null);
}

export function gatherDailyCoachMessageInputs(
  userId: string,
  date: string,
  schedule: {
    wake_time: string;
    sleep_time: string;
    preferred_action_window: PreferredActionWindow;
  }
): DailyCoachMessageInputs {
  const sinceWeek = dateDaysAgo(6, new Date(`${date}T12:00:00`));
  const weekSteps = listStepsSince(userId, sinceWeek);
  const todaySteps = weekSteps.filter((s) => s.scheduled_date === date);
  const pendingToday = todaySteps.filter((s) => s.status === 'pending');
  const energyScores = listRecentEnergyScores(userId, sinceWeek);
  const latestEnergy = energyScores[0] ?? null;
  const yesterdayEnergy = energyOnDate(userId, yesterdayYmd(date));
  const behaviorProfile = getUserBehaviorProfile(userId);
  const fitWeek = deriveFitContextFromSteps(weekSteps);

  const primaryStep = pickStartHereStep(
    pendingToday,
    latestEnergy,
    schedule,
    weekSteps
  );

  let blockerRiskScore = 25;
  if (primaryStep) {
    blockerRiskScore = computeStepFit(primaryStep, {
      energy: latestEnergy,
      avgActualMinutes: fitWeek.avgActualMinutes,
      commonBlockers: behaviorProfile.common_blockers.length
        ? behaviorProfile.common_blockers
        : fitWeek.commonBlockers,
      preferredDomains: behaviorProfile.preferred_domains.length
        ? behaviorProfile.preferred_domains
        : fitWeek.preferredDomains,
      wakeTime: schedule.wake_time,
      sleepTime: schedule.sleep_time,
      preferredActionWindow: schedule.preferred_action_window,
    }).blocker_risk;
  }

  const missedYesterday = hadMissedYesterday(weekSteps, date);
  const yesterdayStatus = missedYesterday
    ? 'missed'
    : deriveYesterdayStatus(weekSteps, date);

  return {
    date,
    energy_trend: deriveEnergyTrend(energyScores),
    latest_energy: latestEnergy,
    yesterday_energy: yesterdayEnergy,
    yesterday_status: yesterdayStatus,
    today_step_count: todaySteps.length,
    pending_today: pendingToday.length,
    blocker_risk: blockerRiskLevel(blockerRiskScore),
    blocker_risk_score: blockerRiskScore,
    primary_step_id: primaryStep?.id ?? null,
    primary_step_minutes: primaryStep?.estimated_minutes ?? null,
  };
}
