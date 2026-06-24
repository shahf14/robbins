import type {AppLocale} from '@/i18n/config';
import {chipAnswerDisplayLabel} from '@/lib/formulation/chip-flare-filter';
import {
  getGuidedQuestionBody,
  getGuidedQuestionById,
} from '@/lib/formulation/guided-questions';
import {buildFormulationInsights} from '@/lib/formulation/formulation-insights';
import type {WizardLiveDraft} from '@/lib/formulation/wizard-live-draft';
import type {FormulationSession, LifeContextStatus} from '@/lib/life-coach/types';
import enMessages from '../../../messages/en.json';
import heMessages from '../../../messages/he.json';

type FormulationMessages = (typeof heMessages)['formulation'];

function messagesFor(locale: AppLocale): FormulationMessages {
  return locale === 'he' ? heMessages.formulation : enMessages.formulation;
}

function contextLabel(status: LifeContextStatus, m: FormulationMessages): string {
  return m.consent.contexts[status] ?? status;
}

function genderLabel(gender: string | null, m: FormulationMessages): string {
  if (gender === 'female' || gender === 'male') {
    return m.consent.genderOptions[gender];
  }
  return gender ?? '—';
}

function riskAnswerLabel(value: number | null, m: FormulationMessages): string {
  if (value === 1) return m.risk.yes;
  if (value === 0) return m.risk.no;
  return '—';
}

function followUpQuestionLabel(questionKey: string, m: FormulationMessages): string {
  const key = questionKey.replace(/^followUps\./, '');
  const raw = m.followUps[key as keyof typeof m.followUps];
  return typeof raw === 'string' ? raw : questionKey;
}

function ratingLabel(id: string, locale: AppLocale): string {
  const q = getGuidedQuestionById(id);
  return q ? getGuidedQuestionBody(q, locale) : id;
}

function mergeFollowUpDraft(
  session: FormulationSession,
  draft?: WizardLiveDraft
): Array<{key: string; question: string; answer: string}> {
  const map = new Map<string, string>();
  for (const a of session.prior_question_answers) {
    map.set(a.key, a.answer);
  }
  for (const a of draft?.follow_up_answers ?? []) {
    if (a.answer.trim()) map.set(a.key, a.answer);
  }
  const labelByKey = new Map(
    session.rating_follow_ups.map((f) => [f.key, f.questionKey] as const)
  );
  const m = messagesFor(session.locale);
  const locale = session.locale;
  return [...map.entries()].map(([key, answer]) => ({
    key,
    question: labelByKey.has(key)
      ? followUpQuestionLabel(labelByKey.get(key)!, m)
      : key,
    answer: chipAnswerDisplayLabel(answer, locale),
  }));
}

function mergeExplorationAnswers(
  session: FormulationSession,
  draft?: WizardLiveDraft
): Array<{id: string; text: string; score: number | null}> {
  const byId = new Map(session.llm_exploration_questions.map((q) => [q.id, q.text]));
  const scores = new Map<string, number>();
  for (const a of session.llm_exploration_answers) {
    scores.set(a.key, a.score);
  }
  for (const a of draft?.llm_exploration_answers ?? []) {
    scores.set(a.key, a.score);
  }
  const ids =
    session.llm_exploration_questions.length === 15
      ? session.llm_exploration_questions.map((q) => q.id)
      : [...scores.keys()];
  return ids.map((id) => ({
    id,
    text: byId.get(id) ?? id,
    score: scores.has(id) ? scores.get(id)! : null,
  }));
}

function mergePassiveRatings(
  session: FormulationSession,
  draft?: WizardLiveDraft,
  locale?: AppLocale
): Array<{key: string; label: string; score: number | null}> {
  const loc = locale ?? session.locale;
  const scores = new Map<string, number>();
  for (const r of session.passive_ratings) {
    scores.set(r.key, r.score);
  }
  for (const r of draft?.passive_ratings ?? []) {
    scores.set(r.key, r.score);
  }
  const keys = [...new Set([...session.passive_ratings.map((r) => r.key), ...scores.keys()])];
  return keys
    .filter((k) => scores.has(k))
    .map((key) => ({
      key,
      label: ratingLabel(key, loc),
      score: scores.get(key) ?? null,
    }))
    .sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
}

export type FormulationExportDocument = {
  exported_at: string;
  locale: AppLocale;
  session: FormulationSession;
  live_draft: WizardLiveDraft | null;
  synthesis: ReturnType<typeof buildFormulationInsights>;
  markdown: string;
  json: string;
};

