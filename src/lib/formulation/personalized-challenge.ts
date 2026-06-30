import type {AppLocale} from '@/i18n/config';
import {buildEmotionalStageRouting} from '@/lib/formulation/emotional-stage-routing';
import type {FormulationSessionResponse} from '@/lib/life-coach/response-dtos';
import type {LifeContextStatus, LifeDomain} from '@/lib/life-coach/types';

type ChallengeType =
  | 'time_micro'
  | 'avoidance_start'
  | 'flexible_parent'
  | 'recovery_gentle'
  | 'clarity_mapping'
  | 'micro_goal_adapted';

type ChallengeStreakMode = 'flexible' | 'soft' | 'standard';

export type PersonalizedChallenge = {
  challenge_type: ChallengeType;
  title: string;
  micro_goal_anchor: string;
  daily_minimum: string;
  fallback_plan: string;
  success_definition: string;
  target_completions_per_week: number;
  streak_mode: ChallengeStreakMode;
  /** Human label — never a generic "7 days". */
  weekly_target_label: string;
  barrier_signal: string | null;
  plan_b: string;
};

type BarrierKind = 'time' | 'avoidance' | 'fatigue' | 'financial' | 'general';

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function classifyBarrier(
  anticipated: string | null | undefined,
  maintaining: string[]
): BarrierKind {
  const blob = [anticipated, ...maintaining].filter(Boolean).join(' ');
  if (!blob.trim()) return 'general';
  if (/avoid|הימנע|דחי|procrastin|postpon|מדח/i.test(blob)) return 'avoidance';
  if (/זמן|time|busy|עמוס|no time|לוח/i.test(blob)) return 'time';
  if (/עייפ|fatigue|tired|exhaust|אנרג|sleep|שינה/i.test(blob)) return 'fatigue';
  if (/כסף|money|financial|פרנס/i.test(blob)) return 'financial';
  return 'general';
}

function hasFlexibleLifeContext(statuses: LifeContextStatus[]): boolean {
  return statuses.some((s) => s === 'new_parent' || s === 'caregiver');
}

function resolveIntensity(session: FormulationSessionResponse): number {
  const fromApproved = session.formulation_approved?.intensity_0_10;
  if (typeof fromApproved === 'number' && fromApproved >= 0) {
    return Math.min(10, Math.max(0, fromApproved));
  }
  const fromDimensions = session.dimensions?.intensity_0_10;
  if (typeof fromDimensions === 'number' && fromDimensions >= 0) {
    return Math.min(10, Math.max(0, fromDimensions));
  }
  return 5;
}

function resolveFrequencyPerWeek(session: FormulationSessionResponse): number | null {
  const freq = session.dimensions?.frequency_per_week;
  if (typeof freq === 'number' && freq > 0) {
    return Math.min(6, Math.max(2, Math.round(freq)));
  }
  return null;
}

function selectChallengeType(input: {
  barrier: BarrierKind;
  intensity: number;
  emotionalProfile: ReturnType<typeof buildEmotionalStageRouting>['content_profile'];
  clarityOverAction: boolean;
  flexibleLifeContext: boolean;
}): ChallengeType {
  if (input.intensity >= 8 || input.emotionalProfile === 'gentle_safety') {
    return 'recovery_gentle';
  }
  if (input.flexibleLifeContext) return 'flexible_parent';
  if (input.barrier === 'avoidance') return 'avoidance_start';
  if (input.barrier === 'time') return 'time_micro';
  if (input.clarityOverAction) return 'clarity_mapping';
  return 'micro_goal_adapted';
}

function buildChallengeCopy(
  type: ChallengeType,
  locale: AppLocale,
  microGoal: string,
  planB: string,
  target: number,
  streakMode: ChallengeStreakMode
): Pick<
  PersonalizedChallenge,
  'title' | 'daily_minimum' | 'fallback_plan' | 'success_definition' | 'weekly_target_label'
