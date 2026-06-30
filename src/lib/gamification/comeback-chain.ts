import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';
import {parseJsonOr} from '@/lib/safe-json';

const STORAGE_KEY = 'robbins_comeback_chain';

type ComebackState = {
  chain: number;
  lastComebackDate: string | null;
};

function groupStepsByDate(steps: DailyBabyStepResponse[]): Map<string, DailyBabyStepResponse[]> {
  const map = new Map<string, DailyBabyStepResponse[]>();
  for (const step of steps) {
    const list = map.get(step.scheduled_date) ?? [];
    list.push(step);
    map.set(step.scheduled_date, list);
  }
  return map;
}

function wasHardDay(daySteps: DailyBabyStepResponse[]): boolean {
  if (daySteps.length === 0) return false;
  const completed = daySteps.filter((s) => s.status === 'completed').length;
  const struggled = daySteps.filter(
    (s) => s.status === 'skipped' || s.status === 'partial'
  ).length;
  return completed === 0 && struggled > 0;
}

function hadComeback(daySteps: DailyBabyStepResponse[]): boolean {
  return daySteps.some((s) => s.status === 'completed');
}

function loadState(): ComebackState {
  if (typeof window === 'undefined') return {chain: 0, lastComebackDate: null};
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return {chain: 0, lastComebackDate: null};
    return parseJsonOr<ComebackState>(raw, {chain: 0, lastComebackDate: null});
  } catch {
    return {chain: 0, lastComebackDate: null};
  }
}

function saveState(state: ComebackState) {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* ignore */
  }
}

/** Count consecutive comeback days ending today. */
export function computeComebackChain(
  weekSteps: DailyBabyStepResponse[],
  today: string
): number {
  const byDate = groupStepsByDate(weekSteps);
  const todaySteps = byDate.get(today) ?? [];

  if (!hadComeback(todaySteps)) {
    return loadState().lastComebackDate === today ? loadState().chain : 0;
  }

  const dates = [...byDate.keys()].sort();
  const todayIdx = dates.indexOf(today);
  let chain = 0;

  if (todayIdx <= 0) {
    chain = 1;
  } else {
    const prevDate = dates[todayIdx - 1];
    const prevSteps = byDate.get(prevDate) ?? [];
    if (wasHardDay(prevSteps)) {
      chain = loadState().chain > 0 ? loadState().chain + 1 : 1;
    } else {
      chain = 1;
    }
  }

  const state = loadState();
  if (state.lastComebackDate !== today) {
    saveState({chain, lastComebackDate: today});
  }

  return chain;
}
