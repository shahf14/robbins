'use client';

import {useEffect} from 'react';
import {
  applyServerOnboardingStatus,
  fetchServerOnboardingStatus,
} from '@/lib/onboarding-state';

/**
 * Keeps local onboarding state in sync with the server.
 * First-time users now start inside the app and choose a small daily action there.
 */
export function FirstVisitWelcome() {
  useEffect(() => {
    let cancelled = false;

    async function gate() {
      const serverStatus = await fetchServerOnboardingStatus();
      if (cancelled) return;

      // A non-null result means the server answered authoritatively — reconcile
      // local state in both directions (complete → set, incomplete → clear).
      if (serverStatus) {
        applyServerOnboardingStatus(serverStatus);
      }
    }

    void gate();
    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
