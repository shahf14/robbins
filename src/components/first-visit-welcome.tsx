'use client';

import {useEffect} from 'react';
import {useRouter} from '@/i18n/navigation';
import {
  applyServerOnboardingStatus,
  fetchServerOnboardingStatus,
  isOnboardingComplete,
} from '@/lib/onboarding-state';

/**
 * Detects first-time visitors and redirects them to the onboarding wizard.
 * Renders nothing — the redirect itself is the UX.
 */
export function FirstVisitWelcome() {
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;

    async function gate() {
      const serverStatus = await fetchServerOnboardingStatus();
      if (cancelled) return;

      if (serverStatus?.complete && serverStatus.completedAt) {
        applyServerOnboardingStatus(serverStatus);
        return;
      }

      if (!isOnboardingComplete() || (serverStatus && !serverStatus.complete)) {
        router.replace('/onboarding');
      }
    }

    void gate();
    return () => {
      cancelled = true;
    };
  }, [router]);

  return null;
}
