import type {AppLocale} from '@/i18n/config';
import {resolveGenderedDeep} from '@/lib/gendered-copy';
import {buildFormulationInsights} from '@/lib/formulation/formulation-insights';
import type {MindsetBlockerKind} from '@/lib/formulation/mindset-exercises';
import type {BreathingType, RitualMode} from '@/lib/morning-ritual-types';
import type {EveningMode} from '@/lib/evening-reset-types';
import {defaultBreathingType, defaultMorningRitualMode} from '@/lib/life-context-content';
import type {FormulationSessionResponse} from '@/lib/life-coach/response-dtos';
import type {
  LifeContextStatus,
  RiskAction,
  RiskLevel,
} from '@/lib/life-coach/types';
import type {MorningRitualTone} from '@/lib/morning-ritual/yesterday-context';

type EmotionalIntensityBand = 'low' | 'moderate' | 'high';

/** Primary content routing profile derived from intensity + safety. */
type EmotionalContentProfile =
  | 'growth_focus'
  | 'regulation_clarity'
  | 'gentle_safety';

type EmotionalStageModifier =
  | 'activate_strengths'
  | 'clarity_over_action'
  | 'risk_safety_cap';

export type EmotionalStageRouting = {
  intensity_0_10: number;
  intensity_band: EmotionalIntensityBand;
  content_profile: EmotionalContentProfile;
  risk_level: RiskLevel | null;
  risk_action: RiskAction | null;
  presenting_concern: string | null;
  existing_strengths: string[];
  strengths_signal: 'strong' | 'moderate' | 'weak';
  uncertainties_count: number;
  clarity_over_action: boolean;
  exploration_high: string[];
  exploration_low: string[];
  lower_signal_themes: string[];
  modifiers: EmotionalStageModifier[];
  coach: {
    preferred_tone: string;
    avoid_tone: string;
    action_size: 'tiny' | 'small' | 'standard' | 'growth';
    max_estimated_minutes: number;
  };
  rituals: {
    morning_mode_cap: RitualMode;
    evening_mode_cap: EveningMode;
    breathing_preference: BreathingType;
    allow_deep_mode: boolean;
    allow_high_performance_tone: boolean;
  };
  exercises: {
    prefer_blockers: MindsetBlockerKind[];
    avoid_blockers: MindsetBlockerKind[];
  };
  content_rules: string[];
};

const MODE_RANK: Record<RitualMode, number> = {quick: 0, standard: 1, deep: 2};
const EVENING_RANK: Record<EveningMode, number> = {quick: 0, standard: 1, deep: 2};

function intensityBand(intensity: number): EmotionalIntensityBand {
  if (intensity <= 3) return 'low';
  if (intensity <= 7) return 'moderate';
  return 'high';
}

function profileFromBand(
  band: EmotionalIntensityBand,
  riskLevel: RiskLevel | null
): EmotionalContentProfile {
  if (riskLevel === 'crisis' || riskLevel === 'elevated') return 'gentle_safety';
  if (band === 'low') return 'growth_focus';
  if (band === 'moderate') return 'regulation_clarity';
  return 'gentle_safety';
}

function strengthPattern(locale: AppLocale): RegExp {
  return locale === 'he'
    ? /כוח|חזק|מחזיק|ערכ|תקווה|יודע|מסוגל|משאב/i
    : /strength|capable|hope|value|holds me|resilien|resource/i;
}

function assessStrengthsSignal(
  strengths: string[],
  explorationHigh: Array<{text: string; score: number}>,
  explorationLow: Array<{text: string; score: number}>,
  locale: AppLocale
): 'strong' | 'moderate' | 'weak' {
  const re = strengthPattern(locale);
  const meaningful = strengths.filter((s) => s.trim().length >= 8);
  const highHits = explorationHigh.filter((e) => re.test(e.text) && e.score >= 4).length;
  const lowHits = explorationLow.filter((e) => re.test(e.text)).length;

  if (meaningful.length >= 2 || highHits >= 2) return 'strong';
  if (meaningful.length >= 1 || highHits >= 1 || lowHits >= 1) return 'moderate';
  return 'weak';
}

function resolveIntensity(session: FormulationSessionResponse): number {
  const approved = session.formulation_approved?.intensity_0_10;
  if (typeof approved === 'number' && approved >= 0) return Math.min(10, Math.max(0, approved));
  return buildFormulationInsights(session, session.locale).overall_intensity_0_10;
}

