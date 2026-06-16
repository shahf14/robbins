import type {AppLocale} from '@/i18n/config';
import {
  buildFormulationInsights,
  type FormulationInsights,
} from '@/lib/formulation/formulation-insights';
import {buildMindsetExerciseRecommendation} from '@/lib/formulation/mindset-exercises';
import {shortThemeLabel} from '@/lib/formulation/theme-phrases';
import type {MicroGoalOption} from '@/lib/formulation/micro-goal-options';
import type {FormulationSession} from '@/lib/life-coach/types';

const STOP_WORDS =
  /^(של|עם|את|על|זה|מה|איך|לא|גם|כי|the|and|for|with|that|this|from|your|you|are|was|were|have|has)$/i;

const GENERIC_WELLNESS =
  /מדיטצ|meditat|mindful|נשימ|breathwork|breathing exercise|sleep hygiene|שיפור.?שינה|better sleep|לפני.?שינה|before bed/i;

function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

function optionBlob(option: MicroGoalOption): string {
  return normalizeText(
    [option.title, option.value, option.micro_goal_week, option.why_this_exercise ?? ''].join(' ')
  );
}

function significantTokens(text: string, minLen = 3): string[] {
  return [
    ...new Set(
      text
        .split(/[\s,.;:·\-–—/|]+/)
        .map((w) => w.replace(/[^\p{L}\p{N}]/gu, '').trim())
        .filter((w) => w.length >= minLen && !STOP_WORDS.test(w))
    ),
  ];
}

function overlapCount(blob: string, tokens: string[]): number {
  if (tokens.length === 0) return 0;
  return tokens.filter((token) => blob.includes(normalizeText(token))).length;
}

function suppressionPatternsForId(id: string): RegExp[] {
  const patterns: RegExp[] = [];
  if (id.includes('sleep') || id.includes('parent_sleep')) {
    patterns.push(/שינה|sleep|bedtime|לפני.?ה?שינה|before bed|bed earlier/i);
  }
  if (id.includes('worry') || id.includes('anxiety') || id.includes('exam')) {
    patterns.push(/דאג|worry|anxiet|חרד|stress/i);
  }
  if (id.includes('work') || id.includes('manager') || id.includes('student')) {
    patterns.push(/עבוד|work|deadline|לימוד|study|exam/i);
  }
  if (id.includes('relationship') || id.includes('partner')) {
    patterns.push(/זוג|relationship|partner|בן.?זוג/i);
  }
  if (id.includes('self_criticism') || id.includes('self_talk')) {
    patterns.push(/ביקורת.?עצמ|self.?crit/i);
  }
  if (id.includes('avoidance')) {
    patterns.push(/הימנע|avoid|procrastin|דחי/i);
  }
  if (id.includes('control')) {
    patterns.push(/שליט|control|helpless/i);
  }
  if (id.includes('financial') || id.includes('provider') || id.includes('between_jobs')) {
    patterns.push(/כסף|money|financial|פרנס|provider|between.?jobs/i);
  }
  if (id.includes('energy') || id.includes('day_energy')) {
    patterns.push(/אנרג|energy|עייפ|fatigue|tired/i);
  }
  if (id.includes('mood') || id.includes('low_mood')) {
    patterns.push(/מצב.?רוח|low mood|depress|עצב/i);
  }
  return patterns;
}

