import test from 'node:test';
import assert from 'node:assert/strict';
import { toDay, fromDay, todayDate, MIN_DAY, MAX_DAY } from '../src/dates.js';

test('calendar dates round-trip, including early years and leap days', () => {
  for (const date of ['0001-01-01', '0099-12-31', '1900-03-01', '2000-02-29', '2024-02-29', '9999-12-31']) {
    assert.equal(fromDay(toDay(date)), date);
  }
});

test('invalid and normalized dates are rejected', () => {
  for (const date of ['2025-02-29', '1900-02-29', '2026-04-31', '2026-13-01', '0000-01-01', '26-01-01', '', null, undefined]) {
    assert.throws(() => toDay(date));
  }
  assert.throws(() => fromDay(MIN_DAY - 1));
  assert.throws(() => fromDay(MAX_DAY + 1));
});

test('calendar-day differences survive leap days and daylight-saving boundaries', () => {
  assert.equal(toDay('2024-03-01') - toDay('2024-02-28'), 2);
  assert.equal(toDay('2026-03-30') - toDay('2026-03-28'), 2);
  assert.equal(toDay('2026-10-26') - toDay('2026-10-24'), 2);
});

test('today comes from local calendar fields, not a UTC date slice', () => {
  const now = new Date(2026, 9, 4, 0, 1);
  assert.equal(todayDate(now), '2026-10-04');
});
