import type {AppLocale} from '@/i18n/config';
import type {
  Goal,
  LifeDomain,
  LifeDomainState,
  StructuredDailyBabyStep,
} from '@/lib/life-coach/types';
import {buildFallbackStepContract, stepContractToStructured} from '@/lib/life-coach/step-contract';
import type {RecurringBlockerPattern} from '@/lib/blocker-patterns/types';
import type {ExecutionHistorySummary} from '@/lib/execution-history/summarize';
import {
  ACTION_PATTERNS_PROMPT_BLOCK,
  getActionPatternCopy,
  listPatternsForKind,
} from './patterns';
import {resolveBlockerForDomain, resolveBlockerLabel} from './resolve-blocker';
import type {
  ActionPatternKind,
  ActionPatternTemplate,
  ActionPatternToolboxEntry,
} from './types';

export type {
  ActionPatternTemplate,
  ActionPatternToolboxEntry,
} from './types';
export {ACTION_PATTERNS_PROMPT_BLOCK};

type ToolboxInput = {
  locale: AppLocale;
  activeGoals: Array<Pick<Goal, 'id' | 'domain' | 'title'>>;
  domainStates: Array<Pick<LifeDomainState, 'domain' | 'main_blockers'>>;
  recurringBlockers?: RecurringBlockerPattern[];
  recentReflections?: Array<{blocker_reason: string | null; date: string}>;
  executionHistory?: ExecutionHistorySummary | null;
};

function sharedBlockerContext(input: ToolboxInput) {
  return {
    recurringBlockers: input.recurringBlockers,
    recentReflections: input.recentReflections?.map((r) => ({
      blocker_reason: r.blocker_reason,
      date: r.date,
    })),
    worstBlocker: input.executionHistory?.worst_blocker ?? null,
  };
}

/** Build prompt toolbox — proven patterns per active goal domain. */
export function buildActionPatternToolbox(input: ToolboxInput): ActionPatternToolboxEntry[] {
  const shared = sharedBlockerContext(input);
  const domains = input.activeGoals.length
    ? [...new Set(input.activeGoals.map((g) => g.domain))]
    : input.domainStates.map((d) => d.domain);

  return domains.slice(0, 4).map((domain) => {
    const kind = resolveBlockerForDomain(domain, {
      ...shared,
      mainBlockers:
        input.domainStates.find((d) => d.domain === domain)?.main_blockers ??
        input.domainStates[0]?.main_blockers ??
        [],
    });
    const patterns = listPatternsForKind(kind, domain, input.locale).map((pattern) => ({
      pattern_id: pattern.pattern_id,
      strategy: pattern.strategy,
      title: pattern.title,
      description: pattern.description,
      estimated_minutes: pattern.estimated_minutes,
      pain_addressed: pattern.pain,
      success_signal: pattern.success,
    }));

    return {
      domain,
      blocker_kind: kind,
      primary_blocker: resolveBlockerLabel(kind, input.locale),
      patterns,
    };
  });
}

function pickActionPattern(input: {
  kind: ActionPatternKind;
  domain: LifeDomain;
  locale: AppLocale;
  goalTitle?: string | null;
}): ActionPatternTemplate {
  const copy = getActionPatternCopy(input.kind, input.domain, input.locale);
  const goalSuffix = input.goalTitle?.trim();

  const title = goalSuffix
    ? input.locale === 'he'
      ? `${copy.title} — ${goalSuffix}`.slice(0, 180)
      : `${copy.title} — toward ${goalSuffix}`.slice(0, 180)
    : copy.title;

  return {
    kind: input.kind,
    domain: input.domain,
    strategy: copy.strategy,
    title,
    description: copy.description,
    success_signal: copy.success,
    expected_resistance: copy.resistance,
    pain_addressed: copy.pain,
    estimated_minutes: copy.estimated_minutes,
  };
}

/** Build a structured step from a proven action pattern. */
export function structuredStepFromActionPattern(
  pattern: ActionPatternTemplate,
  meta: {goal_id: string | null; locale: AppLocale; why?: string}
): StructuredDailyBabyStep {
  const he = meta.locale === 'he';
  const contract = buildFallbackStepContract({
    title: pattern.title,
    description: pattern.description,
    estimated_minutes: pattern.estimated_minutes,
    difficulty: 'easy',
    locale: meta.locale,
    why:
      meta.why ??
      (he
        ? `נבחר כי ${pattern.strategy} — תבנית מוכחת לחסם.`
        : `Chosen because ${pattern.strategy} — proven blocker pattern.`),
    resistance: pattern.expected_resistance,
    pain: pattern.pain_addressed,
    success: pattern.success_signal,
  });

  return stepContractToStructured(contract, {
    domain: pattern.domain,
    goal_id: meta.goal_id,
  });
}

export function pickActionPatternForProfile(input: {
  domain: LifeDomain;
  locale: AppLocale;
  goalTitle?: string | null;
  recurringBlockers?: RecurringBlockerPattern[];
  recentReflections?: Array<{blocker_reason: string | null; date: string}>;
  worstBlocker?: string | null;
  mainBlockers?: string[];
}): ActionPatternTemplate {
  const kind = resolveBlockerForDomain(input.domain, {
    recurringBlockers: input.recurringBlockers,
    recentReflections: input.recentReflections,
    worstBlocker: input.worstBlocker ?? null,
    mainBlockers: input.mainBlockers,
  });

  return pickActionPattern({
    kind,
    domain: input.domain,
    locale: input.locale,
    goalTitle: input.goalTitle,
  });
}
