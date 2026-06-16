import type {AppLocale} from '@/i18n/config';
import {behaviorProfileForPrompt} from '@/lib/behavior-profile/compute';
import type {UserBehaviorProfile} from '@/lib/behavior-profile/types';
import type {RecurringBlockerPattern} from '@/lib/blocker-patterns/types';
import {mapMorningRitualToAdaptation} from '@/lib/morning-ritual-adaptation';
import {resolveDynamicCoachTone} from '@/lib/coach-tone';
import type {CoachingStyle} from '@/lib/user-preferences';
import type {
  DailyBabyStep,
  DailyReflection,
  Goal,
} from '@/lib/life-coach/types';
import {dateToYMD} from '@/lib/date-utils';
import type {DailyFocusContext} from '@/lib/daily-focus-context';
import type {MorningRitualSession} from '@/lib/morning-ritual-types';

export type CoachHistoryContext = {
  active_goal: {title: string; domain: string} | null;
  today_steps: Array<{title: string; status: string}>;
  last_morning_ritual: {
    primary_tag: string | null;
    mood: number | null;
    energy: number | null;
    priority_action: string | null;
    mood_strategy: string | null;
  } | null;
  last_reflection: {
    blocker_reason: string | null;
    excerpt: string | null;
  } | null;
  blocker_pattern: {blocker: string; count: number; severity: string} | null;
  daily_focus: {
    active_domain: string | null;
    weakest_domain: string | null;
    morning_mission: string | null;
    linked_step_id: string | null;
    suggested_action: string | null;
  } | null;
  behavior_snapshot: Record<string, unknown> | null;
  effective_tone: {
    style: string;
    preferred_tone: string;
    avoid_tone: string;
  };
  anchors: string[];
};

function localDateStr(d = new Date()): string { return dateToYMD(d); }

export function coachLocalDateStr(): string {
  return localDateStr();
}

const GENERIC_ANCHORS = new Set([
  'the',
  'and',
  'you',
  'your',
  'step',
  'goal',
  'today',
  'זה',
  'של',
  'על',
  'את',
  'צעד',
  'יעד',
]);

function addAnchor(bucket: string[], value: string | null | undefined) {
  const trimmed = value?.trim();
  if (!trimmed || trimmed.length < 3) return;
  if (GENERIC_ANCHORS.has(trimmed.toLowerCase())) return;
  bucket.push(trimmed);
}

function buildAnchors(input: {
  goals: Goal[];
  todaySteps: DailyBabyStep[];
  morningRitual: MorningRitualSession | null;
  reflection: DailyReflection | null;
  recurringBlockers: RecurringBlockerPattern[];
  behaviorProfile: UserBehaviorProfile;
  dailyFocus: DailyFocusContext | null;
}): string[] {
  const anchors: string[] = [];
  const primaryGoal = input.goals[0];
  addAnchor(anchors, primaryGoal?.title);
  for (const step of input.todaySteps.slice(0, 4)) {
    addAnchor(anchors, step.title);
  }
  if (input.morningRitual?.completed) {
    const ritualDate = localDateStr(new Date(input.morningRitual.completedAt ?? input.morningRitual.startedAt));
    const adapted = mapMorningRitualToAdaptation(
      input.morningRitual,
      ritualDate,
      ritualDate === localDateStr() ? 'today' : 'latest'
    );
    addAnchor(anchors, adapted.primary_tag);
    addAnchor(anchors, adapted.priority_action);
    if (adapted.mood_strategy) addAnchor(anchors, adapted.mood_strategy);
  }
  addAnchor(anchors, input.reflection?.blocker_reason ?? null);
  addAnchor(anchors, input.reflection?.reflection_text?.trim().slice(0, 80) ?? null);
  const topBlocker = input.recurringBlockers[0];
  if (topBlocker) addAnchor(anchors, topBlocker.blocker);
  addAnchor(anchors, input.dailyFocus?.morningMission);
  addAnchor(anchors, input.dailyFocus?.suggestedAction?.title);
  for (const blocker of input.behaviorProfile.common_blockers.slice(0, 2)) {
    addAnchor(anchors, blocker);
  }
  return [...new Set(anchors)];
}

