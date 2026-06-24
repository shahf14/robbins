import assert from 'node:assert/strict';
import {test} from 'node:test';
import {expandTextRequestSchema, inspireGoalRequestSchema} from './ai-request-schemas.ts';

test('inspireGoalRequestSchema accepts valid goal mode payload', () => {
  const parsed = inspireGoalRequestSchema.safeParse({
    domain: 'health',
    category: 'fitness',
    locale: 'he',
    mode: 'goal',
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.mode, 'goal');
  assert.equal(parsed.data.goal_text, '');
});

test('inspireGoalRequestSchema rejects unsupported domain and overlong fields', () => {
  assert.equal(
    inspireGoalRequestSchema.safeParse({
      domain: 'not_a_domain',
      category: 'fitness',
    }).success,
    false
  );

  assert.equal(
    inspireGoalRequestSchema.safeParse({
      domain: 'health',
      category: 'x'.repeat(121),
    }).success,
    false
  );

  assert.equal(
    inspireGoalRequestSchema.safeParse({
      domain: 'health',
      category: 'fitness',
      goal_text: 'x'.repeat(1001),
    }).success,
    false
  );

  assert.equal(
    inspireGoalRequestSchema.safeParse({
      domain: 'health',
      category: 'fitness',
      mode: 'weekly',
    }).success,
    false
  );
});

test('expandTextRequestSchema accepts valid payload and trims text', () => {
  const parsed = expandTextRequestSchema.safeParse({
    text: '  I want more energy  ',
    context: 'goal motivation',
    locale: 'en',
  });

  assert.equal(parsed.success, true);
  if (!parsed.success) return;
  assert.equal(parsed.data.text, 'I want more energy');
  assert.equal(parsed.data.context, 'goal motivation');
});

test('expandTextRequestSchema rejects empty or overlong text and context', () => {
  assert.equal(expandTextRequestSchema.safeParse({text: '   '}).success, false);
  assert.equal(
    expandTextRequestSchema.safeParse({text: 'ok', context: 'x'.repeat(2001)}).success,
    false
  );
  assert.equal(expandTextRequestSchema.safeParse({text: 'x'.repeat(2001)}).success, false);
});
