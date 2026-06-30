import type {AppLocale} from '@/i18n/config';
import {
  buildChipFlareState,
  chipAnswerDisplayLabel,
  parseChipSeverity,
} from '@/lib/formulation/chip-flare-filter';
import {getGuidedQuestionBody, getGuidedQuestionById} from '@/lib/formulation/guided-questions';
import {difficultyLabelFromRating} from '@/lib/formulation/rating-difficulty-label';
import {shortThemeLabel} from '@/lib/formulation/theme-phrases';
import {
  distressWeight,
  overallIntensityFromRatings,
  type PassiveRatingItem,
} from '@/lib/formulation/passive-ratings';
import type {MicroGoalSuggestion} from '@/lib/ai-formulation/prompts';
import {formatLifeContextLabels} from '@/lib/life-context-labels';
import type {FormulationSessionResponse} from '@/lib/life-coach/response-dtos';
import type {FormulationApproved, FormulationSession} from '@/lib/life-coach/types';

export type RatedThemeInsight = {
  id: string;
  /** Phenomenological label for synthesis (polarity-aware). */
  label: string;
  /** Raw step-3 statement text. */
  statement_label: string;
  score: number;
  distress_weight: number;
};

type SuppressedThemeInsight = {
  id: string;
  label: string;
  step3_score: number;
  chip_answer: string;
};

export type FormulationInsights = {
  locale: AppLocale;
  life_context_labels: string[];
  overall_intensity_0_10: number;
  /** Step 3 only — raw weighted distress (may contradict step 4). */
  step3_distress_themes: RatedThemeInsight[];
  /** After step 4 chip filter — use for goals & formulation core. */
  burning_now_themes: RatedThemeInsight[];
  /** High in step 3 but "בכלל לא" on matching step-4 chip. */
  suppressed_by_chips: SuppressedThemeInsight[];
  /** Themes user did NOT strongly endorse in step 3 (weight <= 2). */
  lower_signal_themes: RatedThemeInsight[];
  exploration_high: Array<{id: string; text: string; score: number}>;
  exploration_low: Array<{id: string; text: string; score: number}>;
  chip_follow_ups: Array<{
    question_key: string | null;
    answer: string;
    chip: string;
    rating_ids: string[];
  }>;
  chip_filter_rule: string;
  one_line_concern: string;
  cross_cutting_narrative: string;
  primary_goal_focus: string;
  secondary_goal_themes: string[];
  deprioritize_for_goals: string[];
  /** @deprecated use burning_now_themes */
  top_distress_themes: RatedThemeInsight[];
};

function statementLabelForRating(id: string, locale: AppLocale): string {
  const q = getGuidedQuestionById(id);
  return q ? getGuidedQuestionBody(q, locale).replace(/\.$/, '') : shortThemeLabel(id, locale);
}

function ratedThemes(ratings: PassiveRatingItem[], locale: AppLocale): RatedThemeInsight[] {
  return ratings
    .map((r) => {
      const statement = statementLabelForRating(r.key, locale);
      return {
        id: r.key,
        label: difficultyLabelFromRating(r.key, r.score, locale),
        statement_label: statement,
        score: r.score,
        distress_weight: distressWeight(r.key, r.score),
      };
    })
    .sort((a, b) => b.distress_weight - a.distress_weight);
}

function explorationWithText(
  session: FormulationSessionResponse
): Array<{id: string; text: string; score: number}> {
  const byId = new Map(session.llm_exploration_questions.map((q) => [q.id, q.text]));
  return session.llm_exploration_answers.map((a) => ({
    id: a.key,
    text: byId.get(a.key) ?? a.key,
    score: a.score,
  }));
}

function applyChipFilter(
  step3: RatedThemeInsight[],
  chipState: ReturnType<typeof buildChipFlareState>,
  locale: AppLocale
): {
  burning: RatedThemeInsight[];
  suppressed: SuppressedThemeInsight[];
} {
  const suppressed: SuppressedThemeInsight[] = [];
  const burning: RatedThemeInsight[] = [];

  for (const t of step3) {
    if (t.distress_weight < 3) continue;

    if (chipState.suppressed_rating_ids.has(t.id)) {
      const entry = chipState.entries.find(
        (e) => e.source_rating_key === t.id && e.chip === 'not_at_all'
      );
      suppressed.push({
        id: t.id,
        label: t.label,
        step3_score: t.score,
        chip_answer: entry
          ? chipAnswerDisplayLabel(entry.chip, locale)
          : locale === 'he'
            ? 'בכלל לא'
            : 'not at all',
      });
      continue;
    }

    if (chipState.downgraded_rating_ids.has(t.id) && t.distress_weight < 4) {
      continue;
    }

    burning.push(t);
  }

  for (const id of chipState.confirmed_rating_ids) {
    const existing = burning.find((b) => b.id === id);
    const fromStep3 = step3.find((t) => t.id === id);
    if (!existing && fromStep3 && fromStep3.distress_weight >= 2) {
      burning.push(fromStep3);
    }
  }

  burning.sort((a, b) => b.distress_weight - a.distress_weight);

  return {burning, suppressed};
}

