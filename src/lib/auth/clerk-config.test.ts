import assert from 'node:assert/strict';
import test from 'node:test';
import {isClerkConfigured} from './clerk-config.ts';

const ORIGINAL_SECRET = process.env.CLERK_SECRET_KEY;
const ORIGINAL_PUBLISHABLE = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;

function restoreEnv() {
  if (ORIGINAL_SECRET === undefined) {
    delete process.env.CLERK_SECRET_KEY;
  } else {
    process.env.CLERK_SECRET_KEY = ORIGINAL_SECRET;
  }

  if (ORIGINAL_PUBLISHABLE === undefined) {
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  } else {
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = ORIGINAL_PUBLISHABLE;
  }
}

test('isClerkConfigured is false when keys are missing or placeholders', () => {
  try {
    delete process.env.CLERK_SECRET_KEY;
    delete process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
    assert.equal(isClerkConfigured(), false);

    process.env.CLERK_SECRET_KEY = 'sk_test_...';
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_...';
    assert.equal(isClerkConfigured(), false);

    process.env.CLERK_SECRET_KEY = 'sk_test_real';
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_...';
    assert.equal(isClerkConfigured(), false);
  } finally {
    restoreEnv();
  }
});

test('isClerkConfigured is true when both keys are real values', () => {
  try {
    process.env.CLERK_SECRET_KEY = 'sk_test_real_secret';
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY = 'pk_test_real_publishable';
    assert.equal(isClerkConfigured(), true);
  } finally {
    restoreEnv();
  }
});
