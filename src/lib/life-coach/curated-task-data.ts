import healthTasks from '@/data/daily-tasks/health.json';
import timeTasks from '@/data/daily-tasks/time.json';
import wealthTasks from '@/data/daily-tasks/wealth.json';
import careerTasks from '@/data/daily-tasks/career.json';
import relationshipsTasks from '@/data/daily-tasks/relationships.json';
import mindTasks from '@/data/daily-tasks/mind.json';
import spiritTasks from '@/data/daily-tasks/spirit.json';
import houseFamilyTasks from '@/data/daily-tasks/house_family.json';
import type {LifeDomain} from './types';

export type LocalizedText = {
  he: string;
  en: string;
};

export type CuratedDailyTask = {
  id: string;
  world: LifeDomain;
  title: LocalizedText;
  description: LocalizedText;
  difficulty: 1 | 2 | 3;
  durationMinutes: number;
  type: string;
  energy: 'low' | 'medium' | 'high';
  emotionalDepth: 1 | 2 | 3;
  tags: string[];
  repeatable: boolean;
  origin: {
    kind: 'curated';
    version: string;
  };
};

export const CURATED_TASKS_BY_DOMAIN: Record<LifeDomain, CuratedDailyTask[]> = {
  health: healthTasks as CuratedDailyTask[],
  time: timeTasks as CuratedDailyTask[],
  wealth: wealthTasks as CuratedDailyTask[],
  career: careerTasks as CuratedDailyTask[],
  relationships: relationshipsTasks as CuratedDailyTask[],
  mind: mindTasks as CuratedDailyTask[],
  spirit: spiritTasks as CuratedDailyTask[],
  house_family: houseFamilyTasks as CuratedDailyTask[],
};

export function getBuiltinCuratedTasks(): CuratedDailyTask[] {
  return Object.values(CURATED_TASKS_BY_DOMAIN).flat();
}

export function getBuiltinCuratedTasksForDomain(domain: LifeDomain): CuratedDailyTask[] {
  return CURATED_TASKS_BY_DOMAIN[domain] ?? [];
}
