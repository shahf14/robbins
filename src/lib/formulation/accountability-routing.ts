import type {AppLocale} from '@/i18n/config';
import {buildGoalAlignmentContext} from '@/lib/formulation/goal-alignment';
import {burningFocusHeadline} from '@/lib/formulation/micro-goal-options';
import type {FormulationSession} from '@/lib/life-coach/types';

export type AccountabilityContext = {
  /** User's weekly commitment phrase (X) — primary anchor for all copy */
  commitment_phrase: string;
  micro_goal_week: string | null;
  value: string | null;
  burning_focus: string | null;
  presenting_concern: string | null;
  plan_b: string | null;
  home_weekly_commitment: string;
  daily_step_serve: string;
  weekly_review_proximity: string;
  evening_progress_question: string;
};

function clip(text: string, max: number): string {
  const t = text.trim();
  if (t.length <= max) return t;
  return `${t.slice(0, max - 1).trim()}…`;
}

function resolveCommitmentPhrase(session: FormulationSession, locale: AppLocale): string | null {
  const handoff = session.coach_handoff;
  const micro = handoff?.micro_goal_week?.trim();
  if (micro) return clip(micro, 120);

  const value = handoff?.value?.trim();
  if (value) return clip(value, 90);

  const concern = session.formulation_approved?.presenting_concern_user_words?.trim();
  if (concern) return clip(concern, 90);

  const alignment = buildGoalAlignmentContext(session, locale);
  const anchor = alignment.burning_focus_anchor?.trim();
  if (anchor) return clip(anchor, 90);

  return null;
}

function buildCopy(locale: AppLocale, commitment: string): Pick<
  AccountabilityContext,
  | 'home_weekly_commitment'
  | 'daily_step_serve'
  | 'weekly_review_proximity'
  | 'evening_progress_question'
> {
  const he = locale === 'he';
  return {
    home_weekly_commitment: he
      ? `השבוע התחייבת ל־${commitment}.`
      : `This week you committed to ${commitment}.`,
    daily_step_serve: he
      ? `זה הצעד הקטן שמשרת את ${commitment}.`
      : `This small step serves ${commitment}.`,
    weekly_review_proximity: he
      ? `האם השבוע שלך התקרב ל־${commitment}?`
      : `Did your week move closer to ${commitment}?`,
    evening_progress_question: he
      ? `מה עשית היום, אפילו קטן, בכיוון ${commitment}?`
      : `What did you do today, even something small, toward ${commitment}?`,
  };
}

export function buildAccountabilityContext(
  session: FormulationSession,
  locale: AppLocale
): AccountabilityContext | null {
  const commitment = resolveCommitmentPhrase(session, locale);
  if (!commitment) return null;

  const handoff = session.coach_handoff;
  const approved = session.formulation_approved;
  const burning = burningFocusHeadline(session, locale);

  return {
    commitment_phrase: commitment,
    micro_goal_week: handoff?.micro_goal_week?.trim() || null,
    value: handoff?.value?.trim() || null,
    burning_focus: burning !== (locale === 'he' ? 'מה שבוער עכשיו לפי הנתונים' : 'What is flaring now per your data')
      ? clip(burning, 90)
      : null,
    presenting_concern: approved?.presenting_concern_user_words?.trim() || null,
    plan_b: handoff?.plan_b?.trim() || null,
    ...buildCopy(locale, commitment),
  };
}

export function accountabilityForPrompt(
  ctx: AccountabilityContext | null
): Record<string, unknown> | null {
  if (!ctx) return null;
  return {
    commitment_phrase: ctx.commitment_phrase,
    micro_goal_week: ctx.micro_goal_week,
    value: ctx.value,
    burning_focus: ctx.burning_focus,
    presenting_concern: ctx.presenting_concern,
    plan_b: ctx.plan_b,
    daily_step_serve_line: ctx.daily_step_serve,
  };
}

export function accountabilityPromptBlock(locale: AppLocale): string {
  return locale === 'he'
    ? [
        '## אחריות לפי התחייבות (accountability):',
        'אם קיים accountability.commitment_phrase — כל צעד חייב לשרת את ההתחייבות הזו (לא "תמשיך להתמיד").',
        'ב-reasoning: קשר במשפט אחד ל-commitment_phrase — "משרת את X".',
        'אל תחליף את ניסוח המשתמש בניסוח גנרי.',
      ].join('\n')
    : [
        '## Commitment accountability (accountability):',
        'When accountability.commitment_phrase exists — every step must serve that commitment (not generic "keep going").',
        'In reasoning: tie one sentence to commitment_phrase — "serves X".',
        'Do not replace the user\'s wording with generic phrasing.',
      ].join('\n');
}

export function accountabilityWeeklyPromptBlock(locale: AppLocale): string {
  return locale === 'he'
    ? [
        '## אחריות שבועית (accountability):',
        'אם accountability קיים — summary ו-recommended_adjustment חייבים להתייחס ל-commitment_phrase.',
        'שאל בראש: האם השבוע התקרב ל-commitment_phrase? לא "האם היית עקבי/ת".',
      ].join('\n')
    : [
        '## Weekly accountability (accountability):',
        'When accountability exists — summary and recommended_adjustment must reference commitment_phrase.',
        'Lead with: did the week move closer to commitment_phrase? Not generic "were you consistent".',
      ].join('\n');
}

export function eveningProgressPlaceholder(locale: AppLocale): string {
  return locale === 'he'
    ? 'גם דקה אחת, מחשבה, או פתיחה קטנה — כל מה שקדם…'
    : 'Even one minute, a thought, or a small opening — anything that moved you…';
}
