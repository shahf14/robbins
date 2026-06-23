'use client';

import type {ReactNode} from 'react';
import {LocalAuthProvider} from '@/components/auth/local-auth-provider';
import {PwaConnectionStatus} from '@/components/pwa-connection-status';
import {ConfirmProvider} from './confirm-provider';
import {ToastProvider} from './toast-provider';

export function AppProviders({children}: {children: ReactNode}) {
  return (
    <ToastProvider>
      <ConfirmProvider>
        <LocalAuthProvider>
          <PwaConnectionStatus />
          {children}
        </LocalAuthProvider>
      </ConfirmProvider>
    </ToastProvider>
  );
}