function primaryGoalFocus(
  burning: RatedThemeInsight[],
  explorationHigh: Array<{text: string; score: number}>,
  contexts: string[],
  locale: AppLocale
): {primary: string; secondary: string[]} {
  const themes = burning.slice(0, 4).map((t) => goalReadyLabel(t, locale));
  const explore = explorationHigh.slice(0, 2).map((e) => e.text.replace(/\.$/, '').slice(0, 90));

  if (locale === 'he') {
    const ctx = contexts.length ? `בהקשר של ${contexts.join(' ו-')}: ` : '';
    const primary =
      themes[0] ??
      (explore[0] ? explore[0] : 'מה שנראה משמעותי לפי שאלות הדיוק וההעמקה');
    return {
      primary: `${ctx}${primary}`,
      secondary: [...themes.slice(1, 3), ...explore.slice(0, 1)],
    };
  }

  const ctx = contexts.length ? `Given ${contexts.join(' + ')}: ` : '';
  const primary =
    themes[0] ?? (explore[0] ? explore[0] : 'what looks significant from the accuracy check and deeper reflection');
  return {
    primary: `${ctx}${primary}`,
    secondary: [...themes.slice(1, 3), ...explore.slice(0, 1)],
  };
}

function deprioritizeThemes(
  burning: RatedThemeInsight[],
  suppressed: SuppressedThemeInsight[],
  locale: AppLocale
): string[] {
  const burningIds = new Set(burning.map((t) => t.id));
  const out = suppressed.map((s) => s.label);

  return [...new Set(out)];
}

/** Phenomenological label safe for goals/core — never a misleading positive statement. */
export function goalReadyLabel(theme: RatedThemeInsight, locale: AppLocale): string {
  const inverted = difficultyLabelFromRating(theme.id, theme.score, locale);
  if (inverted !== theme.statement_label) return inverted;
  if (theme.label !== theme.statement_label) return theme.label;
  return inverted;
}

export function buildReflectionFromInsights(
  insights: FormulationInsights,
  locale: AppLocale
): string {
  const themes = insights.burning_now_themes
    .slice(0, 4)
    .map((t) => goalReadyLabel(t, locale).replace(/\.$/, ''))
    .filter(Boolean);

  if (!themes.length) {
    return locale === 'he'
      ? 'עדיין אין מספיק נתונים לשיקוף אחרי הבהרה.'
      : 'Not enough clarified data for reflection yet.';
  }

  const summary = themes.join(locale === 'he' ? ' · ' : ' · ');
  if (locale === 'he') {
    return `מה שנראה משמעותי כרגע אחרי ההבהרה: ${summary}. זו נקודת פתיחה — לא אבחון.`;
  }
  return `What looks significant right now after clarification: ${summary}. This is a starting point — not a diagnosis.`;
}

/** Sync one-line concern + reflection with chip-filtered synthesis (steps 4+). */
export function syncSessionNarrativeFromInsights(session: FormulationSession): void {
  if (session.passive_ratings.length === 0) return;

  const insights = buildFormulationInsights(session, session.locale);
  const hasChipAnswers = session.prior_question_answers.length > 0;
  const hasExplorationAnswers = session.llm_exploration_answers.length > 0;

  if ((hasChipAnswers || hasExplorationAnswers) && insights.burning_now_themes.length > 0) {
    session.presenting_concern_user_words = insights.one_line_concern;
    session.presenting_concern_raw = insights.one_line_concern;
    session.reflection_llm_text = buildReflectionFromInsights(insights, session.locale);
    return;
  }

  if (hasChipAnswers || hasExplorationAnswers) {
    session.reflection_llm_text = buildReflectionFromInsights(insights, session.locale);
  }
}

