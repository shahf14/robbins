import {goalDayIndex} from '@/lib/ai-life-coach/resolve-daily-step';
import type {Goal, Milestone} from '@/lib/life-coach/types';
import type {ActiveMilestoneContext} from './types';

function targetDayMarker(dayIndex: number): 30 | 60 | 90 {
  if (dayIndex <= 30) return 30;
  if (dayIndex <= 60) return 60;
  return 90;
}

function resolveDayMarker(milestone: Milestone): 30 | 60 | 90 | null {
  if (milestone.day_marker === 30 || milestone.day_marker === 60 || milestone.day_marker === 90) {
    return milestone.day_marker;
  }
  const title = milestone.title;
  if (title.includes('90')) return 90;
  if (title.includes('60')) return 60;
  if (title.includes('30')) return 30;
  return null;
}

function findMilestoneForMarker(
  milestones: Milestone[],
  marker: 30 | 60 | 90
): Milestone | null {
  const pending = milestones.filter((m) => m.status !== 'completed');
  return (
    pending.find((m) => resolveDayMarker(m) === marker) ??
    milestones.find((m) => resolveDayMarker(m) === marker) ??
    null
  );
}

export function resolveActiveMilestone(
  goal: Goal,
  milestones: Milestone[],
  date: string
): ActiveMilestoneContext {
  const day_index = goalDayIndex(goal.created_at, date);
  const marker = targetDayMarker(day_index);
  const milestone = findMilestoneForMarker(milestones, marker);

  return {
    day_index,
    day_marker: milestone ? marker : null,
    milestone_id: milestone?.id ?? null,
    milestone_title: milestone?.title ?? null,
  };
}
