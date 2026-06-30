import type {PersonalDifficultyCalibration} from '@/lib/life-coach/personal-difficulty-calibration';
import type {DailyBabyStepResponse} from '@/lib/life-coach/response-dtos';
import type {PreferredActionWindow} from '@/lib/user-preferences';
import type {UserBehaviorProfile, WeekdaySkipPattern, WindowSkipPattern} from './types';

const MIN_WINDOW_SAMPLE = 3;
const MIN_WEEKDAY_SAMPLE = 2;
const AVOID_SKIP_RATE = 0.5;
const BEST_COMPLETION_RATE = 0.55;

export function hourToActionWindow(hour: number): PreferredActionWindow {
  if (hour >= 5 && hour < 11) return 'morning';
  if (hour >= 11 && hour < 17) return 'midday';
  if (hour >= 17 && hour < 22) return 'evening';
  return 'flexible';
}

function isTerminal(step: DailyBabyStepResponse): boolean {
  return step.status === 'completed' || step.status === 'partial' || step.status === 'skipped';
}

function stepActionTimestamp(step: DailyBabyStepResponse): string | null {
  if (step.status === 'completed' || step.status === 'partial') {
    return step.completed_at ?? null;
  }
  if (step.status === 'skipped') {
    return step.completed_at ?? step.created_at ?? null;
  }
  return null;
}

export function stepActionWindow(step: DailyBabyStepResponse): PreferredActionWindow | null {
  if (!isTerminal(step)) return null;
  const ts = stepActionTimestamp(step);
  if (!ts) return null;
  return hourToActionWindow(new Date(ts).getHours());
}

function weekdayFromDate(date: string): number {
  return new Date(`${date}T12:00:00`).getDay();
}

function rate(skipped: number, completed: number): {skip_rate: number; completion_rate: number} {
  const total = skipped + completed;
  if (total === 0) return {skip_rate: 0, completion_rate: 0};
  return {
    skip_rate: Math.round((skipped / total) * 100) / 100,
    completion_rate: Math.round((completed / total) * 100) / 100,
  };
}

function computeWindowPatterns(steps: DailyBabyStepResponse[]): WindowSkipPattern[] {
  const stats = new Map<
    PreferredActionWindow,
    {skipped: number; completed: number}
  >();

  for (const step of steps) {
    if (!isTerminal(step)) continue;
    const window = stepActionWindow(step);
    if (!window || window === 'flexible') continue;

    const row = stats.get(window) ?? {skipped: 0, completed: 0};
    if (step.status === 'skipped') row.skipped += 1;
    else row.completed += 1;
    stats.set(window, row);
  }

  return [...stats.entries()].map(([window, row]) => {
    const rates = rate(row.skipped, row.completed);
    return {
      window,
      skip_rate: rates.skip_rate,
      completion_rate: rates.completion_rate,
      sample_size: row.skipped + row.completed,
    };
  });
}

function computeWeekdayPatterns(steps: DailyBabyStepResponse[]): WeekdaySkipPattern[] {
  const stats = new Map<number, {skipped: number; completed: number}>();

  for (const step of steps) {
    if (!isTerminal(step)) continue;
    const weekday = weekdayFromDate(step.scheduled_date);
    const row = stats.get(weekday) ?? {skipped: 0, completed: 0};
    if (step.status === 'skipped') row.skipped += 1;
    else row.completed += 1;
    stats.set(weekday, row);
  }

  return [...stats.entries()].map(([weekday, row]) => {
    const rates = rate(row.skipped, row.completed);
    return {
      weekday,
      skip_rate: rates.skip_rate,
      completion_rate: rates.completion_rate,
      sample_size: row.skipped + row.completed,
    };
  });
}

function deriveAvoidAndBestWindows(input: {
  windowPatterns: WindowSkipPattern[];
  weekdayPatterns: WeekdaySkipPattern[];
}): {
  avoid_windows: PreferredActionWindow[];
  best_windows: PreferredActionWindow[];
} {
  const avoid = input.windowPatterns
    .filter((p) => p.sample_size >= MIN_WINDOW_SAMPLE && p.skip_rate >= AVOID_SKIP_RATE)
    .sort((a, b) => b.skip_rate - a.skip_rate)
    .map((p) => p.window);

  const avoidSet = new Set(avoid);
  const best = input.windowPatterns
    .filter(
      (p) =>
        p.sample_size >= MIN_WINDOW_SAMPLE &&
        p.completion_rate >= BEST_COMPLETION_RATE &&
        !avoidSet.has(p.window)
    )
    .sort((a, b) => b.completion_rate - a.completion_rate)
    .map((p) => p.window);

  if (best.length === 0) {
    const fallback = input.windowPatterns
      .filter((p) => p.sample_size >= MIN_WINDOW_SAMPLE && !avoidSet.has(p.window))
      .sort((a, b) => b.completion_rate - a.completion_rate)[0];
    if (fallback) best.push(fallback.window);
  }

  return {
    avoid_windows: [...new Set(avoid)],
    best_windows: [...new Set(best)].slice(0, 2),
  };
}

export function computeSkipWindowPatterns(steps: DailyBabyStepResponse[]): {
  avoid_windows: PreferredActionWindow[];
  best_windows: PreferredActionWindow[];
  window_patterns: WindowSkipPattern[];
  weekday_patterns: WeekdaySkipPattern[];
} {
  const window_patterns = computeWindowPatterns(steps);
  const weekday_patterns = computeWeekdayPatterns(steps).filter(
    (p) => p.sample_size >= MIN_WEEKDAY_SAMPLE
  );
  const {avoid_windows, best_windows} = deriveAvoidAndBestWindows({
    windowPatterns: window_patterns,
    weekdayPatterns: weekday_patterns,
  });

  return {avoid_windows, best_windows, window_patterns, weekday_patterns};
}

export const SKIP_WINDOWS_PROMPT_BLOCK =
  'When user_behavior_profile includes avoid_windows or best_windows, honor them for scheduling. ' +
  'Avoid scheduling demanding tasks in avoid_windows — use easy wind-down steps there at most. ' +
  'Place medium/hard steps in best_windows. ' +
  'If weekday_patterns show high skip_rate on certain weekdays, shrink or simplify steps on those days.';

/** Shift scheduling away from windows where the user often skips. */
export function resolveSchedulingActionWindow(
  behaviorProfile: UserBehaviorProfile,
  preferredWindow: PreferredActionWindow
): PreferredActionWindow {
  if (behaviorProfile.avoid_windows.length === 0) return preferredWindow;

  if (
    behaviorProfile.avoid_windows.includes(preferredWindow) &&
    behaviorProfile.best_windows.length > 0
  ) {
    return behaviorProfile.best_windows[0];
  }

  if (preferredWindow === 'flexible' && behaviorProfile.best_windows.length > 0) {
    return behaviorProfile.best_windows[0];
  }

  return preferredWindow;
}

export function applySkipWindowsToCalibration(
  calibration: PersonalDifficultyCalibration,
  behaviorProfile: UserBehaviorProfile
): PersonalDifficultyCalibration {
  if (!behaviorProfile.avoid_windows.includes('evening')) return calibration;

  const ceiling =
    calibration.difficulty_ceiling === 'hard' ? 'medium' : calibration.difficulty_ceiling;

  return {
    ...calibration,
    difficulty_ceiling: ceiling,
    target_minutes: Math.min(calibration.target_minutes, 8),
    max_minutes: Math.min(calibration.max_minutes, 10),
    ramp_mode: 'reduce',
  };
}
