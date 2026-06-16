'use client';

/**
 * Auth shell for local-only mode.
 * Renders children directly.
 */
export function LifeCoachAuthShell({
  children
}: {
  children: (context?: unknown) => React.ReactNode;
}) {
  return <>{children()}</>;
}