function buildContentRules(
  profile: EmotionalContentProfile,
  modifiers: EmotionalStageModifier[],
  locale: AppLocale
): string[] {
  const base: Record<EmotionalContentProfile, string[]> =
    locale === 'he'
      ? {
          growth_focus: [
            'עומס נמוך — תוכן צמיחה ומיקוד: אתגרים קטנים-בינוניים, הרחבה, לא רק ויסות.',
          ],
          regulation_clarity: [
            'עומס בינוני — ויסות, בהירות וצעדים קטנים; לא לדחוף אתגרים גדולים.',
          ],
          gentle_safety: [
            'עומס גבוה או סיכון — תוכן רך, safety-aware; בלי אתגרים אגרסיביים או לחץ לביצוע.',
          ],
        }
      : {
          growth_focus: [
            'Lower load — growth/focus content: small-to-medium stretch, expansion, not only regulation.',
          ],
          regulation_clarity: [
            'Moderate load — regulation, clarity, and tiny steps; no big pushes.',
          ],
          gentle_safety: [
            'High load or elevated risk — soft, safety-aware content; no aggressive challenges or pressure.',
          ],
        };

  const rules = [...base[profile]];
  if (modifiers.includes('activate_strengths')) {
    rules.push(
      locale === 'he'
        ? 'חוזקות קיימות חזקות — הפעל/י משאבים וחוזקות, לא רק תיקון חולשות.'
        : 'Strong existing strengths — activate resources and strengths, not only fixing deficits.'
    );
  }
  if (modifiers.includes('clarity_over_action')) {
    rules.push(
      locale === 'he'
        ? 'הרבה אי-ודאות — תוכן שמייצר בהירות ומסגור; לא פעולה קשה או מחייבת.'
        : 'Many uncertainties — clarity and framing first; not hard or demanding action.'
    );
  }
  if (modifiers.includes('risk_safety_cap')) {
    rules.push(
      locale === 'he'
        ? 'מסך סיכון — עדיפות לבטיחות, משאבי עזרה, וקצב רך.'
        : 'Risk screen — prioritize safety, support resources, and gentle pacing.'
    );
  }
  return rules;
}

function coachAdjustments(
  profile: EmotionalContentProfile,
  modifiers: EmotionalStageModifier[],
  locale: AppLocale
): EmotionalStageRouting['coach'] {
  const he = locale === 'he';
  const clarity = modifiers.includes('clarity_over_action');

  if (profile === 'gentle_safety') {
    return {
      preferred_tone: he ? 'רך, מייצב, לא שיפוטי' : 'soft, stabilizing, non-judgmental',
      avoid_tone: he ? 'אגרסיבי, "תזוז/י עכשיו", השוואה' : 'aggressive, "move now", comparison',
      action_size: clarity ? 'tiny' : 'small',
      max_estimated_minutes: clarity ? 3 : 5,
    };
  }
  if (profile === 'regulation_clarity') {
    return {
      preferred_tone: he ? 'מבהיר, מעשי, צעד-אחר-צעד' : 'clarifying, practical, step-by-step',
      avoid_tone: he ? 'היפ מוטיבציה, אתגר גדול' : 'hype motivation, big challenge',
      action_size: clarity ? 'small' : 'standard',
      max_estimated_minutes: clarity ? 5 : 10,
    };
  }
  return {
    preferred_tone: he
      ? modifiers.includes('activate_strengths')
        ? 'ממוקד חוזקות, מעודד התקדמות'
        : 'ממוקד, מעודד צמיחה'
      : modifiers.includes('activate_strengths')
        ? 'strength-forward, encouraging progress'
        : 'focused, growth-oriented',
    avoid_tone: he ? 'רק ויסות בלי כיוון' : 'regulation-only with no direction',
    action_size: clarity ? 'small' : 'growth',
    max_estimated_minutes: clarity ? 8 : 15,
  };
}

function ritualAdjustments(
  profile: EmotionalContentProfile,
  riskLevel: RiskLevel | null
): EmotionalStageRouting['rituals'] {
  const riskCap = riskLevel === 'crisis' || riskLevel === 'elevated';

  if (profile === 'gentle_safety' || riskCap) {
    return {
      morning_mode_cap: 'quick',
      evening_mode_cap: 'quick',
      breathing_preference: 'calm',
      allow_deep_mode: false,
      allow_high_performance_tone: false,
    };
  }
  if (profile === 'regulation_clarity') {
    return {
      morning_mode_cap: 'standard',
      evening_mode_cap: 'standard',
      breathing_preference: 'calm',
      allow_deep_mode: false,
      allow_high_performance_tone: false,
    };
  }
  return {
    morning_mode_cap: 'deep',
    evening_mode_cap: 'deep',
    breathing_preference: 'default',
    allow_deep_mode: true,
    allow_high_performance_tone: true,
  };
}

