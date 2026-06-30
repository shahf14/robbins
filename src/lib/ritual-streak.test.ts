import assert from 'node:assert/strict';
import test from 'node:test';
import {computeRitualStreak} from './ritual-streak';

function session(completedAt: string) {
  return {completed: true, completedAt};
}

test('computeRitualStreak requires today in the chain', () => {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const streak = computeRitualStreak([session(yesterday.toISOString())]);
  assert.equal(streak, 0);
});

test('computeRitualStreak counts consecutive days through today', () => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const streak = computeRitualStreak([
    session(today.toISOString()),
    session(yesterday.toISOString()),
  ]);
  assert.equal(streak, 2);
});
