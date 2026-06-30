import type {DailyStepStatus} from './types';

const ALLOWED_TRANSITIONS: Record<DailyStepStatus, DailyStepStatus[]> = {
  pending: ['completed', 'skipped', 'partial'],
  completed: [],
  skipped: ['completed', 'partial'],
  partial: ['completed', 'skipped'],
};

export class InvalidDailyStepStatusTransitionError extends Error {
  constructor(
    readonly from: DailyStepStatus,
    readonly to: DailyStepStatus
  ) {
    super(`Invalid daily step status transition: ${from} → ${to}`);
    this.name = 'InvalidDailyStepStatusTransitionError';
  }
}

export function assertAllowedDailyStepStatusTransition(
  from: DailyStepStatus,
  to: DailyStepStatus
): void {
  if (from === to) return;
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    throw new InvalidDailyStepStatusTransitionError(from, to);
  }
}
