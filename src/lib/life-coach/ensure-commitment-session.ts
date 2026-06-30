import {lifeCoachApi} from '@/lib/life-coach/api-client';

let ensurePromise: Promise<void> | null = null;

/** Call POST ensure-commitment once per browser session (deduped in-flight). */
export function ensureCommitmentStepsOnSession(): Promise<void> {
  if (typeof window === 'undefined') {
    return Promise.resolve();
  }

  if (sessionStorage.getItem('lc_commitment_steps_ensured') === '1') {
    return Promise.resolve();
  }

  if (!ensurePromise) {
    ensurePromise = lifeCoachApi
      .ensureCommitmentSteps()
      .then(() => {
        sessionStorage.setItem('lc_commitment_steps_ensured', '1');
      })
      .catch((error) => {
        ensurePromise = null;
        throw error;
      });
  }

  return ensurePromise;
}

/** Test helper — reset dedupe state between cases. */
export function resetCommitmentSessionEnsureForTests(): void {
  ensurePromise = null;
  if (typeof sessionStorage !== 'undefined') {
    sessionStorage.removeItem('lc_commitment_steps_ensured');
  }
}