> {
  const goal = clip(microGoal, 90);
  const he = locale === 'he';

  switch (type) {
    case 'time_micro':
      return {
        title: he ? '5 דקות ביום — לא יותר' : '5 minutes a day — no more',
        daily_minimum: he
          ? `5 דקות היום שקשורות ל: ${goal}`
          : `5 minutes today tied to: ${goal}`,
        fallback_plan: planB || (he ? '2 דקות — רק לפתוח/להתחיל' : '2 minutes — open or start only'),
        success_definition: he
          ? `הצלחה = ${target} ימים השבוע שבהם עשית לפחות 5 דקות (לא חייבים לסיים).`
          : `Success = ${target} days this week with at least 5 minutes (finishing not required).`,
        weekly_target_label: he
          ? `${target}×5 דקות השבוע`
          : `${target}×5 min this week`,
      };
    case 'avoidance_start':
      return {
        title: he ? 'רק להתחיל — לא להשלים' : 'Start only — do not have to finish',
        daily_minimum: he
          ? `להתחיל משהו קטן סביב: ${goal} (2–10 דקות)`
          : `Start something small around: ${goal} (2–10 minutes)`,
        fallback_plan: planB || (he ? 'לפתוח את מה שדוחים — בלי לבצע' : 'Open what you avoid — no execution'),
        success_definition: he
          ? `הצלחה = ${target} פעמים השבוע שהתחלת — גם אם עצרת מוקדם.`
          : `Success = ${target} starts this week — even if you stopped early.`,
        weekly_target_label: he
          ? `${target} התחלות רכות`
          : `${target} gentle starts`,
      };
    case 'flexible_parent':
      return {
        title: he ? 'אתגר גמיש — בלי streak קשיח' : 'Flexible challenge — no rigid streak',
        daily_minimum: he
          ? `צעד קטן כשיש חלון: ${goal}`
          : `A small step when a window opens: ${goal}`,
        fallback_plan: planB || (he ? 'גרסה של דקה אחת — גם בזמן לא מתוכנן' : 'One-minute version — even in unplanned time'),
        success_definition: he
          ? `הצלחה = ${target} נקודות התקדמות השבוע — לא רצף יומי.`
          : `Success = ${target} progress points this week — not a daily streak.`,
        weekly_target_label: he
          ? `${target} נקודות גמישות`
          : `${target} flexible points`,
      };
    case 'recovery_gentle':
      return {
        title: he ? 'אתגר recovery — לא performance' : 'Recovery challenge — not performance',
        daily_minimum: he
          ? `משהו רך שמייצב: ${goal} (3–8 דקות)`
          : `Something soft that stabilizes: ${goal} (3–8 minutes)`,
        fallback_plan: planB || (he ? 'נשימה / מים / מנוחה — בלי ביצוע' : 'Breath / water / rest — no execution'),
        success_definition: he
          ? `הצלחה = ${target} רגעים של טיפול עצמי השבוע — לא "להצליח" במשימה.`
          : `Success = ${target} self-care moments this week — not task performance.`,
        weekly_target_label: he
          ? `${target} רגעי recovery`
          : `${target} recovery moments`,
      };
    case 'clarity_mapping':
      return {
        title: he ? 'בהירות לפני פעולה' : 'Clarity before action',
        daily_minimum: he
          ? `5 דקות לבהירות סביב: ${goal} (לא ביצוע כבד)`
          : `5 minutes of clarity around: ${goal} (not heavy execution)`,
        fallback_plan: planB || (he ? 'לכתוב שאלה אחת שעדיין לא ברורה' : 'Write one question that is still unclear'),
        success_definition: he
          ? `הצלחה = ${target} פעמים השבוע שיצרת בהירות — לא חייבים לפעול.`
          : `Success = ${target} clarity sessions this week — action optional.`,
        weekly_target_label: he
          ? `${target}×בהירות`
          : `${target}×clarity`,
      };
    default:
      return {
        title: he ? 'צעד שבועי מותאם' : 'Adapted weekly step',
        daily_minimum: he
          ? `צעד קטן היום ל: ${goal}`
          : `One small step today toward: ${goal}`,
        fallback_plan: planB || (he ? 'גרסה קצרה יותר של אותו צעד' : 'A shorter version of the same step'),
        success_definition: he
          ? `הצלחה = ${target} פעמים התקדמת השבוע${
              streakMode === 'flexible' ? ' — בלי streak קשיח' : ''
            }.`
          : `Success = ${target} progressions this week${
              streakMode === 'flexible' ? ' — no rigid streak' : ''
            }.`,
        weekly_target_label: he
          ? `${target} פעמים השבוע`
          : `${target} times this week`,
      };
  }
}

