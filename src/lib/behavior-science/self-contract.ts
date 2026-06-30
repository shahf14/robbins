import type {GoalResponse} from '@/lib/life-coach/response-dtos';
import {
  DEFAULT_COMMITMENT_DAYS,
  resolveCommitmentDays,
  resolveCommitmentStart,
} from '@/lib/behavior-science/goal-commitment';

export type GoalSelfContract = {
  commitmentDays: number;
  createdAt: string;
};

/** @deprecated Prefer goal.commitment_days / commitment_started_at from the server. */
export function getGoalContract(goal: GoalResponse): GoalSelfContract {
  return {
    commitmentDays: resolveCommitmentDays(goal),
    createdAt: resolveCommitmentStart(goal),
  };
}
