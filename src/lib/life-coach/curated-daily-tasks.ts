import type {AppLocale} from '@/i18n/config';
import {dateToYMD} from '@/lib/date-utils';
import {
  filterActiveCuratedTasksForDomain,
  findActiveCuratedTask,
} from './curated-task-library';
import {CURATED_TASKS_BY_DOMAIN, type CuratedDailyTask} from './curated-task-data';
import type {DailyStepDifficulty, LifeDomain, StructuredDailyBabyStep} from './types';

export type {CuratedDailyTask} from './curated-task-data';

export type CuratedDailyTaskOption = {
  id: string;
  world: LifeDomain;
  title: string;
  description: string;
  difficulty: DailyStepDifficulty;
  difficultyRank: 1 | 2 | 3;
  durationMinutes: number;
  type: string;
  energy: CuratedDailyTask['energy'];
  emotionalDepth: CuratedDailyTask['emotionalDepth'];
  tags: string[];
  repeatable: boolean;
  origin: CuratedDailyTask['origin'];
};

export const MAX_CURATED_STEPS_PER_DAY = 3;

const CURATED_REASONING_RE = /^curated:([^:]+):/;

export function curatedIdFromStepReasoning(reasoning?: string | null): string | null {
  return reasoning?.match(CURATED_REASONING_RE)?.[1] ?? null;
}

export function isCuratedStepReasoning(reasoning?: string | null): boolean {
  return curatedIdFromStepReasoning(reasoning) !== null;
}

const TASKS_BY_DOMAIN = CURATED_TASKS_BY_DOMAIN;

function tasksForDomain(domain: LifeDomain): CuratedDailyTask[] {
  if (typeof window !== 'undefined') {
    return filterActiveCuratedTasksForDomain(domain);
  }
  return TASKS_BY_DOMAIN[domain] ?? [];
}

function findTaskById(taskId: string): CuratedDailyTask | null {
  if (typeof window !== 'undefined') {
    return findActiveCuratedTask(taskId);
  }
  for (const tasks of Object.values(TASKS_BY_DOMAIN)) {
    const task = tasks.find((item) => item.id === taskId);
    if (task) return task;
  }
  return null;
}

function difficultyFromRank(rank: CuratedDailyTask['difficulty']): DailyStepDifficulty {
  if (rank === 1) return 'easy';
  if (rank === 2) return 'medium';
  return 'hard';
}

function localizeText(value: CuratedDailyTask['title'], locale: AppLocale): string {
  return value[locale] || value.he || value.en;
}

function toOption(task: CuratedDailyTask, locale: AppLocale): CuratedDailyTaskOption {
  return {
    id: task.id,
    world: task.world,
    title: localizeText(task.title, locale),
    description: localizeText(task.description, locale),
    difficulty: difficultyFromRank(task.difficulty),
    difficultyRank: task.difficulty,
    durationMinutes: task.durationMinutes,
    type: task.type,
    energy: task.energy,
    emotionalDepth: task.emotionalDepth,
    tags: task.tags,
    repeatable: task.repeatable,
    origin: task.origin,
  };
}

export function listCuratedDailyTaskOptions(
  domain: LifeDomain,
  locale: AppLocale = 'he'
): CuratedDailyTaskOption[] {
  return tasksForDomain(domain).map((task) => toOption(task, locale));
}

export function getCuratedDailyTaskOption(
  taskId: string,
  locale: AppLocale = 'he'
): CuratedDailyTaskOption | null {
  const task = findTaskById(taskId);
  return task ? toOption(task, locale) : null;
}

export function suggestCuratedDailyTasks(input: {
  domain: LifeDomain;
  locale?: AppLocale;
  count?: number;
  completedTaskIds?: string[];
}): CuratedDailyTaskOption[] {
  const locale = input.locale ?? 'he';
  const completed = new Set(input.completedTaskIds ?? []);
  const tasks = listCuratedDailyTaskOptions(input.domain, locale);
  const fresh = tasks.filter((task) => task.repeatable || !completed.has(task.id));
  const source = fresh.length >= 3 ? fresh : tasks;
  const easy = source.filter((task) => task.difficultyRank === 1).slice(0, 2);
  const medium = source.filter((task) => task.difficultyRank === 2).slice(0, 2);
  const deeper = source
    .filter((task) => task.difficultyRank === 3 || task.emotionalDepth >= 3)
    .slice(0, 1);
  const picked = [...easy, ...medium, ...deeper];
  const seen = new Set(picked.map((task) => task.id));
  const filled = [
    ...picked,
    ...source.filter((task) => !seen.has(task.id)),
  ];
  return filled.slice(0, input.count ?? 5);
}

export function curatedTaskToStructuredDailyStep(
  task: CuratedDailyTaskOption,
  date = dateToYMD(new Date())
): StructuredDailyBabyStep & {scheduled_date: string} {
  return {
    goal_id: null,
    domain: task.world,
    title: task.title,
    description: task.description,
    estimated_minutes: task.durationMinutes,
    difficulty: task.difficulty,
    scheduled_date: date,
    reasoning:
      task.origin.kind === 'curated'
        ? `curated:${task.id}:${task.origin.version}`
        : undefined,
    pain_addressed: task.type,
    success_signal: task.tags.slice(0, 3).join(', '),
  };
}
