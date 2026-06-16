import {dateToYMD} from '@/lib/date-utils';
import type {DailyBabyStep} from '@/lib/life-coach/types';
import {listWeeklyFocusesSince} from './repository';
import {dateInWeek} from './week-window';
import type {GoalDecompositionCoherenceMetrics, WeeklyGoalFocus} from './types';

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .split(/[\s,.:;!?()\-–—]+/)
    .filter((t) => t.length > 3);
}

function stepAlignsWithWeeklyFocus(
  step: DailyBabyStep,
  focus: WeeklyGoalFocus
): boolean {
  if (step.goal_id && step.goal_id !== focus.goal_id) return false;
  if (step.weekly_focus_id === focus.id) return true;

  const hay = `${step.title} ${step.description} ${step.reasoning ?? ''}`.toLowerCase();
  const focusHay = [
    focus.focus_title,
    focus.focus_description,
    focus.progress_cue,
    ...focus.weekly_themes,
  ].join(' ');
  const tokens = tokenize(focusHay);
  const overlap = tokens.filter((t) => hay.includes(t)).length;
  return overlap >= 2 || hay.includes(focus.focus_title.toLowerCase().slice(0, 12));
}

export function computeGoalDecompositionCoherence(
  userId: string,
  steps: DailyBabyStep[],
  windowDays = 14
): GoalDecompositionCoherenceMetrics | null {
  const since = dateDaysAgo(Math.max(0, windowDays - 1));
  const windowSteps = steps.filter(
    (s) => s.scheduled_date >= since && s.generated_by_ai
  );
  if (windowSteps.length === 0) return null;

  const focuses = listWeeklyFocusesSince(userId, since);
  if (focuses.length === 0) return null;

  const daysWithSteps = new Set(windowSteps.map((s) => s.scheduled_date));
  let daysCoherent = 0;
  const goalLinked = windowSteps.filter((s) => s.goal_id).length;
  let milestoneProgressDays = 0;

  for (const day of daysWithSteps) {
    const daySteps = windowSteps.filter((s) => s.scheduled_date === day);
    const weekFocuses = focuses.filter((f) => dateInWeek(day, f.week_start, f.week_end));

    const dayAligned = daySteps.some((step) => {
      const focus =
        weekFocuses.find((f) => f.goal_id === step.goal_id) ??
        weekFocuses.find((f) => step.weekly_focus_id === f.id);
      if (!focus) return false;
      return stepAlignsWithWeeklyFocus(step, focus);
    });

    if (dayAligned) daysCoherent++;

    const completedMilestoneLinked = daySteps.some((step) => {
      if (step.status !== 'completed' && step.status !== 'partial') return false;
      const focus = weekFocuses.find((f) => f.goal_id === step.goal_id);
      return !!focus?.active_day_marker;
    });
    if (completedMilestoneLinked) milestoneProgressDays++;
  }

  const weeksWithFocus = new Set(focuses.map((f) => f.week_start)).size;
  const totalSteps = windowSteps.length;

  return {
    weeks_with_focus: weeksWithFocus,
    days_with_steps: daysWithSteps.size,
    days_coherent: daysCoherent,
    day_coherence_rate:
      daysWithSteps.size > 0
        ? Math.round((daysCoherent / daysWithSteps.size) * 100) / 100
        : 0,
    goal_linked_step_rate:
      totalSteps > 0 ? Math.round((goalLinked / totalSteps) * 100) / 100 : 0,
    milestone_progress_days: milestoneProgressDays,
  };
}

function dateDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return dateToYMD(d);
}
