import assert from 'node:assert/strict';
import {test} from 'node:test';
import {
  filterStepsForDomain,
  hasReusablePendingAiSteps,
} from './generate-daily-steps-scope.ts';
import type {DailyBabyStep} from './types.ts';

function step(
  partial: Pick<DailyBabyStep, 'domain' | 'generated_by_ai' | 'status'>
): DailyBabyStep {
  return {
    id: 'step-1',
    user_id: 'user-1',
    goal_id: null,
    title: 'Test',
    description: '',
    estimated_minutes: 5,
    difficulty: 'easy',
    scheduled_date: '2026-06-17',
    ...partial,
  } as DailyBabyStep;
}

test('filterStepsForDomain returns only matching domain steps', () => {
  const steps = [
    step({domain: 'career', generated_by_ai: true, status: 'pending'}),
    step({domain: 'wealth', generated_by_ai: true, status: 'pending'}),
  ];

  assert.equal(filterStepsForDomain(steps, 'career').length, 1);
  assert.equal(filterStepsForDomain(steps, 'career')[0]?.domain, 'career');
  assert.equal(filterStepsForDomain(steps).length, 2);
});

test('hasReusablePendingAiSteps ignores other domains and completed AI steps', () => {
  const steps = [
    step({domain: 'career', generated_by_ai: true, status: 'pending'}),
    step({domain: 'wealth', generated_by_ai: true, status: 'pending'}),
    step({domain: 'career', generated_by_ai: true, status: 'completed'}),
  ];

  assert.equal(hasReusablePendingAiSteps(steps, 'wealth'), true);
  assert.equal(hasReusablePendingAiSteps(steps, 'mind'), false);
  assert.equal(hasReusablePendingAiSteps(steps, 'career'), true);
  assert.equal(
    hasReusablePendingAiSteps(
      [step({domain: 'career', generated_by_ai: true, status: 'completed'})],
      'career'
    ),
    false
  );
});
