'use client';

import type {ReactNode} from 'react';

/** Layout pass-through for life-coach routes; app-wide auth is handled elsewhere. */
export function LifeCoachPageShell({children}: {children: ReactNode}) {
  return <>{children}</>;
}
