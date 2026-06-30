import {addDaysYMD, dateToYMD, daysBetweenYMD} from '@/lib/date-utils';
import type {GoalResponse} from '@/lib/life-coach/response-dtos';

export const DEFAULT_COMMITMENT_DAYS = 30;

export function resolveCommitmentStart(goal: GoalResponse): string {
  const raw = goal.commitment_started_at?.slice(0, 10);
  if (raw) return raw;
  return goal.created_at.slice(0, 10);
}

export function resolveCommitmentDays(goal: GoalResponse): number {
  return goal.commitment_days ?? DEFAULT_COMMITMENT_DAYS;
}

export function getCommitmentEndDate(startYmd: string, days: number): string {
  return addDaysYMD(startYmd, Math.max(days, 1) - 1);
}

function getCommitmentDayNumber(startYmd: string, todayYmd = dateToYMD(new Date())): number {
  if (todayYmd < startYmd) return 0;
  return daysBetweenYMD(startYmd, todayYmd) + 1;
}

export function isWithinCommitment(goal: GoalResponse, todayYmd = dateToYMD(new Date())): boolean {
  if (goal.status !== 'active') return false;
  const start = resolveCommitmentStart(goal);
  const end = getCommitmentEndDate(start, resolveCommitmentDays(goal));
  return todayYmd >= start && todayYmd <= end;
}

export function isCommitmentEnded(goal: GoalResponse, todayYmd = dateToYMD(new Date())): boolean {
  if (goal.status !== 'active') return false;
  const start = resolveCommitmentStart(goal);
  const end = getCommitmentEndDate(start, resolveCommitmentDays(goal));
  return todayYmd > end;
}

export function commitmentProgress(goal: GoalResponse, todayYmd = dateToYMD(new Date())) {
  const start = resolveCommitmentStart(goal);
  const days = resolveCommitmentDays(goal);
  const end = getCommitmentEndDate(start, days);
  const currentDay = getCommitmentDayNumber(start, todayYmd);
  return {start, end, days, currentDay: Math.min(currentDay, days)};
}
