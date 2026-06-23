import assert from 'node:assert/strict';
import test from 'node:test';
import {classifyLoadFailure, getHttpStatus, resolveLifeCoachErrorMessage, resolveWeeklyReviewErrorMessage} from './api-error.ts';

const t = (key: 'feedback.failed' | 'feedback.offline') =>
  key === 'feedback.offline' ? 'offline' : 'failed';

const weeklyT = ((key: string, values?: {count?: number}) => {
  if (key === 'lifeCoach.weeklyReviewErrors.duplicatePeriod') return 'duplicate';
  if (key === 'lifeCoach.weeklyReviewErrors.rateLimited') return 'rate-limited';
  if (key === 'lifeCoach.weeklyReviewErrors.rateLimitedMinutes') {
    return `wait-${values?.count}-minutes`;
  }
  if (key === 'feedback.offline') return 'offline';
  return 'failed';
}) as Parameters<typeof resolveWeeklyReviewErrorMessage>[1];

test('classifyLoadFailure maps HTTP status to actionable kinds', () => {
  assert.equal(classifyLoadFailure({status: 401}), 'auth');
  assert.equal(classifyLoadFailure({status: 403}), 'onboarding');
  assert.equal(classifyLoadFailure({status: 500}), 'transient');
  assert.equal(classifyLoadFailure(new Error('network')), 'transient');
  assert.equal(classifyLoadFailure(new TypeError('Failed to fetch')), 'offline');
  assert.equal(
    classifyLoadFailure({status: 503, message: 'offline', name: 'LifeCoachApiError', details: {offline: true}}),
    'offline'
  );
});

test('resolveLifeCoachErrorMessage surfaces offline and generic errors', () => {
  const apiError = new Error('Onboarding required.');
  apiError.name = 'LifeCoachApiError';
  Object.assign(apiError, {status: 403});

  assert.equal(resolveLifeCoachErrorMessage(apiError, t), 'Onboarding required.');
  assert.equal(resolveLifeCoachErrorMessage(new TypeError('Failed to fetch'), t), 'offline');
  assert.equal(resolveLifeCoachErrorMessage(new Error('boom'), t), 'boom');
  assert.equal(resolveLifeCoachErrorMessage(null, t), 'failed');
});

test('resolveWeeklyReviewErrorMessage maps duplicate and rate-limit responses', () => {
  assert.equal(
    resolveWeeklyReviewErrorMessage(
      {status: 409, message: 'Weekly review already exists for the current period.', name: 'LifeCoachApiError'},
      weeklyT
    ),
    'duplicate'
  );
  assert.equal(
    resolveWeeklyReviewErrorMessage(
      {
        status: 429,
        message: 'AI rate limit exceeded.',
        name: 'LifeCoachApiError',
        details: {retry_after_seconds: 120},
      },
      weeklyT
    ),
    'wait-2-minutes'
  );
  assert.equal(
    resolveWeeklyReviewErrorMessage(new TypeError('Failed to fetch'), weeklyT),
    'offline'
  );
});