function classifyExploration(
  explorationHigh: Array<{text: string; score: number}>,
  locale: AppLocale
): {triggers: string[]; maintaining: string[]; strengths: string[]} {
  const triggers: string[] = [];
  const maintaining: string[] = [];
  const strengths: string[] = [];

  const triggerRe =
    locale === 'he'
      ? /השווא|ביקורת|לחץ|דאג|מתח|אשמה|עומס|חרד|כבד/i
      : /compar|critici|pressure|worry|guilt|overload|anxiet|heavy/i;
  const maintainRe =
    locale === 'he'
      ? /הימנע|עתיד|שאלות|שליטה|לבקש עזרה|לא ברור|קשה ל/i
      : /avoid|future|control|ask for help|unclear|hard to/i;
  const strengthRe =
    locale === 'he'
      ? /כוח|חשוב לי שלא|מחזיק|רגעים ש|מודע/i
      : /strength|holds me|matters to me not to lose|notice.*moment|aware/i;

  for (const e of explorationHigh) {
    const line = e.text.replace(/\.$/, '').trim();
    if (!line) continue;
    if (strengthRe.test(line)) {
      strengths.push(line);
    } else if (maintainRe.test(line)) {
      maintaining.push(line);
    } else if (triggerRe.test(line)) {
      triggers.push(line);
    }
  }

  return {triggers, maintaining, strengths};
}

export function buildFormulationInsights(
  session: FormulationSessionResponse,
  locale: AppLocale
): FormulationInsights {
  const contexts = formatLifeContextLabels(session.life_context_statuses, locale);

  const chipState = buildChipFlareState(session, locale);
  const allRated = ratedThemes(session.passive_ratings, locale);
  const step3_distress_themes = allRated.filter((t) => t.distress_weight >= 3).slice(0, 8);
  const {burning: burning_now_themes, suppressed: suppressed_by_chips} = applyChipFilter(
    allRated,
    chipState,
    locale
  );

  const lower_signal_themes = allRated.filter((t) => t.distress_weight <= 2).slice(0, 6);

  const exploration = explorationWithText(session);
  const exploration_high = [...exploration]
    .filter((e) => e.score >= 4)
    .sort((a, b) => b.score - a.score)
    .slice(0, 8);
  const exploration_low = [...exploration]
    .filter((e) => e.score <= 2)
    .sort((a, b) => a.score - b.score)
    .slice(0, 5);

  const chip_follow_ups = session.prior_question_answers.map((a) => {
    const meta = session.rating_follow_ups.find((f) => f.key === a.key);
    const chip = parseChipSeverity(a.answer, locale);
    const entry = chipState.entries.find((e) => e.follow_up_key === a.key);
    const sourceKey = meta?.source_rating_key ?? entry?.source_rating_key ?? null;
    return {
      question_key: meta?.questionKey ?? null,
      answer: chipAnswerDisplayLabel(a.answer, locale),
      chip,
      source_rating_key: sourceKey,
      rating_ids: sourceKey ? [sourceKey] : [],
    };
  });

  const chip_filter_rule =
    locale === 'he'
      ? 'הסר ממיקוד ויעדים רק נושאים שנשאלו במפורש בשלב 4 והמשתמש ענה עליהם "בכלל לא". נושאים גבוהים משלב 3 שלא נשאלו בשלב 4 נשארים תקפים.'
      : 'Remove from focus and goals only themes explicitly checked in Phase 4 and answered "not at all". High Phase-3 themes not checked in Phase 4 remain valid.';

  const {primary, secondary} = primaryGoalFocus(
    burning_now_themes,
    exploration_high,
    contexts,
    locale
  );

  const one_line_concern = burning_now_themes.length > 0
    ? burning_now_themes
        .slice(0, 4)
        .map((t) => goalReadyLabel(t, locale).replace(/\.$/, ''))
        .join(locale === 'he' ? ' · ' : ' · ')
    : (locale === 'he' ? 'מה שנראה משמעותי כרגע לפי הנתונים' : 'What feels most significant based on your data');

  const cross_cutting_narrative =
    locale === 'he'
      ? [
          contexts.length ? `הקשר: ${contexts.join(', ')}.` : '',
          step3_distress_themes.length
            ? `שלב 3 (דירוג הצהרות): ${step3_distress_themes
                .slice(0, 4)
                .map((t) => `${t.label} (${t.score})`)
                .join('; ')}.`
            : '',
          suppressed_by_chips.length
            ? `שלב 4 — סומן כפחות רלוונטי עכשיו ("בכלל לא"): ${suppressed_by_chips
                .map((s) => s.label)
                .join('; ')}.`
            : '',
          burning_now_themes.length
            ? `נראה משמעותי כרגע אחרי בדיקת דיוק: ${burning_now_themes
                .slice(0, 5)
                .map((t) => t.label)
                .join('; ')}.`
            : '',
          exploration_high.length
            ? `שלב 5 — חזק במיוחד: ${exploration_high
                .slice(0, 3)
                .map((e) => `"${e.text}" (${e.score})`)
                .join('; ')}.`
            : '',
        ]
          .filter(Boolean)
          .join(' ')
      : [
          contexts.length ? `Context: ${contexts.join(', ')}.` : '',
          step3_distress_themes.length
            ? `Step 3 ratings: ${step3_distress_themes
                .slice(0, 4)
                .map((t) => `${t.label} (${t.score})`)
                .join('; ')}.`
            : '',
          suppressed_by_chips.length
            ? `Step 4 — marked as less relevant right now ("not at all"): ${suppressed_by_chips
                .map((s) => s.label)
                .join('; ')}.`
            : '',
          burning_now_themes.length
            ? `Looks significant right now after the accuracy check: ${burning_now_themes
                .slice(0, 5)
                .map((t) => t.label)
                .join('; ')}.`
            : '',
          exploration_high.length
            ? `Step 5 highs: ${exploration_high
                .slice(0, 3)
                .map((e) => `"${e.text}" (${e.score})`)
                .join('; ')}.`
            : '',
        ]
          .filter(Boolean)
          .join(' ');

  return {
    locale,
    life_context_labels: contexts,
    overall_intensity_0_10: overallIntensityFromRatings(session.passive_ratings),
    step3_distress_themes,
    burning_now_themes,
    suppressed_by_chips,
    lower_signal_themes,
    exploration_high,
    exploration_low,
    chip_follow_ups,
    chip_filter_rule,
    one_line_concern,
    cross_cutting_narrative,
    primary_goal_focus: primary,
    secondary_goal_themes: secondary,
    deprioritize_for_goals: deprioritizeThemes(burning_now_themes, suppressed_by_chips, locale),
    top_distress_themes: burning_now_themes,
  };
}

