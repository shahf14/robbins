import {releaseOperationLock, tryAcquireOperationLock} from '@/lib/db/operation-lock';
import type {LifeDomain} from './types';

const DAILY_STEPS_GENERATION_LOCK_TTL_MS = 20 * 60 * 1000;

export class DailyStepsGenerationLockedError extends Error {
  constructor() {
    super('Daily steps generation already in progress for this user and date.');
    this.name = 'DailyStepsGenerationLockedError';
  }
}

function dailyStepsGenerationLockKey(
  userId: string,
  date: string,
  domainScope?: LifeDomain
): string {
  return `daily-steps:${userId}:${date}:${domainScope ?? '*'}`;
}

export function tryAcquireDailyStepsGenerationLock(
  userId: string,
  date: string,
  domainScope?: LifeDomain
): boolean {
  return tryAcquireOperationLock(
    dailyStepsGenerationLockKey(userId, date, domainScope),
    DAILY_STEPS_GENERATION_LOCK_TTL_MS
  );
}

export function releaseDailyStepsGenerationLock(
  userId: string,
  date: string,
  domainScope?: LifeDomain
): void {
  releaseOperationLock(dailyStepsGenerationLockKey(userId, date, domainScope));
}
