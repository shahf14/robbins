import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  FALLBACK_STEP_COPY,
  FALLBACK_WEEKLY_COPY,
  pickFallbackCopy,
} from './fallback-copy.ts';

test('pickFallbackCopy returns Hebrew or English strings', () => {
  assert.equal(
    pickFallbackCopy(FALLBACK_STEP_COPY.oneVisibleMoveToday, 'he'),
    'נשארים עם צעד אחד קטן ונראה לעין היום.'
  );
  assert.equal(
    pickFallbackCopy(FALLBACK_STEP_COPY.oneVisibleMoveToday, 'en'),
    'Stay with one small, visible move today.'
  );
});

test('weekly and reflection fallbacks share tomorrow visible-step copy', () => {
  assert.equal(
    FALLBACK_WEEKLY_COPY.oneVisibleStepTomorrow.en,
    'one small visible step tomorrow'
  );
  assert.equal(
    FALLBACK_WEEKLY_COPY.oneVisibleStepTomorrow.he,
    'צעד קטן ונראה אחד מחר'
  );
});
