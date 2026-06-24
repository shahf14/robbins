import {FALLBACK_STEP_COPY} from '@/lib/life-coach/fallback-copy';
import {dateToYMD} from '@/lib/date-utils';
import {resolveLatestRitualAdaptation} from '@/lib/morning-ritual-adaptation';
import {listMorningRitualSessions} from '@/lib/db/repositories/morning-rituals';
import {
  listDailyBabyStepsForDate,
  listGoals,
  listLifeDomainStates,
} from '@/lib/life-coach/repository';
import type {DailyBabyStep, Goal, LifeDomain, LifeDomainState} from '@/lib/life-coach/types';
import type {MorningRitualSession, TimeBlock} from '@/lib/morning-ritual-types';

type DailyFocusStatus = 'needs_attention' | 'stable' | 'strong';

export type DailyFocusContext = {
  date: string;
  activeDomainId: LifeDomain | null;
  activeDomainScore: number | null;
  activeDomainStatus: DailyFocusStatus | null;
  weakestDomainId: LifeDomain | null;
  weakestDomainScore: number | null;
  weakestDomainBlockers: string[];
  morningMission: string | null;
  morningIdentity: string | null;
  morningTimeBlock: TimeBlock | null;
  linkedStepId: string | null;
  suggestedAction: {
    title: string;
    description: string;
    source: 'morning_ritual' | 'domain_assessment' | 'goal';
    domainId: LifeDomain;
    estimatedMinutes: number;
  } | null;
  latestMorningRitual: {
    energy: number | null;
    focus: number | null;
    priorityAction: string | null;
    primaryTag: string | null;
  } | null;
};

export async function resolveDailyFocusContext(
  userId: string,
  date = dateToYMD(new Date())
): Promise<DailyFocusContext> {
  const [states, activeGoals, todaySteps] = await Promise.all([
    listLifeDomainStates(userId),
    listGoals({status: 'active', userId}),
    listDailyBabyStepsForDate(date, userId),
  ]);

  const morning = resolveMorningMission(userId, date);
  const latestRitual = resolveLatestRitualAdaptation(userId, date);
  const weakestState = resolveWeakestState(states);
  const activeDomain = resolveActiveDomain({
    morning,
    activeGoals,
    weakestState,
    todaySteps,
  });
  const activeState = states.find((state) => state.domain === activeDomain) ?? weakestState;
  const linkedStep = findLinkedStep(todaySteps, morning?.dailyMission ?? null, activeDomain);
  const suggestedAction = buildSuggestedAction({
    morning,
    linkedStep,
    activeDomain,
    activeState,
    activeGoals,
  });

  return {
    date,
    activeDomainId: activeDomain,
    activeDomainScore: activeState?.current_score ?? null,
    activeDomainStatus: activeState ? scoreStatus(activeState.current_score) : null,
    weakestDomainId: weakestState?.domain ?? null,
    weakestDomainScore: weakestState?.current_score ?? null,
    weakestDomainBlockers: weakestState?.main_blockers ?? [],
    morningMission: morning?.dailyMission?.trim() || null,
    morningIdentity: morning?.identityText?.trim() || null,
    morningTimeBlock: morning?.missionTimeBlock ?? null,
    linkedStepId: linkedStep?.id ?? null,
    suggestedAction,
    latestMorningRitual: latestRitual
      ? {
          energy: latestRitual.energy,
          focus: latestRitual.focus,
          priorityAction: latestRitual.priority_action,
          primaryTag: latestRitual.primary_tag,
        }
      : null,
  };
}

function resolveMorningMission(userId: string, date: string): MorningRitualSession | null {
  return (
    listMorningRitualSessions(userId, 14).find((session) => {
      const completedAt = session.completedAt ?? session.startedAt;
      return (
        session.completed &&
        !!session.dailyMission?.trim() &&
        dateToYMD(new Date(completedAt)) === date
      );
    }) ?? null
  );
}

