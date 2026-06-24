import type {CuratedDailyTask} from './curated-task-data';
import {getBuiltinCuratedTasks, getBuiltinCuratedTasksForDomain} from './curated-task-data';
import type {LifeDomain} from './types';

export type CuratedTaskStatus = 'draft' | 'published' | 'archived';

export type AdminCuratedTask = CuratedDailyTask & {
  status: CuratedTaskStatus;
  hiddenFromLibrary?: boolean;
  isDefault?: boolean;
  isAdminManaged?: boolean;
  updatedAt?: string;
};

const STORAGE_KEY = 'robbins-curated-tasks-v1';

function seedBuiltin(task: CuratedDailyTask): AdminCuratedTask {
  return {
    ...task,
    status: 'published',
    isDefault: true,
    updatedAt: '2026-01-01T00:00:00.000Z',
  };
}

function parseStored(raw: string | null): AdminCuratedTask[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AdminCuratedTask[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function createDefaultCuratedTaskLibrary(): AdminCuratedTask[] {
  return getBuiltinCuratedTasks().map(seedBuiltin);
}

export function loadCuratedTaskLibrary(): AdminCuratedTask[] {
  const builtins = createDefaultCuratedTaskLibrary();
  if (typeof window === 'undefined') return builtins;
  const stored = parseStored(window.localStorage.getItem(STORAGE_KEY));
  if (!stored.length) return builtins;
  const byId = new Map(builtins.map((task) => [task.id, task]));
  for (const task of stored) byId.set(task.id, task);
  return [...byId.values()];
}

export function saveCuratedTaskLibrary(tasks: AdminCuratedTask[]): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
}

export function isCuratedTaskVisibleInPicker(task: AdminCuratedTask): boolean {
  return task.status === 'published' && !task.hiddenFromLibrary;
}

export function filterActiveCuratedTasksForDomain(domain: LifeDomain): CuratedDailyTask[] {
  return loadCuratedTaskLibrary()
    .filter((task) => task.world === domain && isCuratedTaskVisibleInPicker(task))
    .map(({status: _status, hiddenFromLibrary: _hidden, isDefault: _isDefault, isAdminManaged: _managed, updatedAt: _updatedAt, ...task}) => task);
}

export function findActiveCuratedTask(taskId: string): CuratedDailyTask | null {
  const task = loadCuratedTaskLibrary().find((item) => item.id === taskId && isCuratedTaskVisibleInPicker(item));
  if (!task) return null;
  const {status: _status, hiddenFromLibrary: _hidden, isDefault: _isDefault, isAdminManaged: _managed, updatedAt: _updatedAt, ...rest} = task;
  return rest;
}

export function duplicateCuratedTask(task: AdminCuratedTask, domain: LifeDomain): AdminCuratedTask {
  const timestamp = new Date().toISOString();
  return {
    ...task,
    id: `${task.id}_copy_${crypto.randomUUID().slice(0, 8)}`,
    world: domain,
    status: 'draft',
    isDefault: false,
    isAdminManaged: true,
    hiddenFromLibrary: false,
    updatedAt: timestamp,
    origin: {kind: 'curated', version: 'admin'},
  };
}

export function newCuratedTask(domain: LifeDomain): AdminCuratedTask {
  const timestamp = new Date().toISOString();
  return {
    id: `custom_${crypto.randomUUID()}`,
    world: domain,
    title: {he: '', en: ''},
    description: {he: '', en: ''},
    difficulty: 1,
    durationMinutes: 5,
    type: 'action',
    energy: 'low',
    emotionalDepth: 1,
    tags: [],
    repeatable: true,
    origin: {kind: 'curated', version: 'admin'},
    status: 'draft',
    isDefault: false,
    isAdminManaged: true,
    updatedAt: timestamp,
  };
}

export function exportCuratedTasksForDomain(tasks: AdminCuratedTask[], domain: LifeDomain): CuratedDailyTask[] {
  return tasks
    .filter((task) => task.world === domain && isCuratedTaskVisibleInPicker(task))
    .map(({status: _status, hiddenFromLibrary: _hidden, isDefault: _isDefault, isAdminManaged: _managed, updatedAt: _updatedAt, ...task}) => task);
}

export function resetCuratedTasksForDomain(tasks: AdminCuratedTask[], domain: LifeDomain): AdminCuratedTask[] {
  const builtins = createDefaultCuratedTaskLibrary().filter((task) => task.world === domain);
  const other = tasks.filter((task) => task.world !== domain);
  return [...other, ...builtins];
}
