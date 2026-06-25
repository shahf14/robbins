import type {AppLocale} from '@/i18n/config';
import {buildFormulationInsights} from '@/lib/formulation/formulation-insights';
import {resolveGenderedHebrewText} from '@/lib/gendered-copy';
import type {FormulationSession} from '@/lib/life-coach/types';

type VisualizationValueTheme =
  | 'family_presence'
  | 'self_confidence'
  | 'calm_stability'
  | 'general';

/** Payload for LLM or ritual prompts — gap-based visualization. */
type VisualizationPromptInput = {
  current_pain: string;
  desired_value: string;
  micro_goal_week: string;
  strengths: string[];
  primary_goal_focus: string;
};

export type PersonalizedVisualization = {
  value_theme: VisualizationValueTheme;
  prompt_input: VisualizationPromptInput;
  guided_steps: string[];
  subtitle: string;
  placeholder: string;
};

function clip(text: string, max: number): string {
  const trimmed = text.trim();
  if (!trimmed) return '';
  if (trimmed.length <= max) return trimmed;
  return `${trimmed.slice(0, max - 1).trim()}…`;
}

function valueThemeBlob(input: VisualizationPromptInput): string {
  return [input.desired_value, input.micro_goal_week, input.primary_goal_focus, input.current_pain]
    .filter(Boolean)
    .join(' ');
}

function detectVisualizationValueTheme(
  input: VisualizationPromptInput,
  locale: AppLocale
): VisualizationValueTheme {
  const blob = valueThemeBlob(input);
  const familyRe =
    locale === 'he'
      ? /משפח|הורה|ילד|בן\/בת|בת\/בן|נוכחות|זוג|בית/i
      : /family|parent|kids|child|presence|partner|home/i;
  const confidenceRe =
    locale === 'he'
      ? /ביטחון|עצמי|הימנע|דחי|פחד|אומץ/i
      : /confidence|self.?esteem|avoid|procrastin|fear|courage/i;
  const calmRe =
    locale === 'he' ? /שקט|רוגע|יציב|שלו/i : /calm|peace|stable|steady|grounded/i;

  if (familyRe.test(blob)) return 'family_presence';
  if (confidenceRe.test(blob)) return 'self_confidence';
  if (calmRe.test(blob)) return 'calm_stability';
  return 'general';
}

/** Collect visualization prompt fields from formulation + goal handoff. */
function buildVisualizationPromptInput(
  session: FormulationSession,
  locale: AppLocale
): VisualizationPromptInput | null {
  const handoff = session.coach_handoff;
  const approved = session.formulation_approved;
  const insights = buildFormulationInsights(session, locale);

  const desired_value = handoff?.value?.trim() ?? '';
  const micro_goal_week = handoff?.micro_goal_week?.trim() ?? '';
  const current_pain =
    approved?.presenting_concern_user_words?.trim() ||
    session.presenting_concern_user_words?.trim() ||
    insights.one_line_concern;

  if (!desired_value || !micro_goal_week || !current_pain) return null;

  return {
    current_pain,
    desired_value,
    micro_goal_week,
    strengths: (approved?.existing_strengths ?? []).filter(Boolean).slice(0, 3),
    primary_goal_focus: insights.primary_goal_focus,
  };
}

function strengthStep(
  input: VisualizationPromptInput,
  locale: AppLocale,
  gender?: string | null
): string | null {
  const strength = input.strengths[0];
  if (!strength) return null;
  return locale === 'he'
    ? resolveGenderedHebrewText(
        `יש לך כבר ${clip(strength, 90)} — תן/י לזה מקום ברגע הזה.`,
        gender
      )
    : `You already have ${clip(strength, 90)} — let that show up in this moment.`;
}