function resolveWeakestState(states: LifeDomainState[]): LifeDomainState | null {
  return (
    [...states]
      .filter((state) => Number.isFinite(state.current_score))
      .sort((a, b) => a.current_score - b.current_score || b.updated_at.localeCompare(a.updated_at))[0] ??
    null
  );
}

function resolveActiveDomain(input: {
  morning: MorningRitualSession | null;
  activeGoals: Goal[];
  weakestState: LifeDomainState | null;
  todaySteps: DailyBabyStep[];
}): LifeDomain | null {
  const pendingStep = input.todaySteps.find((step) => step.status === 'pending');
  if (pendingStep) return pendingStep.domain;

  const mostRecentGoal = [...input.activeGoals].sort((a, b) => b.updated_at.localeCompare(a.updated_at))[0];
  if (mostRecentGoal) return mostRecentGoal.domain;

  return input.weakestState?.domain ?? null;
}

function findLinkedStep(
  steps: DailyBabyStep[],
  morningMission: string | null,
  activeDomain: LifeDomain | null
): DailyBabyStep | null {
  const pending = steps.filter((step) => step.status === 'pending');
  if (pending.length === 0) return null;

  if (morningMission) {
    const missionTokens = tokenSet(morningMission);
    const directMatch = pending
      .map((step) => ({
        step,
        score: overlapScore(missionTokens, `${step.title} ${step.description}`),
      }))
      .sort((a, b) => b.score - a.score)[0];
    if (directMatch && directMatch.score >= 0.22) return directMatch.step;
  }

  return pending.find((step) => step.domain === activeDomain) ?? pending[0] ?? null;
}

function buildSuggestedAction(input: {
  morning: MorningRitualSession | null;
  linkedStep: DailyBabyStep | null;
  activeDomain: LifeDomain | null;
  activeState: LifeDomainState | null;
  activeGoals: Goal[];
}): DailyFocusContext['suggestedAction'] {
  if (input.linkedStep) {
    return {
      title: input.linkedStep.title,
      description: input.linkedStep.description,
      source: 'goal',
      domainId: input.linkedStep.domain,
      estimatedMinutes: input.linkedStep.estimated_minutes,
    };
  }

  const domain = input.activeDomain ?? input.activeState?.domain ?? input.activeGoals[0]?.domain ?? 'mind';
  if (input.morning?.dailyMission?.trim()) {
    return {
      title: input.morning.dailyMission.trim().slice(0, 160),
      description:
        input.morning.missionTimeBlock === 'now'
          ? 'Break the morning mission into one visible move you can start now.'
          : 'Use the morning mission as today’s first small step.',
      source: 'morning_ritual',
      domainId: domain,
      estimatedMinutes: 10,
    };
  }

  if (input.activeState) {
    const blocker = input.activeState.main_blockers[0];
    return {
      title: blocker ? `Reduce one friction point: ${blocker}` : 'Choose one small step for this area',
      description: FALLBACK_STEP_COPY.finishToday.en,
      source: 'domain_assessment',
      domainId: input.activeState.domain,
      estimatedMinutes: 10,
    };
  }

  return null;
}

function scoreStatus(score: number): DailyFocusStatus {
  if (score <= 4) return 'needs_attention';
  if (score <= 7) return 'stable';
  return 'strong';
}

function tokenSet(value: string): Set<string> {
  return new Set(
    value
      .toLowerCase()
      .replace(/[^\p{L}\p{N}\s]/gu, ' ')
      .split(/\s+/)
      .filter((token) => token.length >= 3)
  );
}

function overlapScore(sourceTokens: Set<string>, candidate: string): number {
  if (sourceTokens.size === 0) return 0;
  const candidateTokens = tokenSet(candidate);
  let hits = 0;
  sourceTokens.forEach((token) => {
    if (candidateTokens.has(token)) hits += 1;
  });
  return hits / sourceTokens.size;
}
