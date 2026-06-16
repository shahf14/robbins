import type {AppLocale} from '@/i18n/config';
import type {LifeDomain} from '@/lib/life-coach/types';

/** Proven action strategy keyed to user friction — not free-form invention. */
export type ActionPatternKind =
  | 'no_time'
  | 'fear_of_failure'
  | 'lack_of_clarity'
  | 'fatigue'
  | 'procrastination';

export type ActionPatternTemplate = {
  kind: ActionPatternKind;
  domain: LifeDomain;
  strategy: string;
  title: string;
  description: string;
  success_signal: string;
  expected_resistance: string;
  pain_addressed: string;
  estimated_minutes: number;
};

export type ActionPatternToolboxEntry = {
  domain: LifeDomain;
  blocker_kind: ActionPatternKind;
  primary_blocker: string;
  patterns: Array<{
    pattern_id: string;
    strategy: string;
    title: string;
    description: string;
    estimated_minutes: number;
    pain_addressed: string;
    success_signal: string;
  }>;
};

export type ResolveBlockerInput = {
  domain: LifeDomain;
  recurringBlockers?: Array<{blocker: string; count: number}>;
  recentReflections?: Array<{blocker_reason: string | null; date: string}>;
  worstBlocker?: string | null;
  mainBlockers?: string[];
};

export type LocalizedPatternCopy = {
  title: string;
  description: string;
  success: string;
  resistance: string;
  pain: string;
  strategy: string;
};

export type PatternCopySet = Record<AppLocale, LocalizedPatternCopy>;
