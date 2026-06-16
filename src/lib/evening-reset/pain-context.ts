import type {AppLocale} from '@/i18n/config';
import type {FormulationSession} from '@/lib/life-coach/types';

type EveningPainTheme =
  | 'work_overload'
  | 'avoidance'
  | 'self_criticism'
  | 'uncertainty';

type EveningResetPainPromptInput = {
  presenting_concern: string;
  stressors: string[];
  maintaining_factors: string[];
  uncertainties: string[];
  plan_b: string | null;
};

export type EveningResetPainContext = {
  theme: EveningPainTheme;
  themes_ranked: EveningPainTheme[];
  prompt_input: EveningResetPainPromptInput;
};

export type EveningStepCopyOverride = {
  questionKey: string;
  placeholderKey: string;
};

const THEME_PRIORITY: EveningPainTheme[] = [
  'self_criticism',
  'work_overload',
  'avoidance',
  'uncertainty',
];

function blob(parts: Array<string | null | undefined>): string {
  return parts.filter(Boolean).join(' ');
}

function scoreWorkOverload(input: EveningResetPainPromptInput): number {
  const text = blob([input.presenting_concern, ...input.stressors, ...input.maintaining_factors]);
  let score = 0;
  if (/עבוד|work|עומס|overload|deadline|לוח|burnout|משרד|office/i.test(text)) score += 3;
  if (/גבול|boundary|after.?hours|אחרי\s*העבוד/i.test(text)) score += 2;
  if (input.stressors.some((s) => /עבוד|work|לחץ|pressure/i.test(s))) score += 2;
  return score;
}

function scoreAvoidance(input: EveningResetPainPromptInput, barrier: string | null): number {
  const text = blob([input.presenting_concern, ...input.maintaining_factors, barrier]);
  let score = 0;
  if (/avoid|הימנע|דחי|procrastin|postpon|דחית/i.test(text)) score += 4;
  if (input.maintaining_factors.some((m) => /avoid|הימנע|דח/i.test(m))) score += 3;
  if (barrier && /avoid|הימנע|דח/i.test(barrier)) score += 2;
  return score;
}

function scoreSelfCriticism(input: EveningResetPainPromptInput): number {
  const text = blob([
    input.presenting_concern,
    ...input.stressors,
    ...input.maintaining_factors,
  ]);
  let score = 0;
  if (/ביקורת|self.?crit|קוטל|not enough|לא מספיק|כישלון|failure/i.test(text)) score += 4;
  if (/אשמה|guilt|מאשים/i.test(text)) score += 2;
  if (input.maintaining_factors.some((m) => /ביקורת|אשמה|guilt/i.test(m))) score += 2;
  return score;
}

function scoreUncertainty(input: EveningResetPainPromptInput): number {
  let score = 0;
  if (input.uncertainties.length >= 2) score += 4;
  if (input.uncertainties.some((u) => u.trim().length >= 24)) score += 2;
  const text = blob([input.presenting_concern, ...input.uncertainties]);
  if (/לא ברור|unclear|uncertain|מבולבל|confus|לא יודע/i.test(text)) score += 2;
  return score;
}

function rankPainThemes(
  input: EveningResetPainPromptInput,
  anticipated_barrier: string | null
): EveningPainTheme[] {
  const scores = new Map<EveningPainTheme, number>([
    ['work_overload', scoreWorkOverload(input)],
    ['avoidance', scoreAvoidance(input, anticipated_barrier)],
    ['self_criticism', scoreSelfCriticism(input)],
    ['uncertainty', scoreUncertainty(input)],
  ]);

  return [...scores.entries()]
    .filter(([, weight]) => weight >= 3)
    .map(([theme, weight]) => ({theme, weight}))
    .sort((a, b) => {
      if (b.weight !== a.weight) return b.weight - a.weight;
      return THEME_PRIORITY.indexOf(a.theme) - THEME_PRIORITY.indexOf(b.theme);
    })
    .map((entry) => entry.theme);
}

export function buildEveningResetPainContext(
  session: FormulationSession
): EveningResetPainContext | null {
  const approved = session.formulation_approved;
  const concern = approved?.presenting_concern_user_words?.trim();
  if (!approved || !concern) return null;

  const prompt_input: EveningResetPainPromptInput = {
    presenting_concern: concern,
    stressors: (approved.stressors ?? []).filter(Boolean),
    maintaining_factors: (approved.maintaining_factors ?? []).filter(Boolean),
    uncertainties: (approved.uncertainties ?? []).filter(Boolean),
    plan_b: session.coach_handoff?.plan_b?.trim() || null,
  };

  const themes_ranked = rankPainThemes(
    prompt_input,
    session.coach_handoff?.anticipated_barrier?.trim() ?? null
  );
  if (themes_ranked.length === 0) return null;

  return {
    theme: themes_ranked[0]!,
    themes_ranked,
    prompt_input,
  };
}

function themeDetected(
  ctx: EveningResetPainContext | null,
  theme: EveningPainTheme
): boolean {
  return ctx?.themes_ranked.includes(theme) ?? false;
}

export function winReviewCopyOverride(
  ctx: EveningResetPainContext | null
): EveningStepCopyOverride | null {
  if (!themeDetected(ctx, 'self_criticism')) return null;
  return {
    questionKey: 'painFocus.selfCriticism.winQuestion',
    placeholderKey: 'painFocus.selfCriticism.winPlaceholder',
  };
}

export function completionBlockerCopyOverride(
  ctx: EveningResetPainContext | null
): EveningStepCopyOverride | null {
  if (!themeDetected(ctx, 'work_overload')) return null;
  return {
    questionKey: 'painFocus.workOverload.blockerQuestion',
    placeholderKey: 'painFocus.workOverload.blockerPlaceholder',
  };
}

export function tomorrowsWinCopyOverride(
  ctx: EveningResetPainContext | null
): EveningStepCopyOverride | null {
  if (themeDetected(ctx, 'avoidance')) {
    return {
      questionKey: 'painFocus.avoidance.tomorrowsQuestion',
      placeholderKey: 'painFocus.avoidance.tomorrowsPlaceholder',
    };
  }
  if (themeDetected(ctx, 'uncertainty')) {
    return {
      questionKey: 'painFocus.uncertainty.tomorrowsQuestion',
      placeholderKey: 'painFocus.uncertainty.tomorrowsPlaceholder',
    };
  }
  return null;
}

function camelTheme(theme: EveningPainTheme): string {
  switch (theme) {
    case 'work_overload':
      return 'workOverload';
    case 'self_criticism':
      return 'selfCriticism';
    default:
      return theme;
  }
}

export function painFocusBannerKey(ctx: EveningResetPainContext | null): string | null {
  if (!ctx) return null;
  return `painFocus.${camelTheme(ctx.theme)}.bannerTitle`;
}

export function painFocusBannerBodyKey(ctx: EveningResetPainContext | null): string | null {
  if (!ctx) return null;
  return `painFocus.${camelTheme(ctx.theme)}.bannerBody`;
}

export function painFocusBannerParams(
  ctx: EveningResetPainContext | null,
  locale: AppLocale
): Record<string, string> {
  const concern = ctx?.prompt_input.presenting_concern ?? '';
  const clipped = concern.length > 90 ? `${concern.slice(0, 89).trim()}…` : concern;
  return {
    concern: clipped || (locale === 'he' ? 'מה שבוער אצלך' : 'what weighs on you'),
  };
}

export function themedAiInsightKey(ctx: EveningResetPainContext | null): string | null {
  if (!ctx) return null;
  return `painFocus.${camelTheme(ctx.theme)}.aiInsight`;
}
