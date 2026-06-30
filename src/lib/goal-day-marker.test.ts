import test from 'node:test';
import assert from 'node:assert/strict';
import {inferDayMarkerFromTitle} from './goal-day-marker';

test('inferDayMarkerFromTitle uses word boundaries', () => {
  assert.equal(inferDayMarkerFromTitle('Complete 300 pushups in 30 days'), 30);
  assert.equal(inferDayMarkerFromTitle('300 pushups challenge'), null);
  assert.equal(inferDayMarkerFromTitle('Day 90 checkpoint'), 90);
});
