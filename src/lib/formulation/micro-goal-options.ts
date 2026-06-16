import type {AppLocale} from '@/i18n/config';
import {
  buildFormulationInsights,
  goalReadyLabel,
} from '@/lib/formulation/formulation-insights';
import type {FormulationSession} from '@/lib/life-coach/types';

/** Internal slot types for LLM prompt variety (not shown in UI). */
export type MicroGoalType = 'practical' | 'mindset' | 'freestyle';

export const MICRO_GOAL_TYPE_SLOTS: MicroGoalType[] = [
  'practical',
  'mindset',
  'freestyle',
  'freestyle',
  'freestyle',
];

export type MicroGoalOption = {
  id: string;
  goal_type: MicroGoalType;
  title: string;
  value: string;
  micro_goal_week: string;
  anticipated_barrier: string;
  plan_b: string;
  /** Mindset slot only — which barrier the exercise targets (internal + UI). */
  why_this_exercise?: string;
  mindset_exercise_id?: string;
};

/** What hurts most this week — headline for step 7 (until LLM returns burning_focus). */
export function burningFocusHeadline(session: FormulationSession, locale: AppLocale): string {
  const insights = buildFormulationInsights(session, locale);
  const top = insights.burning_now_themes[0];
  if (top) return goalReadyLabel(top, locale);
  const core = session.formulation_approved?.presenting_concern_user_words?.trim();
  if (core) return core.slice(0, 160);
  return locale === 'he' ? 'מה שבוער עכשיו לפי הנתונים' : 'What is flaring now per your data';
}