export function buildFormulationExportDocument(
  session: FormulationSession,
  locale: AppLocale,
  liveDraft?: WizardLiveDraft | null
): FormulationExportDocument {
  const m = messagesFor(locale);
  const insights = buildFormulationInsights(session, locale);
  const exportedAt = new Date().toISOString();
  const draft = liveDraft ?? null;

  const profileContexts = (draft?.consent?.life_context_statuses?.length
    ? draft.consent.life_context_statuses
    : session.life_context_statuses
  ).map((s) => contextLabel(s, m));

  const gender =
    draft?.consent?.gender ?? session.participant_gender;
  const age =
    draft?.consent?.age != null
      ? String(draft.consent.age)
      : session.participant_age != null
        ? String(session.participant_age)
        : '—';

  const ratings = mergePassiveRatings(session, draft ?? undefined, locale);
  const followUps = mergeFollowUpDraft(session, draft ?? undefined);
  const exploration = mergeExplorationAnswers(session, draft ?? undefined);

  const lines: string[] = [];

  const title = locale === 'he' ? '# ייצוא — הבהרה ויעד (Robbins)' : '# Export — Clarification & goal (Robbins)';
  lines.push(title);
  lines.push('');
  lines.push(
    locale === 'he'
      ? '> העתק/י את הקובץ הזה לצ\'אט אחר לייעוץ. זה כלי הבהרה — לא אבחון ולא טיפול.'
      : '> Paste this file into another chat for consultation. Clarification tool — not diagnosis or therapy.'
  );
  lines.push('');
  lines.push(`**${locale === 'he' ? 'מזהה סשן' : 'Session ID'}:** ${session.id}`);
  lines.push(`**${locale === 'he' ? 'תאריך ייצוא' : 'Exported at'}:** ${exportedAt}`);
  lines.push(`**${locale === 'he' ? 'שלב נוכחי' : 'Current phase'}:** ${session.current_phase}`);
  lines.push(`**${locale === 'he' ? 'סטטוס' : 'Status'}:** ${session.status}`);
  lines.push('');

  lines.push(locale === 'he' ? '## פרופיל והקשר' : '## Profile & context');
  lines.push(`- **${m.consent.lifeContext}:** ${profileContexts.join(' · ') || '—'}`);
  if (draft?.consent?.life_context_status_note || session.life_context_status_note) {
    lines.push(
      `- **${locale === 'he' ? 'הערה' : 'Note'}:** ${draft?.consent?.life_context_status_note ?? session.life_context_status_note}`
    );
  }
  lines.push(`- **${m.consent.gender}:** ${genderLabel(gender, m)}`);
  lines.push(`- **${m.consent.age}:** ${age}`);
  lines.push('');

  lines.push(locale === 'he' ? '## בטיחות' : '## Safety screen');
  lines.push(`- **${m.risk.q1}:** ${riskAnswerLabel(session.risk_q1, m)}`);
  lines.push(`- **${m.risk.q2}:** ${riskAnswerLabel(session.risk_q2, m)}`);
  if (session.risk_level) {
    lines.push(`- **${locale === 'he' ? 'רמה' : 'Level'}:** ${session.risk_level}`);
  }
  lines.push('');

  if (ratings.length > 0) {
    lines.push(
      locale === 'he'
        ? '## דירוגים — שלב 3 (1=לא מסכים · 5=מסכים בהחלט)'
        : '## Ratings — step 3 (1=disagree · 5=strongly agree)'
    );
    for (const r of ratings) {
      lines.push(`- [${r.score}/5] ${r.label}`);
    }
    lines.push('');
  }

  if (followUps.length > 0) {
    lines.push(locale === 'he' ? '## שאלות המשך — שלב 4 (צ\'יפים)' : '## Follow-ups — step 4 (chips)');
    lines.push(`*${insights.chip_filter_rule}*`);
    lines.push('');
    for (const f of followUps) {
      lines.push(`- **${f.question}** → ${f.answer}`);
    }
    lines.push('');
  }

  if (exploration.length > 0) {
    lines.push(
      locale === 'he'
        ? '## שאלות מעמיקות — שלב 5 (1–5)'
        : '## Deep exploration — step 5 (1–5)'
    );
    for (const e of exploration) {
      const score = e.score != null ? `[${e.score}/5]` : `[${locale === 'he' ? 'לא נענה' : 'unanswered'}]`;
      lines.push(`- ${score} ${e.text}`);
    }
    lines.push('');
  }

  lines.push(locale === 'he' ? '## סינתזה (מחושב מהנתונים)' : '## Synthesis (computed from data)');
  lines.push(insights.cross_cutting_narrative);
  lines.push('');
  lines.push(
    `**${locale === 'he' ? 'כיוון מומלץ ליעד' : 'Suggested goal focus'}:** ${insights.primary_goal_focus}`
  );
  if (insights.deprioritize_for_goals.length > 0) {
    lines.push(
      `**${locale === 'he' ? 'פחות מומלץ כיעד ראשי' : 'Less recommended as primary goal'}:** ${insights.deprioritize_for_goals.join(' · ')}`
    );
  }
  lines.push('');

  const formulation = session.formulation_approved ?? session.formulation_draft;
  if (formulation) {
    lines.push(locale === 'he' ? '## ניסוח משותף' : '## Collaborative formulation');
    lines.push(`**${locale === 'he' ? 'במרכז' : 'Central'}:** ${formulation.presenting_concern_user_words}`);
    if (formulation.stressors.length) {
      lines.push(`**${locale === 'he' ? 'מגביר' : 'Stressors'}:** ${formulation.stressors.join(' · ')}`);
    }
    if (formulation.maintaining_factors.length) {
      lines.push(
        `**${locale === 'he' ? 'מחזיק' : 'Maintaining'}:** ${formulation.maintaining_factors.join(' · ')}`
      );
    }
    if (formulation.existing_strengths.length) {
      lines.push(`**${locale === 'he' ? 'עוזר' : 'Strengths'}:** ${formulation.existing_strengths.join(' · ')}`);
    }
    if (formulation.uncertainties.length) {
      lines.push(
        `**${locale === 'he' ? 'לא בטוח' : 'Uncertainties'}:** ${formulation.uncertainties.join(' · ')}`
      );
    }
    lines.push('');
  }

  if (session.coach_handoff) {
    const h = session.coach_handoff;
    lines.push(locale === 'he' ? '## יעד מיקרו / העברה למאמן' : '## Micro-goal / coach handoff');
    lines.push(`- **${locale === 'he' ? 'ערך' : 'Value'}:** ${h.value}`);
    lines.push(`- **${locale === 'he' ? 'יעד שבועי' : 'Weekly goal'}:** ${h.micro_goal_week}`);
    lines.push(`- **${locale === 'he' ? 'מכשול' : 'Barrier'}:** ${h.anticipated_barrier}`);
    lines.push(`- **Plan B:** ${h.plan_b}`);
    if (h.do_not_touch?.length) {
      lines.push(`- **${locale === 'he' ? 'לא לגעת' : 'Do not touch'}:** ${h.do_not_touch.join(' · ')}`);
    }
    lines.push('');
  }

  if (session.reflection_llm_text || session.presenting_concern_user_words) {
    lines.push(locale === 'he' ? '## הקשר נוסף' : '## Additional context');
    if (session.presenting_concern_user_words) {
      lines.push(`- **${locale === 'he' ? 'סיכום קושי' : 'Concern summary'}:** ${session.presenting_concern_user_words}`);
    }
    if (session.reflection_llm_text) {
      lines.push(`- **${locale === 'he' ? 'שיקוף' : 'Reflection'}:** ${session.reflection_llm_text}`);
    }
    lines.push('');
  }

  const markdown = lines.join('\n');

  const payload = {
    exported_at: exportedAt,
    locale,
    session_meta: {
      id: session.id,
      current_phase: session.current_phase,
      status: session.status,
      started_at: session.started_at,
      updated_at: session.updated_at,
      completed_at: session.completed_at,
    },
    profile: {
      life_context_statuses: session.life_context_statuses,
      life_context_labels: profileContexts,
      life_context_status_note:
        draft?.consent?.life_context_status_note ?? session.life_context_status_note,
      participant_gender: session.participant_gender,
      participant_age: session.participant_age,
    },
    safety: {
      risk_q1: session.risk_q1,
      risk_q2: session.risk_q2,
      risk_level: session.risk_level,
      risk_action: session.risk_action,
    },
    passive_ratings: ratings,
    follow_up_chips: followUps,
    exploration_questions: session.llm_exploration_questions,
    exploration_ratings: exploration,
    synthesis: insights,
    formulation: session.formulation_approved ?? session.formulation_draft,
    formulation_draft: session.formulation_draft,
    coach_handoff: session.coach_handoff,
    phases_skipped: session.phases_skipped,
    live_draft_in_progress: draft,
    markdown_for_other_chats: markdown,
  };

  return {
    exported_at: exportedAt,
    locale,
    session,
    live_draft: draft,
    synthesis: insights,
    markdown,
    json: JSON.stringify(payload, null, 2),
  };
}

export function formulationExportFilename(
  session: FormulationSession,
  ext: 'md' | 'json'
): string {
  const date = new Date().toISOString().slice(0, 10);
  const short = session.id.slice(0, 8);
  return `formulation-export-${date}-${short}.${ext}`;
}

export function downloadTextFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], {type: `${mime};charset=utf-8`});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 200);
}