function optionCentersSuppressedTheme(
  option: MicroGoalOption,
  suppressedId: string,
  suppressedLabel: string
): boolean {
  const blob = optionBlob(option);
  const patterns = [
    ...suppressionPatternsForId(suppressedId),
    ...significantTokens(suppressedLabel, 4).map(
      (token) => new RegExp(token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    ),
  ];
  return patterns.some((pattern) => pattern.test(blob));
}

function burningAnchorTokens(insights: FormulationInsights, locale: AppLocale): string[] {
  const fromThemes = insights.burning_now_themes
    .slice(0, 3)
    .flatMap((t) => [shortThemeLabel(t.id, locale), t.label, t.statement_label]);
  const fromFocus = [insights.primary_goal_focus, insights.one_line_concern];
  return significantTokens(fromFocus.concat(fromThemes).join(' '), 3);
}

export type GoalAlignmentContext = {
  burning_focus_anchor: string;
  practical_must_reduce: string;
  mindset_must_address: string[];
  mindset_exercise_hint: string | null;
  freestyle_open_on: {
    uncertainties: string[];
    secondary_themes: string[];
  };
  suppressed_do_not_center: Array<{
    id: string;
    label: string;
    chip_answer: string;
  }>;
  slot_rules: {
    practical: string;
    mindset: string;
    freestyle: string;
    forbidden: string;
  };
};

export function buildGoalAlignmentContext(
  session: FormulationSession,
  locale: AppLocale
): GoalAlignmentContext {
  const insights = buildFormulationInsights(session, locale);
  const approved = session.formulation_approved;
  const mindset = buildMindsetExerciseRecommendation(session, locale);

  const burning_focus_anchor =
    insights.burning_now_themes[0]?.label ??
    approved?.presenting_concern_user_words ??
    insights.primary_goal_focus;

  const maintaining = (approved?.maintaining_factors ?? []).filter(Boolean).slice(0, 4);
  const uncertainties = (approved?.uncertainties ?? []).filter(Boolean).slice(0, 4);

  const slot_rules =
    locale === 'he'
      ? {
          practical:
            'goal_type=practical חייב להפחית את burning_focus — פעולה שבועית קונקרטית שקשורה למה שבוער.',
          mindset:
            'goal_type=mindset חייב לעבוד על maintaining_factors (או mindset_exercise_recommendation) — לא על burning_focus ישירות.',
          freestyle:
            'goal_type=freestyle (×3) — כל אחד פותח שיחה על uncertainty אחרת או secondary_goal_theme; לא לחזור על practical/mindset.',
          forbidden:
            'אסור למרכז נושא מ-suppressed_do_not_center — גם אם דירוג שלב 3 היה גבוה.',
        }
      : {
          practical:
            'goal_type=practical must reduce burning_focus — one concrete weekly action tied to what is flaring.',
          mindset:
            'goal_type=mindset must address maintaining_factors (or mindset_exercise_recommendation) — not burning_focus directly.',
          freestyle:
            'goal_type=freestyle (×3) — each opens coach/chat on a different uncertainty or secondary_goal_theme.',
          forbidden:
            'Never center a theme from suppressed_do_not_center — even if Phase-3 rating was high.',
        };

  return {
    burning_focus_anchor,
    practical_must_reduce: burning_focus_anchor,
    mindset_must_address: maintaining,
    mindset_exercise_hint: mindset.recommended_exercise.why_this_exercise,
    freestyle_open_on: {
      uncertainties,
      secondary_themes: insights.secondary_goal_themes.slice(0, 4),
    },
    suppressed_do_not_center: insights.suppressed_by_chips.map((s) => ({
      id: s.id,
      label: s.label,
      chip_answer: s.chip_answer,
    })),
    slot_rules,
  };
}

export function validateGoalSlotAlignment(
  options: MicroGoalOption[],
  session: FormulationSession,
  locale: AppLocale,
  burningFocus?: string
): boolean {
  const insights = buildFormulationInsights(session, locale);
  const approved = session.formulation_approved;
  const burningIds = new Set(insights.burning_now_themes.map((t) => t.id));

  for (const option of options) {
    for (const suppressed of insights.suppressed_by_chips) {
      if (burningIds.has(suppressed.id)) continue;
      if (optionCentersSuppressedTheme(option, suppressed.id, suppressed.label)) {
        return false;
      }
    }

    if (GENERIC_WELLNESS.test(optionBlob(option))) {
      const sleepAllowed =
        insights.burning_now_themes.some((t) => t.id.includes('sleep')) &&
        !insights.suppressed_by_chips.some((s) => s.id.includes('sleep'));
      if (!sleepAllowed) return false;
    }
  }

  const practical = options.find((o) => o.goal_type === 'practical');
  const mindset = options.find((o) => o.goal_type === 'mindset');
  const freestyles = options.filter((o) => o.goal_type === 'freestyle');

  if (practical) {
    const anchorTokens = significantTokens(
      [burningFocus, insights.primary_goal_focus, ...burningAnchorTokens(insights, locale)].join(
        ' '
      ),
      3
    );
    const requiredOverlap = anchorTokens.length <= 2 ? 1 : 2;
    if (overlapCount(optionBlob(practical), anchorTokens) < requiredOverlap) {
      return false;
    }
  }

  if (mindset && approved?.maintaining_factors?.length) {
    const maintainingTokens = significantTokens(approved.maintaining_factors.join(' '), 4);
    const mindsetBlob = optionBlob(mindset);
    const mindsetOk =
      overlapCount(mindsetBlob, maintainingTokens) >= 1 ||
      !!mindset.why_this_exercise?.trim();
    if (!mindsetOk) return false;
  }

  const openPool = [
    ...(approved?.uncertainties ?? []),
    ...insights.secondary_goal_themes,
  ].filter(Boolean);

  if (freestyles.length >= 3 && openPool.length >= 2) {
    const matched = freestyles.filter(
      (option) => overlapCount(optionBlob(option), significantTokens(openPool.join(' '), 4)) >= 1
    );
    if (matched.length < 2) return false;
  }

  return true;
}

export function goalAlignmentForPrompt(ctx: GoalAlignmentContext): Record<string, unknown> {
  return {
    burning_focus_anchor: ctx.burning_focus_anchor,
    practical_must_reduce: ctx.practical_must_reduce,
    mindset_must_address: ctx.mindset_must_address,
    mindset_exercise_hint: ctx.mindset_exercise_hint,
    freestyle_open_on: ctx.freestyle_open_on,
    suppressed_do_not_center: ctx.suppressed_do_not_center,
    slot_rules: ctx.slot_rules,
  };
}
