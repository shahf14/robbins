type ActionToast = {
  action: (message: string, actionLabel: string, onAction: () => void, durationMs?: number) => void;
};

type PendingCommit = {
  timer: number;
  commit: () => void;
};

const pendingByKey = new Map<string, PendingCommit>();

function flushPending(key: string) {
  const pending = pendingByKey.get(key);
  if (!pending) return;
  window.clearTimeout(pending.timer);
  pending.commit();
  pendingByKey.delete(key);
}

/** Commit a destructive ritual edit after a short window; undo restores UI before persistence. */
export type RitualListPersistMode = 'immediate' | 'deferred';

export function scheduleDeferredRitualCommit({
  key,
  commit,
  undo,
  toast,
  message,
  undoLabel,
  delayMs = 5000,
}: {
  key: string;
  commit: () => void;
  undo: () => void;
  toast: ActionToast;
  message: string;
  undoLabel: string;
  delayMs?: number;
}) {
  flushPending(key);

  const timer = window.setTimeout(() => {
    commit();
    pendingByKey.delete(key);
  }, delayMs);

  pendingByKey.set(key, {timer, commit});

  toast.action(message, undoLabel, () => {
    const pending = pendingByKey.get(key);
    if (pending) {
      window.clearTimeout(pending.timer);
      pendingByKey.delete(key);
    }
    undo();
  }, delayMs);
}
