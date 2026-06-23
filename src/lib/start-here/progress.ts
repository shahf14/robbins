import type {StartMode} from './content';

const PATH_KEY = 'robbins_start_here_path_v1';
const MASTERY_KEY = 'robbins_start_here_mastery_v1';

type PathProgress = Partial<Record<StartMode, number[]>>;

function readPathProgress(): PathProgress {
  if (typeof window === 'undefined') return {};
  try {
    const raw = window.localStorage.getItem(PATH_KEY);
    return raw ? (JSON.parse(raw) as PathProgress) : {};
  } catch {
    return {};
  }
}

function writePathProgress(data: PathProgress) {
  window.localStorage.setItem(PATH_KEY, JSON.stringify(data));
}

export function getCompletedStepIndices(mode: StartMode): number[] {
  return readPathProgress()[mode] ?? [];
}

export function isStepCompleted(mode: StartMode, index: number): boolean {
  return getCompletedStepIndices(mode).includes(index);
}

export function togglePathStep(mode: StartMode, index: number, totalSteps: number): number[] {
  const current = getCompletedStepIndices(mode);
  const next = current.includes(index)
    ? current.filter((i) => i !== index)
    : [...current, index].filter((i) => i >= 0 && i < totalSteps).sort((a, b) => a - b);
  writePathProgress({...readPathProgress(), [mode]: next});
  return next;
}

export function markAllPathSteps(mode: StartMode, totalSteps: number): number[] {
  const all = Array.from({length: totalSteps}, (_, i) => i);
  writePathProgress({...readPathProgress(), [mode]: all});
  return all;
}

export function getPathProgressPercent(mode: StartMode, totalSteps: number): number {
  if (totalSteps <= 0) return 0;
  const done = getCompletedStepIndices(mode).length;
  return Math.round((done / totalSteps) * 100);
}

export function getMasteryChecked(): boolean[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(MASTERY_KEY);
    return raw ? (JSON.parse(raw) as boolean[]) : [];
  } catch {
    return [];
  }
}

export function toggleMasteryItem(index: number, total: number): boolean[] {
  const current = getMasteryChecked();
  const padded = Array.from({length: total}, (_, i) => current[i] ?? false);
  padded[index] = !padded[index];
  window.localStorage.setItem(MASTERY_KEY, JSON.stringify(padded));
  return padded;
}
