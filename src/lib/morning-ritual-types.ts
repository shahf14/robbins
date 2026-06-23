import type {CheckInTag} from './check-in-types';
import type {LifeContextStatus} from './life-coach/types';

export type RitualMode = 'quick' | 'standard' | 'deep';

export type RitualStep =
  | 'start'
  | 'mode-select'
  | 'breathing'
  | 'gratitude'
  | 'affirmation'
  | 'visualization'
  | 'identity'
  | 'mission'
  | 'complete';

export type BreathingType = 'default' | 'energy' | 'calm';

export type AffirmationType = 'text' | 'youtube';

export type TimeBlock = 'morning' | 'afternoon' | 'evening' | 'now';

export type MorningRitualSession = {
  id: string;
  mode: RitualMode;
  language: string;
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number;
  completed: boolean;
  breathingCompleted: boolean;
  breathingType: BreathingType;
  gratitudeEntries: string[];
  selectedAffirmationId: string | null;
  identityText: string;
  dailyMission: string;
  missionTimeBlock: TimeBlock | null;
  visualizationText: string;
  moodBefore: string | null;
  moodAfter: string | null;
  /** 1–10 energy for coach step adaptation */
  energyScore?: number | null;
  /** 1–10 focus for coach step adaptation */
  focusScore?: number | null;
  /** Derived mood tag for adaptation engine */
  primaryTag?: CheckInTag | null;
  // Raw behavioral metrics
  breathingRoundsDone?: number;
  skippedSteps?: string[];
  visualizationDurationSec?: number;
  // Psychological metrics
  gratitudeGenericFlags?: number[];
  gratitudeTargetTypes?: string[];
  gratitudeTriggerKey?: string | null;
  gratitudeTriggerKeys?: Array<string | null>;
  gratitudeWasEdited?: boolean[];
  gratitudeEntryDurationsSec?: number[];
  missionChangedFromYesterday?: boolean;
  breathingFullPatternDone?: boolean;
  visualizationContentType?: 'future_positive' | 'problem_solving' | 'escapist' | 'empty';
};

export type AffirmationItem = {
  id: string;
  type: AffirmationType;
  title: string;
  textContent: string;
  youtubeVideoId: string | null;
  youtubeUrl: string | null;
  tags: string[];
  language: string;
  active: boolean;
  weight: number;
  lastUsedAt: string | null;
  createdAt: string;
  isDefault?: boolean;
  /** Hidden from ritual library (defaults are hidden, not deleted). */
  hiddenFromLibrary?: boolean;
  /** Draft affirmations stay in admin until published. */
  isDraft?: boolean;
  /** Created via admin panel (vs in-ritual quick add). */
  isAdminManaged?: boolean;
  lifeContextInclude?: LifeContextStatus[];
};

export type IdentityOption = {
  id: string;
  text: string;
  createdAt: string;
};

export const STEPS_BY_MODE: Record<RitualMode, RitualStep[]> = {
  quick: ['breathing', 'gratitude', 'identity', 'mission', 'complete'],
  standard: ['breathing', 'gratitude', 'affirmation', 'visualization', 'mission', 'complete'],
  deep: ['breathing', 'gratitude', 'affirmation', 'visualization', 'identity', 'mission', 'complete'],
};

export const BREATHING_PATTERNS: Record<BreathingType, { inhale: number; hold: number; exhale: number; rounds: number }> = {
  default: { inhale: 4, hold: 2, exhale: 6, rounds: 5 },
  energy: { inhale: 3, hold: 1, exhale: 3, rounds: 7 },
  calm: { inhale: 4, hold: 4, exhale: 8, rounds: 4 },
};

const MORNING_MODE_MINUTES: Record<RitualMode, number> = {
  quick: 3,
  standard: 7,
  deep: 12,
};

export function formatMorningModeMinutes(mode: RitualMode): string {
  return mode === 'deep' ? '12–15' : String(MORNING_MODE_MINUTES[mode]);
}