function exerciseAdjustments(
  profile: EmotionalContentProfile,
  modifiers: EmotionalStageModifier[]
): EmotionalStageRouting['exercises'] {
  if (profile === 'gentle_safety') {
    return {
      prefer_blockers: ['guilt', 'low_control', 'self_criticism'],
      avoid_blockers: ['avoidance'],
    };
  }
  if (profile === 'regulation_clarity') {
    return {
      prefer_blockers: ['self_criticism', 'low_control', 'guilt'],
      avoid_blockers: modifiers.includes('clarity_over_action') ? ['avoidance'] : [],
    };
  }
  if (modifiers.includes('activate_strengths')) {
    return {
      prefer_blockers: ['low_control', 'self_criticism'],
      avoid_blockers: [],
    };
  }
  return {
    prefer_blockers: ['avoidance', 'self_criticism', 'low_control', 'guilt'],
    avoid_blockers: [],
  };
}

export function buildEmotionalStageRouting(
  session: FormulationSessionResponse,
  locale: AppLocale = session.locale
): EmotionalStageRouting {
  const insights = buildFormulationInsights(session, locale);
  const approved = session.formulation_approved;
  const intensity = resolveIntensity(session);
  const band = intensityBand(intensity);
  const riskLevel = approved?.risk_screen?.level ?? session.risk_level ?? null;
  const riskAction = approved?.risk_screen?.action ?? session.risk_action ?? null;

  let profile = profileFromBand(band, riskLevel);
  const modifiers: EmotionalStageModifier[] = [];

  if (riskLevel === 'crisis' || riskLevel === 'elevated' || riskAction === 'stop') {
    modifiers.push('risk_safety_cap');
    profile = 'gentle_safety';
  }

  const strengths = (approved?.existing_strengths ?? []).filter(Boolean);
  const strengthsSignal = assessStrengthsSignal(
    strengths,
    insights.exploration_high,
    insights.exploration_low,
    locale
  );
  if (strengthsSignal === 'strong') {
    modifiers.push('activate_strengths');
  }

  const uncertainties = (approved?.uncertainties ?? []).filter(Boolean);
  const clarityOverAction =
    uncertainties.length >= 2 ||
    (uncertainties.length >= 1 && insights.exploration_low.length >= 3);
  if (clarityOverAction) {
    modifiers.push('clarity_over_action');
  }

  const routing: EmotionalStageRouting = {
    intensity_0_10: intensity,
    intensity_band: band,
    content_profile: profile,
    risk_level: riskLevel,
    risk_action: riskAction,
    presenting_concern:
      approved?.presenting_concern_user_words?.trim() ??
      session.presenting_concern_user_words?.trim() ??
      insights.one_line_concern ??
      null,
    existing_strengths: strengths.slice(0, 4),
    strengths_signal: strengthsSignal,
    uncertainties_count: uncertainties.length,
    clarity_over_action: clarityOverAction,
    exploration_high: insights.exploration_high.slice(0, 4).map((e) => e.text),
    exploration_low: insights.exploration_low.slice(0, 4).map((e) => e.text),
    lower_signal_themes: insights.lower_signal_themes.slice(0, 4).map((t) => t.label),
    modifiers,
    coach: coachAdjustments(profile, modifiers, locale),
    rituals: ritualAdjustments(profile, riskLevel),
    exercises: exerciseAdjustments(profile, modifiers),
    content_rules: buildContentRules(profile, modifiers, locale),
  };

  return locale === 'he'
    ? resolveGenderedDeep(routing, session.participant_gender)
    : routing;
}

export function emotionalStageForPrompt(routing: EmotionalStageRouting): Record<string, unknown> {
  return {
    intensity_0_10: routing.intensity_0_10,
    intensity_band: routing.intensity_band,
    content_profile: routing.content_profile,
    risk_level: routing.risk_level,
    risk_action: routing.risk_action,
    presenting_concern: routing.presenting_concern,
    existing_strengths: routing.existing_strengths,
    strengths_signal: routing.strengths_signal,
    uncertainties_count: routing.uncertainties_count,
    clarity_over_action: routing.clarity_over_action,
    exploration_high: routing.exploration_high,
    exploration_low: routing.exploration_low,
    lower_signal_themes: routing.lower_signal_themes,
    modifiers: routing.modifiers,
    content_rules: routing.content_rules,
    coach: routing.coach,
    rituals: routing.rituals,
    exercises: routing.exercises,
  };
}

