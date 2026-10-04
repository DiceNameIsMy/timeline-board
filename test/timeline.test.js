import test from 'node:test';
import assert from 'node:assert/strict';
import { toDay, MIN_DAY, MAX_DAY } from '../src/dates.js';
import { dayPosition, layoutEntries, makeRange, makeTicks, LABEL_WIDTH } from '../src/timeline.js';

const start = toDay('2026-10-01');
const range = { start, end: start + 90 };
const entry = (id, date, end = null) => ({ id, title: id, kind: 'event', start: date, end, completed: false });

test('date positions remain proportional at every scale', () => {
  for (const scale of [3, 12, 32]) {
    assert.equal(dayPosition(start + 14, start, scale), 2 * dayPosition(start + 7, start, scale));
  }
});

test('duration bars include the last calendar day', () => {
  const [sameDay, duration] = layoutEntries([
    entry('a', '2026-10-01', '2026-10-01'), entry('b', '2026-10-03', '2026-10-05'),
  ], range, 32);
  assert.equal(sameDay.durationWidth, 32);
  assert.equal(duration.durationWidth, 96);
});

test('same-day entries and overlapping labels get different lanes without moving dates', () => {
  const items = layoutEntries([
    entry('a', '2026-10-01'), entry('b', '2026-10-01'), entry('c', '2026-10-02'),
  ], range, 12);
  assert.equal(new Set(items.map(item => item.lane)).size, 3);
  assert.deepEqual(items.map(item => item.left), [0, 0, 12]);
});

test('a lane is reused only after the previous label or duration clears', () => {
  const items = layoutEntries([
    entry('a', '2026-10-01', '2026-10-20'), entry('b', '2026-10-15'), entry('c', '2026-11-01'),
  ], range, 32);
  assert.equal(items[0].lane, 0);
  assert.equal(items[1].lane, 1);
  assert.equal(items[2].lane, 0);
  for (const item of items) assert.ok(item.width >= LABEL_WIDTH);
});

test('durations starting before the canvas remain visible and dates outside it are excluded', () => {
  const items = layoutEntries([
    entry('a', '2026-09-01', '2026-10-10'),
    entry('b', '2025-01-01'), entry('c', '2027-01-01'),
  ], range, 12);
  assert.equal(items.length, 1);
  assert.equal(items[0].left, 0);
  assert.equal(items[0].durationWidth, 120);
});

test('markers and durations before the canvas are not moved onto its boundary', () => {
  const items = layoutEntries([
    entry('point', '2026-09-30'), entry('duration', '2026-09-29', '2026-09-30'),
  ], range, 12);
  assert.deepEqual(items, []);
});

test('bounded ranges preserve scale and respect supported date boundaries', () => {
  const middle = makeRange(start, 12, 1000);
  assert.ok(middle.start < start && middle.end > start);
  assert.ok((middle.end - middle.start) * 12 >= 4000);
  assert.equal(makeRange(MIN_DAY, 3, 1000).start, MIN_DAY);
  assert.equal(makeRange(MAX_DAY, 3, 1000).end, MAX_DAY + 1);
});

test('weekly ticks fall on Mondays and monthly ticks follow unequal calendar months', () => {
  for (const tick of makeTicks(range, 12)) assert.equal(new Date(tick.day * 86400000).getUTCDay(), 1);
  const ticks = makeTicks({ start: toDay('2024-01-01'), end: toDay('2024-04-01') }, 3);
  assert.deepEqual(ticks.map(tick => tick.day), ['2024-01-01', '2024-02-01', '2024-03-01'].map(toDay));
  assert.equal(ticks[1].day - ticks[0].day, 31);
  assert.equal(ticks[2].day - ticks[1].day, 29);
});

test('ticks remain valid at both calendar limits', () => {
  for (const scale of [3, 12, 32]) {
    assert.doesNotThrow(() => makeTicks(makeRange(MIN_DAY, scale, 1000), scale));
    assert.doesNotThrow(() => makeTicks(makeRange(MAX_DAY, scale, 1000), scale));
  }
});
