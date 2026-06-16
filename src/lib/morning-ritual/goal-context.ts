import type {AppLocale} from '@/i18n/config';
import {
  morningMissionPlaceholderKey,
} from '@/lib/life-context-content';
import type {
  CoachHandoff,
  FormulationSession,
  LifeContextStatus,
  LifeDomain,
  RiskLevel,
} from '@/lib/life-coach/types';
import {LIFE_DOMAINS} from '@/lib/life-coach/types';
import type {RitualMode} from '@/lib/morning-ritual-types';
import type {MorningRitualTone} from '@/lib/morning-ritual/yesterday-context';
import {suggestedMorningModeForContext} from '@/lib/morning-ritual/yesterday-context';

type MorningRitualToneSafety = 'gentle_only' | 'moderate' | 'allow_high_performance';

type MorningRitualDailyFocus =
  | 'one_action_before_noise'
  | 'short_soft_start'
  | 'stability_not_hype'
  | 'steady_progress';

/** Goal-aware context for morning ritual — from completed formulation handoff. */
export type MorningRitualGoalContext = {
  domain: LifeDomain | null;
  micro_goal_week: string | null;
  barrier: string | null;
  life_context_statuses: LifeContextStatus[];
  tone_safety: MorningRitualToneSafety;
  daily_focus: MorningRitualDailyFocus;
  participant_age: number | null;
  participant_gender: string | null;
  risk_level: RiskLevel | null;
};

type BarrierSignal = 'avoidance' | 'fatigue' | 'financial' | 'time' | 'general';

export function deriveDomainFromHandoff(raw?: string | null): LifeDomain | null {
  if (!raw) return null;
  const normalized = raw.toLowerCase().trim().replace(/\s+/g, '_');
  return (LIFE_DOMAINS as readonly string[]).includes(normalized)
    ? (normalized as LifeDomain)
    : null;
}

function classifyAnticipatedBarrier(text: string | null | undefined): BarrierSignal {
  const blob = (text ?? '').trim();
  if (!blob) return 'general';
  if (/avoid|הימנע|דחי|procrastin|postpon|מדח/i.test(blob)) return 'avoidance';
  if (/עייפ|fatigue|tired|exhaust|אנרגיה|sleep|שינה|low energy/i.test(blob)) return 'fatigue';
  if (/כסף|כלכל|financial|money|פרנס|between.?job/i.test(blob)) return 'financial';
  if (/זמן|time|busy|עמוס|no time/i.test(blob)) return 'time';
  return 'general';
}

function toneSafetyFromRisk(risk: RiskLevel | null | undefined): MorningRitualToneSafety {
  if (risk === 'crisis' || risk === 'elevated') return 'gentle_only';
  return 'allow_high_performance';
}

function capToneSafety(
  current: MorningRitualToneSafety,
  next: MorningRitualToneSafety
): MorningRitualToneSafety {
  const rank: Record<MorningRitualToneSafety, number> = {
    gentle_only: 0,
    moderate: 1,
    allow_high_performance: 2,
  };
  return rank[next] < rank[current] ? next : current;
}

function resolveDailyFocus(input: {
  domain: LifeDomain | null;
  barrier: string | null;
  life_context_statuses: LifeContextStatus[];
  today_energy: number | null;
}): MorningRitualDailyFocus {
  const barrierKind = classifyAnticipatedBarrier(input.barrier);
  const contexts = input.life_context_statuses;
  const lowEnergy = input.today_energy != null && input.today_energy <= 4;

  if (
    contexts.includes('new_parent') &&
    (barrierKind === 'fatigue' || lowEnergy)
  ) {
    return 'short_soft_start';
  }

  if (contexts.includes('caregiver') && (barrierKind === 'fatigue' || lowEnergy)) {
    return 'short_soft_start';
  }

  if (
    contexts.includes('between_jobs') &&
    (barrierKind === 'financial' || input.domain === 'wealth' || input.domain === 'career')
  ) {
    return 'stability_not_hype';
  }

  if (
    (input.domain === 'career' || contexts.includes('manager') || contexts.includes('student')) &&
    (barrierKind === 'avoidance' || barrierKind === 'time')
  ) {
    return 'one_action_before_noise';
  }

  if (barrierKind === 'avoidance' && input.domain === 'career') {
    return 'one_action_before_noise';
  }

  return 'steady_progress';
}

function resolveToneSafety(input: {
  risk_level: RiskLevel | null;
  life_context_statuses: LifeContextStatus[];
  daily_focus: MorningRitualDailyFocus;
}): MorningRitualToneSafety {
  let safety = toneSafetyFromRisk(input.risk_level);

  if (
    input.life_context_statuses.includes('new_parent') ||
    input.life_context_statuses.includes('caregiver')
  ) {
    safety = capToneSafety(safety, 'moderate');
  }

  if (input.life_context_statuses.includes('between_jobs')) {
    safety = capToneSafety(safety, 'moderate');
  }

  if (
    input.daily_focus === 'short_soft_start' ||
    input.daily_focus === 'stability_not_hype'
  ) {
    safety = capToneSafety(safety, 'moderate');
  }

  return safety;
}

