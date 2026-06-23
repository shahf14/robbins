import type {DailyStepStatus} from '@/lib/life-coach/types';

// These URL-state contracts live in the lib (the lower layer); the components
// that render the tabs/filters import them from here, not the reverse.
export type DomainDetailTab = 'today' | 'goal' | 'progress' | 'insights';
export type StepStatusFilter = 'all' | DailyStepStatus;

export const DOMAIN_DETAIL_TABS: DomainDetailTab[] = ['today', 'goal', 'progress', 'insights'];
export const DOMAIN_STEP_FILTERS: StepStatusFilter[] = [
  'all',
  'pending',
  'completed',
  'skipped',
  'partial',
];

export function parseDomainDetailTab(value: string | null): DomainDetailTab | null {
  if (!value) return null;
  return DOMAIN_DETAIL_TABS.includes(value as DomainDetailTab) ? (value as DomainDetailTab) : null;
}

export function parseDomainStepFilter(value: string | null): StepStatusFilter | null {
  if (!value) return null;
  return DOMAIN_STEP_FILTERS.includes(value as StepStatusFilter)
    ? (value as StepStatusFilter)
    : null;
}

type QueryPatch = {
  tab?: DomainDetailTab | null;
  steps?: StepStatusFilter | null;
};

export function buildDomainDetailHref(
  pathname: string,
  searchParams: URLSearchParams | {toString(): string},
  patch: QueryPatch
): string {
  const params = new URLSearchParams(searchParams.toString());

  if ('tab' in patch) {
    if (patch.tab === null || patch.tab === 'today') params.delete('tab');
    else if (patch.tab) params.set('tab', patch.tab);
  }

  if ('steps' in patch) {
    if (patch.steps === null || patch.steps === 'pending') params.delete('steps');
    else if (patch.steps) params.set('steps', patch.steps);
  }

  const query = params.toString();
  return query ? `${pathname}?${query}` : pathname;
}