export function buildFallbackFormulationFromInsights(
  session: FormulationSession,
  locale: AppLocale
): FormulationApproved {
  const insights = buildFormulationInsights(session, locale);
  const classified = classifyExploration(insights.exploration_high, locale);

  const coreParts: string[] = [];
  const topTheme = insights.burning_now_themes[0];
  if (topTheme) coreParts.push(goalReadyLabel(topTheme, locale));
  const exploreLead = insights.exploration_high[0]?.text.replace(/\.$/, '');
  if (exploreLead) coreParts.push(exploreLead);

  const central =
    locale === 'he'
      ? coreParts.length >= 2
        ? `${coreParts[0]} — וגם ${(coreParts[1] ?? '').slice(0, 120)}`
        : (coreParts[0] ?? 'מה שנראה משמעותי כרגע לפי הנתונים')
      : coreParts.length >= 2
        ? `${coreParts[0]} — also ${(coreParts[1] ?? '').slice(0, 120)}`
        : (coreParts[0] ?? 'What looks significant right now based on your data');

  const stressors =
    classified.triggers.length > 0
      ? classified.triggers.slice(0, 4)
      : insights.burning_now_themes.slice(1, 4).map((t) => goalReadyLabel(t, locale));

  const maintaining =
    classified.maintaining.length > 0
      ? classified.maintaining.slice(0, 3)
      : locale === 'he'
        ? [
            'דאגות ושאלות על העתיד שתופסות מקום',
            'קושי לבקש עזרה או להאט',
          ]
        : ['Future worry taking space', 'Difficulty asking for help or slowing down'];

  const strengths =
    classified.strengths.length > 0
      ? classified.strengths.slice(0, 3)
      : locale === 'he'
        ? ['מודעות למה מכביד', 'רגעים של כוח גם בתוך העומס']
        : ['Awareness of what weighs on them', 'Moments of strength even under load'];

  return {
    presenting_concern_user_words: central,
    intensity_0_10: insights.overall_intensity_0_10,
    contexts: insights.life_context_labels,
    stressors: [...new Set(stressors)].filter((s) => s !== central),
    maintaining_factors: [...new Set(maintaining)],
    existing_strengths: [...new Set(strengths)],
    uncertainties:
      locale === 'he'
        ? ['מה הכי מחזיק את הקושי אם נשנה רק דבר אחד לאחרונה', 'איזה צעד קטן ירגיש אפשרי']
        : ['What matters most if only one thing changes lately', 'Which small step feels doable'],
    risk_screen: {
      level: session.risk_level ?? 'none',
      action: session.risk_action ?? 'continue',
    },
  };
}
