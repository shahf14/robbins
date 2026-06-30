'use client';

import {useCallback, useEffect, useRef, useState, type ReactNode} from 'react';
import {getStoredLocalAuthToken} from '@/lib/auth/client-headers';
import type {LocalAuthContext} from '@/lib/auth/local-auth-context';
import {
  notifyLocalAuthReady,
  subscribeLocalAuthRequired,
} from '@/lib/auth/local-auth-events';
import {subscribeStoredLocalAuthToken} from '@/lib/auth/local-auth-token-storage';
import {LocalAuthGate} from '@/components/auth/local-auth-gate';

type GatePhase = 'idle' | 'checking' | 'blocked';

type AuthGateState = {
  phase: GatePhase;
  context: LocalAuthContext | null;
};

function isLocalAuthRequired(context: LocalAuthContext | null): boolean {
  return context?.mode === 'local' && !context.openAccess;
}

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
  const [auth, setAuth] = useState<AuthGateState>({phase: 'checking', context: null});
  const contextRef = useRef<LocalAuthContext | null>(null);

  const evaluateAccess = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    const context = contextRef.current ?? (await fetchAuthContext(signal));
    contextRef.current = context;

    if (context.mode === 'clerk' || (context.mode === 'local' && context.openAccess)) {
      setAuth({phase: 'idle', context});
      return true;
    }

    const authenticated = await hasValidSession(signal);
    setAuth({phase: authenticated ? 'idle' : 'blocked', context});
    return authenticated;
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function bootstrap() {
      setAuth((prev) => ({...prev, phase: 'checking'}));
      try {
        await evaluateAccess(controller.signal);
      } catch (err) {
        if (controller.signal.aborted) return;
        setAuth({
          phase: 'blocked',
          context: contextRef.current ?? {mode: 'local', openAccess: false},
        });
      }
    }

    void bootstrap();

    const unsubscribe = subscribeLocalAuthRequired(() => {
      setAuth((prev) => {
        if (!isLocalAuthRequired(contextRef.current ?? prev.context)) return prev;
        return {...prev, phase: 'blocked'};
      });
    });

    return () => {
      controller.abort();
      unsubscribe();
    };
  }, [evaluateAccess]);

  useEffect(() => {
    return subscribeStoredLocalAuthToken(() => {
      void evaluateAccess();
    });
  }, [evaluateAccess]);

  const handleRetry = useCallback(() => {
    void evaluateAccess(undefined).then((authenticated) => {
      if (authenticated) {
        notifyLocalAuthReady();
      }
    });
  }, [evaluateAccess]);

  const showGate = auth.phase === 'checking' || auth.phase === 'blocked';

  return (
    <>
      {children}
      {showGate ? <LocalAuthGate checking={auth.phase === 'checking'} onRetry={handleRetry} /> : null}
    </>
  );
}
