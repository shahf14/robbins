export type DiscoverableFeature =
  | 'morning_ritual'
  | 'evening_reset'
  | 'weekly_review'
  | 'formulation';

const PREFIX = 'robbins_feature_seen_';
const HINT_PREFIX = 'robbins_feature_hint_dismissed_';

function storageKey(feature: DiscoverableFeature): string {
  return `${PREFIX}${feature}`;
}

function hintKey(feature: DiscoverableFeature): string {
  return `${HINT_PREFIX}${feature}`;
}

function hasSeenFeature(feature: DiscoverableFeature): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(storageKey(feature)) === '1';
  } catch {
    return true;
  }
}

export function markFeatureSeen(feature: DiscoverableFeature): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(storageKey(feature), '1');
  } catch {
    /* ignore */
  }
}

function hasDismissedFeatureHint(feature: DiscoverableFeature): boolean {
  if (typeof window === 'undefined') return true;
  try {
    return window.localStorage.getItem(hintKey(feature)) === '1';
  } catch {
    return true;
  }
}

export function dismissFeatureHint(feature: DiscoverableFeature): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(hintKey(feature), '1');
  } catch {
    /* ignore */
  }
}

export function shouldShowFeatureHint(feature: DiscoverableFeature): boolean {
  return !hasDismissedFeatureHint(feature);
}
