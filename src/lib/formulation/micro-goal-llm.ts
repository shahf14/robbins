import type {AppLocale} from '@/i18n/config';
import {validateGoalSlotAlignment} from '@/lib/formulation/goal-alignment';
import {selectMindsetExercise} from '@/lib/formulation/mindset-exercises';
import {
  MICRO_GOAL_TYPE_SLOTS,
  type MicroGoalOption,
} from '@/lib/formulation/micro-goal-options';
import type {FormulationSession} from '@/lib/life-coach/types';
function normalizeText(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Force slot order + internal goal_type (LLM order is authoritative). */
export function normalizeGoalOptions(options: MicroGoalOption[]): MicroGoalOption[] {
  if (options.length < 5) return options;
  return options.slice(0, 5).map((o, i) => ({
    ...o,
    goal_type: MICRO_GOAL_TYPE_SLOTS[i]!,
    anticipated_barrier: o.anticipated_barrier?.trim() || '—',
    plan_b: o.plan_b?.trim() || '—',
  }));
}

/** Attach recommended mindset exercise metadata to the mindset slot (index 1). */
export function enrichMindsetGoalOptions(
  options: MicroGoalOption[],
  session: FormulationSession,
  locale: AppLocale
): MicroGoalOption[] {
  const normalized = normalizeGoalOptions(options);
  const exercise = selectMindsetExercise(session, locale);
  const mindsetIndex = normalized.findIndex((o) => o.goal_type === 'mindset');
  if (mindsetIndex < 0) return normalized;

  const mindset = normalized[mindsetIndex]!;
  normalized[mindsetIndex] = {
    ...mindset,
    mindset_exercise_id: exercise.id,
    why_this_exercise: mindset.why_this_exercise?.trim() || exercise.why_this_exercise,
  };
  return normalized;
}

export function validateLlmGoalOptions(
  options: MicroGoalOption[],
  session: FormulationSession,
  locale: AppLocale,
  burningFocus?: string
): boolean {
  const normalized = normalizeGoalOptions(options);
  if (normalized.length !== 5) return false;

  if (normalized.some((o) => !o.title?.trim() || !o.micro_goal_week?.trim() || !o.value?.trim())) {
    return false;
  }

  const titles = new Set(normalized.map((o) => normalizeText(o.title)));
  const weeks = new Set(normalized.map((o) => normalizeText(o.micro_goal_week)));
  if (titles.size < 4 || weeks.size < 4) return false;

  if (normalized.some((o) => o.micro_goal_week.trim().length < 8)) return false;

  return validateGoalSlotAlignment(normalized, session, locale, burningFocus);
}

export class MicroGoalLlmError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'MicroGoalLlmError';
  }
}
