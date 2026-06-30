'use client';

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

type ToastTone = 'success' | 'error' | 'info';

type ToastItem = {
  id: string;
  message: string;
  tone: ToastTone;
  actionLabel?: string;
  onAction?: () => void;
};

type ToastContextValue = {
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
  clearErrors: () => void;
  action: (message: string, actionLabel: string, onAction: () => void, durationMs?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_STYLES: Record<ToastTone, string> = {
  success: 'border-emerald-400/30 bg-emerald-500/15 text-emerald-100',
  error: 'border-red-400/30 bg-red-500/15 text-red-100',
  info: 'border-[var(--blue)]/30 bg-[var(--blue)]/10 txt-strong',
};

export function ToastProvider({children}: {children: ReactNode}) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const timeoutIdsRef = useRef<number[]>([]);

  useEffect(() => {
    const timeoutIds = timeoutIdsRef.current;
    return () => {
      timeoutIds.forEach((id) => window.clearTimeout(id));
    };
  }, []);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const push = useCallback((message: string, tone: ToastTone, durationMs = 4200) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, {id, message, tone}]);
    const timeoutId = window.setTimeout(() => {
      dismiss(id);
      timeoutIdsRef.current = timeoutIdsRef.current.filter((item) => item !== timeoutId);
    }, durationMs);
    timeoutIdsRef.current.push(timeoutId);
  }, [dismiss]);

  const action = useCallback(
    (message: string, actionLabel: string, onAction: () => void, durationMs = 5000) => {
      const id = crypto.randomUUID();
      setToasts((prev) => [
        ...prev,
        {id, message, tone: 'info', actionLabel, onAction},
      ]);
      const timeoutId = window.setTimeout(() => {
        dismiss(id);
        timeoutIdsRef.current = timeoutIdsRef.current.filter((item) => item !== timeoutId);
      }, durationMs);
      timeoutIdsRef.current.push(timeoutId);
    },
    [dismiss]
  );

  const clearErrors = useCallback(() => {
    setToasts((prev) => prev.filter((item) => item.tone !== 'error'));
  }, []);

  const value = useMemo<ToastContextValue>(
    () => ({
      success: (message) => push(message, 'success'),
      error: (message) => push(message, 'error', 5200),
      info: (message) => push(message, 'info'),
      clearErrors,
      action,
    }),
    [push, action, clearErrors]
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed inset-x-4 bottom-20 z-[100] flex flex-col gap-2 sm:inset-x-auto sm:bottom-6 sm:end-4 sm:w-[min(24rem,calc(100vw-2rem))]"
        aria-live="polite"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role={toast.tone === 'error' ? 'alert' : 'status'}
            className={`pointer-events-auto flex items-center justify-between gap-3 animate-fade-in rounded-2xl border px-4 py-3 text-sm font-semibold shadow-lg backdrop-blur-md ${TONE_STYLES[toast.tone]}`}
          >
            <span>{toast.message}</span>
            {toast.actionLabel && toast.onAction ? (
              <button
                type="button"
                className="focus-ring shrink-0 rounded-lg border border-current/25 px-2.5 py-1 text-xs font-bold uppercase tracking-wide"
                onClick={() => {
                  toast.onAction?.();
                  dismiss(toast.id);
                }}
              >
                {toast.actionLabel}
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
