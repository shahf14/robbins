import {releaseOperationLock, tryAcquireOperationLock} from './operation-lock';

export function tryAcquireCronLock(job: string, lockTtlMs: number): boolean {
  return tryAcquireOperationLock(`cron:${job}`, lockTtlMs);
}

export function releaseCronLock(job: string): void {
  releaseOperationLock(`cron:${job}`);
}
