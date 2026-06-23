import type {useTranslations} from 'next-intl';
import {LifeCoachApiError} from './api-client';
import {resolveLifeCoachErrorMessage} from './api-error';

type Translator = ReturnType<typeof useTranslations>;

function slotsLeftFromDetails(details: unknown): number | null {
  if (!details || typeof details !== 'object' || !('slotsLeft' in details)) return null;
  const value = Number((details as {slotsLeft: unknown}).slotsLeft);
  return Number.isFinite(value) ? value : null;
}

/** Map curated API error codes to localized user-facing messages. */
export function resolveCuratedErrorMessage(error: unknown, t: Translator): string {
  if (!(error instanceof LifeCoachApiError)) {
    return t('feedback.failed');
  }

  switch (error.message) {
    case 'curated_duplicate_ids':
      return t('lifeCoach.curatedErrors.duplicateIds');
    case 'curated_max_reached':
      return t('lifeCoach.curatedErrors.maxReached');
    case 'curated_slots_exceeded': {
      const slotsLeft = slotsLeftFromDetails(error.details);
      return slotsLeft != null
        ? t('lifeCoach.curatedErrors.slotsExceeded', {count: slotsLeft})
        : t('lifeCoach.curatedErrors.maxReached');
    }
    case 'curated_not_pending':
      return t('lifeCoach.curatedErrors.notPending');
    case 'curated_not_from_pool':
      return t('lifeCoach.curatedErrors.notFromPool');
    case 'curated_wrong_domain':
      return t('lifeCoach.curatedErrors.wrongDomain');
    case 'curated_same_task':
      return t('lifeCoach.curatedErrors.sameTask');
    case 'curated_already_in_plan':
      return t('lifeCoach.curatedErrors.alreadyInPlan');
    default:
      return resolveLifeCoachErrorMessage(error, t);
  }
}