export function gatherCoachHistoryContext(input: {
  userId: string;
  locale: AppLocale;
  goals: Goal[];
  todaySteps: DailyBabyStep[];
  morningRitual: MorningRitualSession | null;
  reflection: DailyReflection | null;
  behaviorProfile: UserBehaviorProfile;
  recurringBlockers: RecurringBlockerPattern[];
  coachingStyle: CoachingStyle;
  dailyFocus?: DailyFocusContext | null;
}): CoachHistoryContext {
  const dynamicTone = resolveDynamicCoachTone(
    input.userId,
    input.coachingStyle,
    input.locale
  );
  const ritualAdaptation =
    input.morningRitual?.completed
      ? mapMorningRitualToAdaptation(
          input.morningRitual,
          localDateStr(new Date(input.morningRitual.completedAt ?? input.morningRitual.startedAt)),
          dateToYMD(new Date(input.morningRitual.completedAt ?? input.morningRitual.startedAt)) === localDateStr()
            ? 'today'
            : 'latest'
        )
      : null;
  const primaryGoal = input.goals[0] ?? null;
  const topBlocker = input.recurringBlockers[0] ?? null;

  return {
    active_goal: primaryGoal
      ? {title: primaryGoal.title, domain: primaryGoal.domain}
      : null,
    today_steps: input.todaySteps.slice(0, 5).map((step) => ({
      title: step.title,
      status: step.status,
    })),
    last_morning_ritual: ritualAdaptation
      ? {
          primary_tag: ritualAdaptation.primary_tag,
          mood: ritualAdaptation.mood,
          energy: ritualAdaptation.energy,
          priority_action: ritualAdaptation.priority_action,
          mood_strategy: ritualAdaptation.mood_strategy,
        }
      : null,
    last_reflection: input.reflection
      ? {
          blocker_reason: input.reflection.blocker_reason,
          excerpt: input.reflection.reflection_text?.trim().slice(0, 120) ?? null,
        }
      : null,
    blocker_pattern: topBlocker
      ? {
          blocker: topBlocker.blocker,
          count: topBlocker.count,
          severity: topBlocker.severity,
        }
      : null,
    daily_focus: input.dailyFocus
      ? {
          active_domain: input.dailyFocus.activeDomainId,
          weakest_domain: input.dailyFocus.weakestDomainId,
          morning_mission: input.dailyFocus.morningMission,
          linked_step_id: input.dailyFocus.linkedStepId,
          suggested_action: input.dailyFocus.suggestedAction?.title ?? null,
        }
      : null,
    behavior_snapshot: behaviorProfileForPrompt(input.behaviorProfile),
    effective_tone: {
      style: dynamicTone.effective_style,
      preferred_tone: dynamicTone.preferred_tone,
      avoid_tone: dynamicTone.avoid_tone,
    },
    anchors: buildAnchors({...input, dailyFocus: input.dailyFocus ?? null}),
  };
}

export function coachHistoryForPrompt(
  context: CoachHistoryContext
): Record<string, unknown> {
  return {
    active_goal: context.active_goal,
    today_steps: context.today_steps,
    last_mood: context.last_morning_ritual
      ? {
          primary_tag: context.last_morning_ritual.primary_tag,
          mood_score: context.last_morning_ritual.mood,
          energy: context.last_morning_ritual.energy,
          priority_action: context.last_morning_ritual.priority_action,
          mood_strategy: context.last_morning_ritual.mood_strategy,
        }
      : null,
    last_reflection: context.last_reflection,
    blocker_pattern: context.blocker_pattern,
    daily_focus: context.daily_focus,
    behavior_snapshot: context.behavior_snapshot,
    effective_tone: context.effective_tone,
    anchors: context.anchors,
  };
}

export function coachResponseReferencesPersonalDetail(
  response: string,
  anchors: string[]
): boolean {
  const normalized = response.toLowerCase();
  return anchors.some((anchor) => normalized.includes(anchor.toLowerCase().slice(0, 12)));
}

export function buildPersonalizedCoachFallback(input: {
  locale: AppLocale;
  emotionalState: string;
  escape: number;
  energy: number;
  userText?: string;
  context: CoachHistoryContext;
}): string {
  const focus = input.context.daily_focus;
  const priority = input.context.last_morning_ritual?.priority_action;
  const morningMission = focus?.morning_mission;
  const prefix =
    input.locale === 'he'
      ? morningMission
        ? `לגבי משימת הבוקר "${morningMission.slice(0, 80)}" — `
        : priority
          ? `לגבי "${priority.slice(0, 80)}" — `
          : input.userText?.trim()
            ? `${input.userText.trim().slice(0, 80)} — `
            : 'בוא נתחיל מצעד קטן אחד — '
      : morningMission
        ? `About your morning mission "${morningMission.slice(0, 80)}" — `
        : priority
          ? `About "${priority.slice(0, 80)}" — `
          : input.userText?.trim()
            ? `${input.userText.trim().slice(0, 80)} — `
            : 'Let’s start with one small step — ';

  const step = input.context.today_steps.find((item) => item.status === 'pending');
  if (step) {
    return input.locale === 'he'
      ? `${prefix}הצעד הבא: ${step.title}.`
      : `${prefix}Next step: ${step.title}.`;
  }

  if (input.energy <= 4 || input.escape >= 8) {
    return input.locale === 'he'
      ? `${prefix}בחר פעולה אחת של 2–3 דקות — משהו שאפשר לסיים עכשיו.`
      : `${prefix}Pick one 2–3 minute action you can finish now.`;
  }

  return input.locale === 'he'
    ? `${prefix}בחר פעולה אחת שאפשר לסיים ב-5 דקות.`
    : `${prefix}Pick one action you can finish in 5 minutes.`;
}
