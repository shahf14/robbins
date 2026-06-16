const STORAGE_KEY = 'robbins_home_how_it_works_collapsed';

export function isHomeHowItWorksCollapsed(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(STORAGE_KEY) === '1';
  } catch {
    return false;
  }
}

export function collapseHomeHowItWorks(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, '1');
  } catch {
    /* ignore */
  }
}

export function isHomeHowItWorksFirstUseComplete(input: {
  ritualCount: number;
  weeklyStepsDone: number;
  hasEveningToday: boolean;
}): boolean {
  if (input.ritualCount === 0) return false;
  return input.weeklyStepsDone > 0 || input.hasEveningToday;
}
