import type {AppLocale} from '@/i18n/config';
import {
  buildFallbackFormulationFromInsights,
  buildFormulationInsights,
  goalReadyLabel,
} from '@/lib/formulation/formulation-insights';
import {getPolarityForQuestionId} from '@/lib/formulation/guided-questions';
import type {FormulationApproved, FormulationSession} from '@/lib/life-coach/types';

function normalizeList(items: string[]): string {
  return items
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)
    .sort()
    .join('|');
}

function listsAreDuplicate(a: string[], b: string[]): boolean {
  if (a.length < 2 || b.length < 2) return false;
  return normalizeList(a) === normalizeList(b);
}

function centralRepeatsLists(central: string, stressors: string[], maintaining: string[]): boolean {
  const c = central.trim().toLowerCase();
  if (!c) return false;
  const blob = [...stressors, ...maintaining].join(' · ').toLowerCase();
  return blob.length > 20 && c === blob;
}

/** Reject lazy copy-paste drafts; align core with chip-filtered synthesis. */
export function refineFormulationDraft(
  draft: FormulationApproved,
  session: FormulationSession,
  locale: AppLocale
): FormulationApproved {
  const insights = buildFormulationInsights(session, locale);
  const fallback = buildFallbackFormulationFromInsights(session, locale);

  const lazyCopy =
    listsAreDuplicate(draft.stressors, draft.maintaining_factors) ||
    centralRepeatsLists(
      draft.presenting_concern_user_words,
      draft.stressors,
      draft.maintaining_factors
    );

  if (lazyCopy) {
    return fallback;
  }

  const suppressedLabels = new Set(
    insights.suppressed_by_chips.map((s) => s.label.toLowerCase())
  );

  const mentionsSuppressed = (text: string) => {
    const lower = text.toLowerCase();
    for (const label of suppressedLabels) {
      if (label.length > 4 && lower.includes(label.slice(0, Math.min(24, label.length)))) {
        return true;
      }
    }
    return false;
  };

  if (mentionsSuppressed(draft.presenting_concern_user_words)) {
    return {
      ...draft,
      presenting_concern_user_words: fallback.presenting_concern_user_words,
      stressors: draft.stressors.filter((s) => !mentionsSuppressed(s)),
      maintaining_factors: draft.maintaining_factors.filter((s) => !mentionsSuppressed(s)),
    };
  }

  const topBurning = insights.burning_now_themes[0];
  const coreLooksPositive =
    topBurning &&
    getPolarityForQuestionId(topBurning.id) === 'positive' &&
    topBurning.score <= 2 &&
    draft.presenting_concern_user_words.includes(topBurning.statement_label);

  if (coreLooksPositive) {
    return {
      ...draft,
      presenting_concern_user_words: goalReadyLabel(topBurning, locale),
    };
  }

  return draft;
}
