import assert from 'node:assert/strict';
import test from 'node:test';
import {goalDayIndex} from './goal-day-index';

test('goalDayIndex uses local calendar dates', () => {
  assert.equal(goalDayIndex('2026-01-01', '2026-01-01'), 1);
  assert.equal(goalDayIndex('2026-01-01', '2026-01-02'), 2);
  assert.equal(goalDayIndex('2026-01-01T23:00:00.000Z', '2026-01-02'), 2);
});
