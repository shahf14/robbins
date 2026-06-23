export type ApiLoadFailureKind = 'auth' | 'onboarding' | 'offline' | 'transient';

function errorDetails(error: unknown): unknown {
  if (!error || typeof error !== 'object' || !('details' in error)) return undefined;
  return (error as {details: unknown}).details;
}

export function isOfflineLoadFailure(error: unknown): boolean {
  if (error instanceof TypeError) return true;

  if (error instanceof Error) {
    const message = error.message.trim().toLowerCase();
    if (message === 'failed to fetch' || message === 'offline') return true;
  }

  const status = getHttpStatus(error);
  if (status !== 503) return false;

  if (error instanceof Error && error.message.trim().toLowerCase() === 'offline') return true;

  const details = errorDetails(error);
  return Boolean(details && typeof details === 'object' && (details as {offline?: boolean}).offline);
}

function isLifeCoachApiError(error: unknown): error is Error & {status: number} {
  return error instanceof Error && error.name === 'LifeCoachApiError' && typeof getHttpStatus(error) === 'number';
}

export function getHttpStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object' || !('status' in error)) return undefined;
  const status = Number((error as {status: unknown}).status);
  return Number.isFinite(status) ? status : undefined;
}

export function classifyLoadFailure(error: unknown): ApiLoadFailureKind {
  const status = getHttpStatus(error);
  if (status === 401) return 'auth';
  if (status === 403) return 'onboarding';
  if (isOfflineLoadFailure(error)) return 'offline';
  return 'transient';
}

export function resolveLifeCoachErrorMessage(
  error: unknown,
  t: (key: 'feedback.failed' | 'feedback.offline') => string
): string {
  if (isLifeCoachApiError(error)) {
    return error.message.trim() || t('feedback.failed');
  }
  if (error instanceof TypeError) {
    return t('feedback.offline');
  }
  if (error instanceof Error) {
    const message = error.message.trim();
    if (message === 'Failed to fetch') return t('feedback.offline');
    if (message) return message;
  }
  return t('feedback.failed');
}

function retryAfterSecondsFromDetails(details: unknown): number | null {
  if (!details || typeof details !== 'object') return null;
  if ('retry_after_seconds' in details) {
    const value = Number((details as {retry_after_seconds: unknown}).retry_after_seconds);
    return Number.isFinite(value) ? value : null;
  }
  return null;
}

/** Map weekly-review API failures to localized, actionable messages. */
export function resolveWeeklyReviewErrorMessage(
  error: unknown,
  t: (key: string, values?: {count?: number}) => string
): string {
  const status = getHttpStatus(error);
  const message = error instanceof Error ? error.message.toLowerCase() : '';

  if (status === 409 || message.includes('already exists')) {
    return t('lifeCoach.weeklyReviewErrors.duplicatePeriod');
  }
  if (status === 429 || message.includes('rate limit')) {
    const retryAfter = retryAfterSecondsFromDetails(errorDetails(error));
    if (retryAfter != null) {
      if (retryAfter >= 3600) {
        return t('lifeCoach.weeklyReviewErrors.rateLimitedHours', {
          count: Math.ceil(retryAfter / 3600),
        });
      }
      return t('lifeCoach.weeklyReviewErrors.rateLimitedMinutes', {
        count: Math.max(1, Math.ceil(retryAfter / 60)),
      });
    }
    return t('lifeCoach.weeklyReviewErrors.rateLimited');
  }

  return resolveLifeCoachErrorMessage(error, t);
}
