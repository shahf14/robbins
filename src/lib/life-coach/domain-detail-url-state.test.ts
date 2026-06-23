import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildDomainDetailHref,
  parseDomainDetailTab,
  parseDomainStepFilter,
} from './domain-detail-url-state.ts';

test('parseDomainDetailTab and parseDomainStepFilter validate URL values', () => {
  assert.equal(parseDomainDetailTab('insights'), 'insights');
  assert.equal(parseDomainDetailTab('nope'), null);
  assert.equal(parseDomainStepFilter('completed'), 'completed');
  assert.equal(parseDomainStepFilter('bogus'), null);
});

test('buildDomainDetailHref preserves unrelated params and omits defaults', () => {
  const base = new URLSearchParams('resumeGoal=1&steps=completed');
  assert.equal(
    buildDomainDetailHref('/life-coach/career', base, {tab: 'today'}),
    '/life-coach/career?resumeGoal=1&steps=completed'
  );
  assert.equal(
    buildDomainDetailHref('/life-coach/career', base, {tab: 'goal'}),
    '/life-coach/career?resumeGoal=1&steps=completed&tab=goal'
  );
  assert.equal(
    buildDomainDetailHref('/life-coach/career', new URLSearchParams('tab=goal&steps=pending'), {
      steps: 'pending',
    }),
    '/life-coach/career?tab=goal'
  );
});
