'use client';

import {useAuth} from '@clerk/nextjs';
import {useEffect, useRef} from 'react';
import {clearAdminSession} from '@/lib/auth/clear-admin-session';
import {clearStoredLocalAuthToken} from '@/lib/auth/local-auth-token-storage';

/**
 * Clears local-auth token and admin session when Clerk user signs out or switches accounts.
 */
export function AuthSessionCleanup() {
  const {userId, isLoaded} = useAuth();
  const previousUserId = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return;

    const previous = previousUserId.current;
    if (previous !== undefined && previous !== userId) {
      clearStoredLocalAuthToken();
      void clearAdminSession();
    }

    previousUserId.current = userId;
  }, [isLoaded, userId]);

  return null;
}
