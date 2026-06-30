import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';

type Snapshot = {date: string; steps: DailyBabyStepResponse[]};

let snapshot: Snapshot | null = null;
const listeners = new Set<() => void>();

function notify() {
  for (const listener of listeners) {
    listener();
  }
}

export function readTodayStepsSnapshot(date: string): DailyBabyStepResponse[] | null {
  if (snapshot?.date === date) return snapshot.steps;
  return null;
}

export function writeTodayStepsSnapshot(date: string, steps: DailyBabyStepResponse[]) {
  snapshot = {date, steps};
  notify();
}

export function applyTodayStepUpdate(step: DailyBabyStepResponse) {
  if (!snapshot) return;

  const idx = snapshot.steps.findIndex((item) => item.id === step.id);
  if (step.scheduled_date !== snapshot.date) {
    if (idx >= 0) {
      snapshot = {...snapshot, steps: snapshot.steps.filter((item) => item.id !== step.id)};
      notify();
    }
    return;
  }

  if (idx >= 0) {
    const steps = [...snapshot.steps];
    steps[idx] = step;
    snapshot = {...snapshot, steps};
  } else {
    snapshot = {...snapshot, steps: [...snapshot.steps, step]};
  }
  notify();
}

export function removeTodayStepFromSnapshot(id: string) {
  if (!snapshot) return;
  snapshot = {...snapshot, steps: snapshot.steps.filter((item) => item.id !== id)};
  notify();
}

export function invalidateTodayStepsSnapshot() {
  snapshot = null;
  notify();
}

export function subscribeTodayStepsSnapshot(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
