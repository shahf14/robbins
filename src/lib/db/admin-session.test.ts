import assert from 'node:assert/strict';
import test from 'node:test';

process.env.ADMIN_API_TOKEN = 'test-admin-secret';

const {createAdminSessionValue, verifyAdminSessionValue, parseCookies} = await import('./admin-session.ts');

test('admin session signs and verifies for the same user', () => {
  const token = createAdminSessionValue('user-1', 1_700_000_000_000);
  assert.ok(token);
  assert.equal(verifyAdminSessionValue(token!, 'user-1', 1_700_000_000_000), true);
  assert.equal(verifyAdminSessionValue(token!, 'user-2', 1_700_000_000_000), false);
});

test('admin session expires after max age', () => {
  const token = createAdminSessionValue('user-1', 1_700_000_000_000);
  assert.equal(verifyAdminSessionValue(token!, 'user-1', 1_700_000_000_000 + 3_600_001), false);
});

test('parseCookies reads admin session cookie', () => {
  const cookies = parseCookies('NEXT_LOCALE=he; robbins_admin_session=abc.def.ghi');
  assert.equal(cookies.robbins_admin_session, 'abc.def.ghi');
});
