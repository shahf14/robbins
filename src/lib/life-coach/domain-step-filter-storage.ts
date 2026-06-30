import {parseJsonOr} from '@/lib/safe-json';
import {
  DOMAIN_STEP_FILTERS,
  type StepStatusFilter,
} from '@/lib/life-coach/domain-detail-url-state';

const PREFIX = 'domain_detail_step_filter:';

function isValidFilter(value: unknown): value is StepStatusFilter {
  return typeof value === 'string' && DOMAIN_STEP_FILTERS.includes(value as StepStatusFilter);
}

export function loadDomainStepFilter(domain: string): StepStatusFilter | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = window.sessionStorage.getItem(`${PREFIX}${domain}`);
    if (!raw) return null;
    const parsed = parseJsonOr<unknown>(raw, null);
    return isValidFilter(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

export function saveDomainStepFilter(domain: string, filter: StepStatusFilter): void {
  if (typeof window === 'undefined') return;
  try {
    window.sessionStorage.setItem(`${PREFIX}${domain}`, JSON.stringify(filter));
  } catch {
    // quota exceeded or disabled
  }
}
