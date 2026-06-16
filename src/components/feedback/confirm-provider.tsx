'use client';

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {useTranslations} from 'next-intl';

export type ConfirmOptions = {
  title?: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  destructive?: boolean;
};

type ConfirmContextValue = {
  confirm: (options: ConfirmOptions) => Promise<boolean>;
};

const ConfirmContext = createContext<ConfirmContextValue | null>(null);

type PendingConfirm = ConfirmOptions & {open: boolean};

export function ConfirmProvider({children}: {children: ReactNode}) {
  const t = useTranslations('feedback');
  const resolverRef = useRef<((value: boolean) => void) | null>(null);
  const [pending, setPending] = useState<PendingConfirm | null>(null);

  const close = useCallback((result: boolean) => {
    resolverRef.current?.(result);
    resolverRef.current = null;
    setPending(null);
  }, []);

  const confirm = useCallback((options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve;
      setPending({...options, open: true});
    });
  }, []);

  const value = useMemo(() => ({confirm}), [confirm]);

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {pending?.open && (
        <div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/70 p-4 sm:items-center"
          role="presentation"
          onClick={() => close(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            aria-describedby="confirm-dialog-message"
            className="panel-surface-strong w-full max-w-md rounded-[24px] p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-dialog-title" className={`text-xl font-black text-white ${pending.title ? '' : 'sr-only'}`}>
              {pending.title ?? pending.message}
            </h2>
            <p id="confirm-dialog-message" className={`text-sm leading-7 text-[var(--muted)] ${pending.title ? 'mt-3' : ''}`}>
              {pending.message}
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="focus-ring btn-ghost"
                onClick={() => close(false)}
              >
                {pending.cancelLabel ?? t('confirmCancel')}
              </button>
              <button
                type="button"
                className={`focus-ring ${pending.destructive ? 'rounded-2xl border border-red-500/40 bg-red-500/15 px-5 py-2.5 text-sm font-bold text-red-200' : 'btn-primary'}`}
                onClick={() => close(true)}
              >
                {pending.confirmLabel ?? (pending.destructive ? t('confirmDelete') : t('confirmOk'))}
              </button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  );
}

export function useConfirm(): ConfirmContextValue {
  const ctx = useContext(ConfirmContext);
  if (!ctx) {
    throw new Error('useConfirm must be used within ConfirmProvider');
  }
  return ctx;
}
