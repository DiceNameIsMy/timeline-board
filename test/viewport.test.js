import test from 'node:test';
import assert from 'node:assert/strict';
import { toDay, MIN_DAY, MAX_DAY } from '../src/dates.js';
import { outlookDays, viewportRange, makeScrollBuffer, scrollViewStart, shiftViewStart } from '../src/viewport.js';
import { dayPosition, makeTicks, visibleEntries, layoutEntries } from '../src/timeline.js';

const start = toDay('2026-10-04');
const close = (a, b) => assert.ok(Math.abs(a - b) < 1e-8, `${a} != ${b}`);

test('zoom uses calendar months, including leap days and valid spans at calendar bounds', () => {
  assert.equal(outlookDays(toDay('2024-01-31'), 1), 29);
  assert.equal(outlookDays(start, 3), 92);
  assert.equal(outlookDays(start, 6), 182);
  for (const day of [MIN_DAY, MAX_DAY]) for (const months of [1, 3, 6]) {
    assert.ok(outlookDays(day, months) >= 28);
  }
  assert.throws(() => outlookDays(start, 2));
});

test('native scrolling moves dates and markers by matching pixel distances without changing scale', () => {
  for (const width of [280, 800, 1400]) for (const months of [1, 3, 6]) {
    const span = outlookDays(start, months);
    const buffer = makeScrollBuffer(start, span, width);
    const next = scrollViewStart(buffer.origin, buffer.scrollLeft + 113.5, span, width);
    close(dayPosition(start + 14, viewportRange(start, span), width)
      - dayPosition(start + 14, viewportRange(next, span), width), 113.5);
    close(viewportRange(next, span).end - next, span);
  }
});

test('repeated scroll buffer recentering preserves fractional dates in both directions', () => {
  let day = start + 0.125;
  const span = 92;
  const width = 800;
  for (const direction of [1, -1]) for (let index = 0; index < 100; index++) {
    const buffer = makeScrollBuffer(day, span, width);
    assert.ok(buffer.width <= width * 5);
    close(scrollViewStart(buffer.origin, buffer.scrollLeft, span, width), day);
    const next = scrollViewStart(buffer.origin, buffer.scrollLeft + direction * 1000, span, width);
    close(next - day, direction * 1000 * span / (width - 48));
    day = next;
  }
  close(day, start + 0.125);
});

test('calendar bounds stop scrolling without collapsing the viewport or producing invalid ticks', () => {
  for (const day of [MIN_DAY - 100, MAX_DAY + 100]) {
    const range = viewportRange(day, 92);
    assert.ok(range.start >= MIN_DAY && range.end <= MAX_DAY);
    assert.equal(range.end - range.start, 92);
    const buffer = makeScrollBuffer(range.start, 92, 280);
    close(scrollViewStart(buffer.origin, buffer.scrollLeft, 92, 280), range.start);
    assert.doesNotThrow(() => makeTicks(range, 280));
  }
  assert.equal(shiftViewStart(MIN_DAY, -1, 92), MIN_DAY);
  assert.equal(shiftViewStart(MAX_DAY - 92, 1, 92), MAX_DAY - 92);
});

test('month navigation retains fractional positions and clamps month-end dates', () => {
  close(shiftViewStart(toDay('2024-01-31') + 0.25, 1, 92), toDay('2024-02-29') + 0.25);
});

test('today alignment and left anchor survive zoom and viewport resize', () => {
  for (const months of [1, 3, 6]) for (const width of [280, 1400]) {
    const span = outlookDays(start, months);
    const range = viewportRange(start, span);
    assert.equal(dayPosition(start, range, width), 24);
    const buffer = makeScrollBuffer(start, span, width);
    close(scrollViewStart(buffer.origin, buffer.scrollLeft, span, width), start);
  }
});

test('fractional viewport ticks use real dates and scrolled intervals retain clipping and filtering', () => {
  const range = viewportRange(start + 7.25, 92);
  assert.ok(makeTicks(range, 1400).every(tick => Number.isInteger(tick.day)));
  const entries = [
    { id: 'interval', title: 'interval', kind: 'event', start: '2026-09-01', end: '2027-03-01' },
    { id: 'past', title: 'past', kind: 'event', start: '2026-10-04', end: null },
    { id: 'done', title: 'done', kind: 'task', finish: '2026-11-01', start: null, completed: true },
  ];
  assert.deepEqual(visibleEntries(entries, range, false).map(entry => entry.id), ['interval']);
  assert.equal(visibleEntries(entries, range, true).length, 2);
  const { items } = layoutEntries(visibleEntries(entries, range, false), range, 800);
  assert.equal(items[0].before, true);
  assert.equal(items[0].after, true);
});
