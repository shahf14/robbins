'use client';

import type {ReactNode} from 'react';
import {ConfirmProvider} from './confirm-provider';
import {ToastProvider} from './toast-provider';

export function AppProviders({children}: {children: ReactNode}) {
  return (
    <ToastProvider>
      <ConfirmProvider>{children}</ConfirmProvider>
    </ToastProvider>
  );
}
