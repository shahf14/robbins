import {nextBestActionSchema} from './schema';
import type {NextBestAction} from './types';

export function ensureNextBestAction(
  value: NextBestAction | null | undefined,
  fallback: NextBestAction
): NextBestAction {
  const parsed = nextBestActionSchema.safeParse(value);
  return parsed.success ? parsed.data : fallback;
}
