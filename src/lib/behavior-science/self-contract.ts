import type {Goal} from '@/lib/life-coach/types';
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
export function getGoalContract(goal: Goal): GoalSelfContract {
  return {
    commitmentDays: resolveCommitmentDays(goal),
    createdAt: resolveCommitmentStart(goal),
  };
}