function buildGuidedSteps(
  input: VisualizationPromptInput,
  theme: VisualizationValueTheme,
  locale: AppLocale,
  gender?: string | null
): string[] {
  const pain = clip(input.current_pain, 95);
  const value = clip(input.desired_value, 70);
  const goal = clip(input.micro_goal_week, 110);
  const strength = strengthStep(input, locale, gender);
  const g = (text: string) => resolveGenderedHebrewText(text, gender);

  if (locale === 'he') {
    switch (theme) {
      case 'family_presence':
        return [
          `היום ${pain} — מותר להרגיש את זה.`,
          'דמיין רגע אחד השבוע עם מישהו שחשוב לך — נוכחות אמיתית, לא רק גוף במקום.',
          `באותו רגע: ${goal}`,
          `זה קורה מתוך ${value}.`,
          ...(strength ? [strength] : []),
          'איך זה מרגיש?',
        ];
      case 'self_confidence':
        return [
          `היום ${pain}.`,
          g('דמיין רגע אחד השבוע שבו את/ה פועל/ת — בלי לדחות.'),
          goal,
          g(`את/ה עושה את זה מתוך ${value}, לא מתוך פחד.`),
          ...(strength ? [strength] : []),
          'איך זה מרגיש בגוף?',
        ];
      case 'calm_stability':
        return [
          `היום ${pain}.`,
          `דמיין רגע אחד השבוע שבו יש קצת יותר שקט — גם אם רק לרגע.`,
          goal,
          g(`את/ה פועל/ת מתוך ${value}.`),
          ...(strength ? [strength] : []),
          'איך זה מרגיש?',
        ];
      default:
        return [
          `היום ${pain}.`,
          `דמיין רגע אחד השבוע שבו ${goal}`,
          g(`את/ה פועל/ת מתוך ${value}.`),
          ...(strength ? [strength] : []),
          'איך זה מרגיש?',
        ];
    }
  }

  switch (theme) {
    case 'family_presence':
      return [
        `Today ${pain} — it's okay to feel that.`,
        'Picture one moment this week with someone who matters — real presence, not just being in the room.',
        `In that moment: ${goal}`,
        `It happens from ${value}.`,
        ...(strength ? [strength] : []),
        'How does that feel?',
      ];
    case 'self_confidence':
      return [
        `Today ${pain}.`,
        'Picture one moment this week when you act — without postponing.',
        goal,
        `You do it from ${value}, not from fear.`,
        ...(strength ? [strength] : []),
        'How does that feel in your body?',
      ];
    case 'calm_stability':
      return [
        `Today ${pain}.`,
        'Picture one moment this week with a little more calm — even briefly.',
        goal,
        `You act from ${value}.`,
        ...(strength ? [strength] : []),
        'How does that feel?',
      ];
    default:
      return [
        `Today ${pain}.`,
        `Picture one moment this week when ${goal}`,
        `You act from ${value}.`,
        ...(strength ? [strength] : []),
        'How does that feel?',
      ];
  }
}

function buildSubtitle(
  input: VisualizationPromptInput,
  locale: AppLocale,
  gender?: string | null
): string {
  const pain = clip(input.current_pain, 80);
  const value = clip(input.desired_value, 60);
  return locale === 'he'
    ? resolveGenderedHebrewText(
        `היום ${pain}… דמיין רגע אחד השבוע שבו את/ה פועל/ת מתוך ${value}.`,
        gender
      )
    : `Today ${pain}… picture one moment this week when you act from ${value}.`;
}

function buildPlaceholder(input: VisualizationPromptInput, locale: AppLocale): string {
  const goal = clip(input.micro_goal_week, 120);
  return locale === 'he'
    ? `היום ייחשב הצלחה אם ${goal}`
    : `Today will count as a win if ${goal.charAt(0).toLowerCase()}${goal.slice(1)}`;
}

/** Build gap-based guided visualization from completed formulation handoff. */
export function buildPersonalizedVisualization(
  session: FormulationSession,
  locale: AppLocale
): PersonalizedVisualization | null {
  const prompt_input = buildVisualizationPromptInput(session, locale);
  if (!prompt_input) return null;

  const value_theme = detectVisualizationValueTheme(prompt_input, locale);
  const gender = session.participant_gender;
  return {
    value_theme,
    prompt_input,
    guided_steps: buildGuidedSteps(prompt_input, value_theme, locale, gender),
    subtitle: buildSubtitle(prompt_input, locale, gender),
    placeholder: buildPlaceholder(prompt_input, locale),
  };
}

/** Compact payload for wizard / LLM context (may omit micro_goal until goal step). */
export function buildVisualizationContextForWizard(
  session: FormulationSession,
  locale: AppLocale
): Record<string, unknown> | null {
  const insights = buildFormulationInsights(session, locale);
  const approved = session.formulation_approved;
  const handoff = session.coach_handoff;

  const current_pain =
    approved?.presenting_concern_user_words?.trim() ||
    insights.one_line_concern ||
    null;
  const desired_value = handoff?.value?.trim() || null;
  const micro_goal_week = handoff?.micro_goal_week?.trim() || null;

  if (!current_pain && !desired_value) return null;

  const partial: VisualizationPromptInput = {
    current_pain: current_pain ?? '',
    desired_value: desired_value ?? '',
    micro_goal_week: micro_goal_week ?? '',
    strengths: (approved?.existing_strengths ?? []).filter(Boolean).slice(0, 3),
    primary_goal_focus: insights.primary_goal_focus,
  };

  return {
    current_pain: partial.current_pain,
    desired_value: partial.desired_value,
    micro_goal_week: partial.micro_goal_week,
    strengths: partial.strengths,
    primary_goal_focus: partial.primary_goal_focus,
    value_theme: partial.desired_value
      ? detectVisualizationValueTheme(partial, locale)
      : null,
    gap_pattern:
      locale === 'he'
        ? resolveGenderedHebrewText(
            'היום {current_pain}… דמיין רגע אחד השבוע שבו את/ה פועל/ת מתוך {desired_value}.',
            session.participant_gender
          )
        : 'Today {current_pain}… picture one moment this week when you act from {desired_value}.',
  };
}