export function coachPromptBlockForEmotionalStage(
  routing: EmotionalStageRouting | null,
  locale: AppLocale
): string {
  if (!routing) return '';
  const rules = routing.content_rules.map((r) => `- ${r}`).join('\n');
  return locale === 'he'
    ? `\n## שלב רגשי (formulation):\n${rules}\nטון מועדף: ${routing.coach.preferred_tone}. להימנע: ${routing.coach.avoid_tone}. גודל פעולה: ${routing.coach.action_size}.`
    : `\n## Emotional stage (formulation):\n${rules}\nPreferred tone: ${routing.coach.preferred_tone}. Avoid: ${routing.coach.avoid_tone}. Action size: ${routing.coach.action_size}.`;
}

export function selectMindsetBlockerForEmotionalStage(
  rankedBlockers: Array<{blocker: MindsetBlockerKind; weight: number}>,
  routing: EmotionalStageRouting | null
): MindsetBlockerKind | null {
  if (!routing || rankedBlockers.length === 0) return rankedBlockers[0]?.blocker ?? null;

  const avoid = new Set(routing.exercises.avoid_blockers);
  const prefer = routing.exercises.prefer_blockers;

  for (const blocker of prefer) {
    const hit = rankedBlockers.find((r) => r.blocker === blocker && !avoid.has(blocker));
    if (hit) return hit.blocker;
  }

  const filtered = rankedBlockers.filter((r) => !avoid.has(r.blocker));
  return filtered[0]?.blocker ?? rankedBlockers[0]?.blocker ?? null;
}

export function capMorningRitualMode(
  mode: RitualMode,
  routing: EmotionalStageRouting | null
): RitualMode {
  if (!routing) return mode;
  const cap = routing.rituals.morning_mode_cap;
  return MODE_RANK[mode] > MODE_RANK[cap] ? cap : mode;
}

export function capEveningRitualMode(
  mode: EveningMode,
  routing: EmotionalStageRouting | null
): EveningMode {
  if (!routing) return mode;
  const cap = routing.rituals.evening_mode_cap;
  return EVENING_RANK[mode] > EVENING_RANK[cap] ? cap : mode;
}

export function resolveBreathingForEmotionalStage(
  routing: EmotionalStageRouting | null,
  lifeContexts: LifeContextStatus[] | null | undefined,
  tone: MorningRitualTone
): BreathingType {
  if (tone === 'restart_gently') return 'calm';
  if (routing && !routing.rituals.allow_high_performance_tone && tone === 'high_performance') {
    return routing.rituals.breathing_preference;
  }
  if (tone === 'high_performance' && routing?.rituals.allow_high_performance_tone) {
    return 'energy';
  }
  if (routing?.content_profile === 'gentle_safety') return 'calm';
  if (routing?.content_profile === 'regulation_clarity') return 'calm';
  return routing?.rituals.breathing_preference ?? defaultBreathingType(lifeContexts);
}

export function capMorningToneForEmotionalStage(
  tone: MorningRitualTone,
  routing: EmotionalStageRouting | null
): MorningRitualTone {
  if (!routing) return tone;
  if (!routing.rituals.allow_high_performance_tone && tone === 'high_performance') {
    return 'steady';
  }
  if (routing.content_profile === 'gentle_safety' && tone !== 'restart_gently') {
    return 'restart_gently';
  }
  return tone;
}

export function suggestedMorningModeWithEmotionalStage(
  baseMode: RitualMode,
  routing: EmotionalStageRouting | null
): RitualMode {
  const capped = capMorningRitualMode(baseMode, routing);
  if (routing?.content_profile === 'gentle_safety') return 'quick';
  if (!routing?.rituals.allow_deep_mode && capped === 'deep') return 'standard';
  return capped;
}

export function coachEasyOnlyForEmotionalStage(routing: EmotionalStageRouting | null): boolean {
  if (!routing) return false;
  return (
    routing.content_profile === 'gentle_safety' ||
    routing.clarity_over_action ||
    routing.intensity_band === 'high'
  );
}
