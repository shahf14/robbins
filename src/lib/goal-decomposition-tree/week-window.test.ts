import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {dirname, join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {test} from 'node:test';
import {dateToYMD} from '../date-utils.ts';
import {currentWeekRange, isoWeekWindow} from './week-window.ts';

const here = dirname(fileURLToPath(import.meta.url));

function trailingSevenDayWindowForDate(today: Date) {
  const end = dateToYMD(today);
  const start = new Date(today);
  start.setDate(start.getDate() - 6);
  return {start: dateToYMD(start), end};
}

test('currentWeekRange matches isoWeekWindow for today', () => {
  assert.deepEqual(currentWeekRange(), isoWeekWindow(dateToYMD(new Date())));
});

test('trailing seven-day window differs from ISO week on a midweek date', () => {
  const wednesday = new Date(2026, 5, 24);
  const iso = isoWeekWindow(dateToYMD(wednesday));
  const trailing = trailingSevenDayWindowForDate(wednesday);

  assert.notEqual(trailing.start, iso.start);
  assert.equal(trailing.end, '2026-06-24');
  assert.equal(iso.start, '2026-06-22');
  assert.equal(iso.end, '2026-06-28');
});

test('weekly review routes use trailingSevenDayWindow not calendar week helpers', () => {
  const cron = readFileSync(
    join(here, '..', '..', 'app', 'api', 'cron', 'life-coach', 'weekly-review', 'route.ts'),
    'utf8'
  );
  const route = readFileSync(
    join(here, '..', '..', 'app', 'api', 'life-coach', 'ai', 'weekly-review', 'route.ts'),
    'utf8'
  );
  const server = readFileSync(join(here, '..', 'life-coach', 'server.ts'), 'utf8');

  assert.match(server, /export function trailingSevenDayWindow/);
  assert.doesNotMatch(server, /currentWeekWindow/);
  assert.match(cron, /trailingSevenDayWindow\(\)/);
  assert.match(route, /trailingSevenDayWindow\(\)/);
  assert.doesNotMatch(cron, /currentWeekRange|isoWeekWindow/);
  assert.doesNotMatch(route, /currentWeekRange|isoWeekWindow/);
});