function resolveWeeklyTarget(
  type: ChallengeType,
  frequency: number | null,
  flexibleLifeContext: boolean
): {target: number; streakMode: ChallengeStreakMode} {
  if (type === 'recovery_gentle') {
    return {target: 2, streakMode: 'soft'};
  }
  if (type === 'flexible_parent' || flexibleLifeContext) {
    return {target: frequency ?? 3, streakMode: 'flexible'};
  }
  if (type === 'time_micro') {
    return {target: frequency ?? 5, streakMode: 'soft'};
  }
  if (type === 'avoidance_start') {
    return {target: frequency ?? 4, streakMode: 'soft'};
  }
  if (type === 'clarity_mapping') {
    return {target: frequency ?? 3, streakMode: 'soft'};
  }
  return {target: frequency ?? 4, streakMode: 'standard'};
}

export function buildPersonalizedChallenge(
  session: FormulationSessionResponse,
  locale: AppLocale = session.locale
): PersonalizedChallenge | null {
  const handoff = session.coach_handoff;
  const microGoal = handoff?.micro_goal_week?.trim();
  if (!handoff || !microGoal) return null;

  const emotional = buildEmotionalStageRouting(session, locale);
  const intensity = resolveIntensity(session);
  const barrier = classifyBarrier(
    handoff.anticipated_barrier,
    session.formulation_approved?.maintaining_factors ?? []
  );
  const flexibleLifeContext = hasFlexibleLifeContext(session.life_context_statuses);
  const challengeType = selectChallengeType({
    barrier,
    intensity,
    emotionalProfile: emotional.content_profile,
    clarityOverAction: emotional.clarity_over_action,
    flexibleLifeContext,
  });

  const {target, streakMode} = resolveWeeklyTarget(
    challengeType,
    resolveFrequencyPerWeek(session),
    flexibleLifeContext
  );

  const planB = handoff.plan_b?.trim() ?? '';
  const copy = buildChallengeCopy(
    challengeType,
    locale,
    microGoal,
    handoff.plan_b?.trim() ?? '',
    target,
    streakMode
  );

  return {
    challenge_type: challengeType,
    micro_goal_anchor: microGoal,
    barrier_signal: handoff.anticipated_barrier?.trim() || null,
    plan_b: planB,
    target_completions_per_week: target,
    streak_mode: streakMode,
    ...copy,
  };
}

export function personalizedChallengeForPrompt(
  challenge: PersonalizedChallenge | null
): Record<string, unknown> | null {
  if (!challenge) return null;
  return {
    challenge_type: challenge.challenge_type,
    title: challenge.title,
    micro_goal_anchor: challenge.micro_goal_anchor,
    daily_minimum: challenge.daily_minimum,
    fallback_plan: challenge.fallback_plan,
    success_definition: challenge.success_definition,
    target_completions_per_week: challenge.target_completions_per_week,
    streak_mode: challenge.streak_mode,
    weekly_target_label: challenge.weekly_target_label,
    barrier_signal: challenge.barrier_signal,
    plan_b: challenge.plan_b,
  };
}

export function challengePromptBlock(locale: AppLocale): string {
  return locale === 'he'
    ? [
        '## אתגר מותאם (personalized_challenge):',
        'אם קיים personalized_challenge — אל תציע "7 ימים" גנרי.',
        'הצעדים/האתגר חייבים לעמוד ב-daily_minimum, fallback_plan, success_definition.',
        'כבד streak_mode: flexible=בלי רצף קשיח; soft=התחלה/5 דקות נספרות; standard=יעד שבועי רגיל.',
      ].join('\n')
    : [
        '## Personalized challenge:',
        'If personalized_challenge exists — never suggest a generic "7 days".',
        'Steps/challenge must honor daily_minimum, fallback_plan, success_definition.',
        'Respect streak_mode: flexible=no rigid streak; soft=starts/5-min count; standard=normal weekly target.',
      ].join('\n');
}
