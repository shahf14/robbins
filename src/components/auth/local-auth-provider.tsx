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

async function fetchAuthContext(signal?: AbortSignal): Promise<LocalAuthContext> {
  const response = await fetch('/api/auth/context', {signal});
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

async function hasValidSession(signal?: AbortSignal): Promise<boolean> {
  const token = getStoredLocalAuthToken();
  const response = await fetch('/api/auth/session', {
    signal,
    headers: token ? {Authorization: `Bearer ${token}`} : {},
  });
  return response.ok;
}

export function LocalAuthProvider({children}: {children: ReactNode}) {
  const [phase, setPhase] = useState<GatePhase>('checking');
  const authContextRef = useRef<LocalAuthContext | null>(null);
  const localAuthRequiredRef = useRef(false);

  const evaluateAccess = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    const context = authContextRef.current ?? (await fetchAuthContext(signal));
    authContextRef.current = context;

    if (context.mode === 'clerk' || (context.mode === 'local' && context.openAccess)) {
      localAuthRequiredRef.current = false;
      setPhase('idle');
      return true;
    }

    localAuthRequiredRef.current = true;
    const authenticated = await hasValidSession(signal);
    setPhase(authenticated ? 'idle' : 'blocked');
    return authenticated;
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function bootstrap() {
      setPhase('checking');
      try {
        await evaluateAccess(controller.signal);
      } catch (err) {
        if (controller.signal.aborted) return;
        localAuthRequiredRef.current = true;
        setPhase('blocked');
      }
    }

    void bootstrap();

    const unsubscribe = subscribeLocalAuthRequired(() => {
      if (!localAuthRequiredRef.current) return;
      setPhase('blocked');
    });

    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [evaluateAccess]);

  const handleRetry = useCallback(() => {
    void evaluateAccess(undefined).then((authenticated) => {
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