export function buildMorningRitualGoalContext(
  session: FormulationSession,
  todayEnergy: number | null = null
): MorningRitualGoalContext | null {
  const handoff: CoachHandoff | null = session.coach_handoff;
  if (!handoff?.micro_goal_week?.trim()) return null;

  const domain = deriveDomainFromHandoff(handoff.suggested_domain);
  const life_context_statuses =
    session.life_context_statuses.length > 0 ? session.life_context_statuses : [];

  const daily_focus = resolveDailyFocus({
    domain,
    barrier: handoff.anticipated_barrier,
    life_context_statuses,
    today_energy: todayEnergy,
  });

  return {
    domain,
    micro_goal_week: handoff.micro_goal_week.trim(),
    barrier: handoff.anticipated_barrier?.trim() || null,
    life_context_statuses,
    daily_focus,
    tone_safety: resolveToneSafety({
      risk_level: session.risk_level,
      life_context_statuses,
      daily_focus,
    }),
    participant_age: session.participant_age,
    participant_gender: session.participant_gender,
    risk_level: session.risk_level,
  };
}

/** Merge yesterday execution tone with goal safety caps. */
export function resolveEffectiveMorningTone(
  yesterdayTone: MorningRitualTone,
  goalContext: MorningRitualGoalContext | null,
  todayEnergy: number | null
): MorningRitualTone {
  let tone = yesterdayTone;

  if (!goalContext) return tone;

  if (goalContext.tone_safety === 'gentle_only') {
    return 'restart_gently';
  }

  if (goalContext.daily_focus === 'short_soft_start') {
    return 'restart_gently';
  }

  if (goalContext.daily_focus === 'stability_not_hype' && tone === 'high_performance') {
    tone = 'steady';
  }

  if (
    goalContext.life_context_statuses.includes('new_parent') &&
    tone === 'high_performance'
  ) {
    tone = 'steady';
  }

  if (goalContext.tone_safety === 'moderate' && tone === 'high_performance') {
    tone = 'steady';
  }

  if (todayEnergy != null && todayEnergy <= 4 && tone === 'high_performance') {
    tone = 'steady';
  }

  if (
    todayEnergy != null &&
    todayEnergy <= 3 &&
    goalContext.life_context_statuses.includes('new_parent')
  ) {
    tone = 'restart_gently';
  }

  return tone;
}

export function suggestedMorningModeForGoalContext(
  lifeContexts: LifeContextStatus[] | null | undefined,
  effectiveTone: MorningRitualTone,
  goalContext: MorningRitualGoalContext | null
): RitualMode {
  if (goalContext?.daily_focus === 'short_soft_start') return 'quick';
  if (goalContext?.daily_focus === 'stability_not_hype') return 'quick';
  if (goalContext?.daily_focus === 'one_action_before_noise') {
    const base = suggestedMorningModeForContext(lifeContexts, effectiveTone);
    return base === 'deep' ? 'standard' : base;
  }
  return suggestedMorningModeForContext(lifeContexts, effectiveTone);
}

const FOCUS_MISSION_PLACEHOLDER: Record<MorningRitualDailyFocus, string> = {
  one_action_before_noise: 'morningRitual.mission.placeholderOneActionBeforeNoise',
  short_soft_start: 'morningRitual.mission.placeholderShortSoftStart',
  stability_not_hype: 'morningRitual.mission.placeholderStabilityNotHype',
  steady_progress: '',
};

const FOCUS_HINT_KEY: Record<MorningRitualDailyFocus, string | null> = {
  one_action_before_noise: 'goalFocus.oneActionBeforeNoise',
  short_soft_start: 'goalFocus.shortSoftStart',
  stability_not_hype: 'goalFocus.stabilityNotHype',
  steady_progress: null,
};

export function morningMissionPlaceholderForGoalContext(
  lifeContexts: LifeContextStatus[] | null | undefined,
  effectiveTone: MorningRitualTone,
  goalContext: MorningRitualGoalContext | null
): string {
  const focusKey = goalContext ? FOCUS_MISSION_PLACEHOLDER[goalContext.daily_focus] : '';
  if (focusKey) return focusKey;

  if (effectiveTone === 'restart_gently') {
    return 'morningRitual.mission.placeholderGentleRestart';
  }
  if (effectiveTone === 'high_performance') {
    return 'morningRitual.mission.placeholderHighPerformance';
  }
  return morningMissionPlaceholderKey(lifeContexts);
}

export function dailyFocusHintKey(
  goalContext: MorningRitualGoalContext | null
): string | null {
  if (!goalContext) return null;
  return FOCUS_HINT_KEY[goalContext.daily_focus];
}

/** i18n params for focus hint body (micro goal excerpt). */
export function dailyFocusHintParams(
  goalContext: MorningRitualGoalContext | null,
  locale: AppLocale
): Record<string, string> {
  const goal = goalContext?.micro_goal_week?.trim() ?? '';
  const clipped = goal.length > 100 ? `${goal.slice(0, 99).trim()}…` : goal;
  return {microGoal: clipped || (locale === 'he' ? 'יעד השבוע שלך' : 'your weekly goal')};
}
