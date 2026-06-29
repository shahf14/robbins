'use client';

import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {getStoredLocalAuthToken} from '@/lib/auth/client-headers';
import type {LocalAuthContext} from '@/lib/auth/local-auth-context';
import {
  notifyLocalAuthReady,
  subscribeLocalAuthRequired,
} from '@/lib/auth/local-auth-events';
import {LocalAuthGate} from '@/components/auth/local-auth-gate';

type GatePhase = 'idle' | 'checking' | 'blocked';

async function fetchAuthContext(): Promise<LocalAuthContext> {
  const response = await fetch('/api/auth/context');
  if (!response.ok) {
    return {mode: 'local', openAccess: false};
  }
  const raw = (await response.json()) as unknown;
  if (
    raw !== null &&
    typeof raw === 'object' &&
    'mode' in raw &&
    (raw.mode === 'clerk' || raw.mode === 'local')
  ) {
    return raw as LocalAuthContext;
  }
  return {mode: 'local', openAccess: false};
}

async function hasValidSession(): Promise<boolean> {
  const token = getStoredLocalAuthToken();
  const response = await fetch('/api/auth/session', {
    headers: token ? {Authorization: `Bearer ${token}`} : {},
  });
  return response.ok;
}

export function LocalAuthProvider({children}: {children: ReactNode}) {
  const [phase, setPhase] = useState<GatePhase>('checking');
  const authContextRef = useRef<LocalAuthContext | null>(null);
  const localAuthRequiredRef = useRef(false);

  const evaluateAccess = useCallback(async (): Promise<boolean> => {
    const context = authContextRef.current ?? (await fetchAuthContext());
    authContextRef.current = context;

    if (context.mode === 'clerk' || (context.mode === 'local' && context.openAccess)) {
      localAuthRequiredRef.current = false;
      setPhase('idle');
      return true;
    }

    localAuthRequiredRef.current = true;
    const authenticated = await hasValidSession();
    setPhase(authenticated ? 'idle' : 'blocked');
    return authenticated;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function bootstrap() {
      setPhase('checking');
      try {
        await evaluateAccess();
      } catch {
        if (!cancelled) {
          localAuthRequiredRef.current = true;
          setPhase('blocked');
        }
      }
    }

    void bootstrap();

    return subscribeLocalAuthRequired(() => {
      if (!localAuthRequiredRef.current) return;
      setPhase('blocked');
    });
  }, [evaluateAccess]);

  const handleRetry = useCallback(() => {
    void evaluateAccess().then((authenticated) => {
      if (authenticated) {
        notifyLocalAuthReady();
      }
    });
  }, [evaluateAccess]);

  const showGate = phase === 'checking' || phase === 'blocked';

  return (
    <>
      {children}
      {showGate ? <LocalAuthGate checking={phase === 'checking'} onRetry={handleRetry} /> : null}
    </>
  );
}
