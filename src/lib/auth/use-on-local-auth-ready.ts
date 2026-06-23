'use client';

import {useEffect} from 'react';
import {subscribeLocalAuthReady} from '@/lib/auth/local-auth-events';

export function useOnLocalAuthReady(callback: () => void): void {
  useEffect(() => subscribeLocalAuthReady(callback), [callback]);
}
