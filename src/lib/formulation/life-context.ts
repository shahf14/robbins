import {LIFE_CONTEXT_STATUSES, type LifeContextStatus} from '@/lib/life-coach/types';

const STATUS_SET = new Set<string>(LIFE_CONTEXT_STATUSES);

function isLifeContextStatus(value: string): value is LifeContextStatus {
  return STATUS_SET.has(value);
}

/** Parse DB value: JSON array, legacy single status, or null. */
export function parseLifeContextStatuses(
  statusesJson: unknown,
  legacySingle: unknown
): LifeContextStatus[] {
  if (statusesJson != null && statusesJson !== '') {
    try {
      const parsed = JSON.parse(String(statusesJson)) as unknown;
      if (Array.isArray(parsed)) {
        return parsed.filter((s): s is LifeContextStatus => typeof s === 'string' && isLifeContextStatus(s));
      }
    } catch {
      /* fall through */
    }
  }
  if (typeof legacySingle === 'string' && legacySingle && isLifeContextStatus(legacySingle)) {
    return [legacySingle];
  }
  return [];
}

export function serializeLifeContextStatuses(statuses: LifeContextStatus[]): string {
  return JSON.stringify(statuses);
}

export function normalizeLifeContextSelection(selected: LifeContextStatus[]): LifeContextStatus[] {
  const unique = [...new Set(selected)];
  if (unique.includes('prefer_not')) {
    return ['prefer_not'];
  }
  return unique.filter((s) => s !== 'prefer_not');
}
