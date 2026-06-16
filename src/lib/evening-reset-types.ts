export type EveningMode = 'quick' | 'standard' | 'deep';

export type EveningStep =
  | 'start'
  | 'mode-select'
  | 'mood-check'
  | 'win-review'
  | 'completion-review'
  | 'emotional-dump'
  | 'gratitude'
  | 'ai-insight'
  | 'tomorrows-win'
  | 'environment-design'
  | 'visualization'
  | 'complete';

export type GratitudeCategory = 'person' | 'moment' | 'achievement' | 'opportunity';

export type EveningResetSession = {
  id: string;
  mode: EveningMode;
  language: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number;
  completed: boolean;
  // Step data
  biggestWin: string;
  successFactors: string;
  blockers: string;
  emotionalDump: string;
  gratitudeItems: string[];
  gratitudeCategories: GratitudeCategory[];
  aiInsight: string;
  tomorrowsWin: string;
  preparedItems: string[];
  sleepTarget: string;
  /** 1–5 mood score from the mood-check step; ≤2 skips win-review */
  dayMood?: number;
  /** Structured briefing fed into tomorrow's daily steps AI */
  tomorrow_constraint?: string | null;
  what_worked?: string | null;
  what_failed?: string | null;
  energy_forecast?: 'low' | 'medium' | 'high' | null;
  /** True when evening reflection says tasks were too big/long */
  tasks_too_big?: boolean;
  /** One actionable sentence for tomorrow — shown on completion and fed to daily steps */
  tomorrow_takeaway?: string | null;
  // Scores
  readinessScore: number;
  // Raw metrics
  skippedSteps?: string[];
  // Psychological metrics
  emotionalDumpWordCount?: number;
  blockerMentioned?: boolean;
};

// mood-check is the first step in every mode — the flow branches from there
export const EVENING_STEPS_BY_MODE: Record<EveningMode, EveningStep[]> = {
  quick: ['mood-check', 'win-review', 'tomorrows-win', 'complete'],
  standard: ['mood-check', 'win-review', 'completion-review', 'emotional-dump', 'gratitude', 'tomorrows-win', 'complete'],
  deep: ['mood-check', 'win-review', 'completion-review', 'emotional-dump', 'gratitude', 'ai-insight', 'tomorrows-win', 'environment-design', 'visualization', 'complete'],
};

export const EVENING_MODE_MINUTES: Record<EveningMode, number> = {
  quick: 3,
  standard: 5,
  deep: 10,
};
