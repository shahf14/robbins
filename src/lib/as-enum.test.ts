import assert from 'node:assert/strict';
import {test} from 'node:test';
import {asEnum, isEnumMember} from './as-enum.ts';

const COLORS = ['red', 'green'] as const;

test('asEnum returns member or fallback', () => {
  assert.equal(asEnum('red', COLORS), 'red');
  assert.equal(asEnum('blue', COLORS), null);
  assert.equal(asEnum('blue', COLORS, 'green'), 'green');
});

test('isEnumMember narrows unknown values', () => {
  const value: unknown = 'green';
  assert.equal(isEnumMember(value, COLORS), true);
  assert.equal(isEnumMember('purple', COLORS), false);
});
