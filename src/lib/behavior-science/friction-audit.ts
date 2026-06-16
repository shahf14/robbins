import type {DailyBabyStep, ReflectionBlockerReason} from '@/lib/life-coach/types';
import {parseJsonArrayOr} from '@/lib/safe-json';

const STORAGE_KEY = 'robbins_friction_skips';

type SkipRecord = {
  signature: string;
  blocker: ReflectionBlockerReason | null;
  at: string;
};

function stepSignature(step: DailyBabyStep): string {
  return `${step.domain}:${step.difficulty}:${step.estimated_minutes}`;
}

function loadRecords(): SkipRecord[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return parseJsonArrayOr<SkipRecord>(raw);
  } catch {
    return [];
  }
}

function saveRecords(records: SkipRecord[]) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(records.slice(-40)));
  } catch {
    /* ignore */
  }
}

export function recordStepSkip(step: DailyBabyStep, blocker: ReflectionBlockerReason | null) {
  const records = loadRecords();
  records.push({
    signature: stepSignature(step),
    blocker,
    at: new Date().toISOString(),
  });
  saveRecords(records);
}

export type FrictionDiagnosis = 'too_big' | 'wrong_time' | 'unclear';

export function diagnoseFriction(step: DailyBabyStep): FrictionDiagnosis | null {
  const sig = stepSignature(step);
  const matches = loadRecords().filter((r) => r.signature === sig);
  if (matches.length < 2) return null;

  const blockers = matches.map((m) => m.blocker).filter(Boolean);
  if (blockers.includes('no_time') || blockers.includes('family_chaos')) return 'wrong_time';
  if (blockers.includes('unclear_task')) return 'unclear';
  if (step.estimated_minutes > 10 || step.difficulty === 'hard') return 'too_big';
  return 'too_big';
}
