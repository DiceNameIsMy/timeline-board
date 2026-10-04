import test from 'node:test';
import assert from 'node:assert/strict';
import { toDay, fromDay, MIN_DAY, MAX_DAY } from '../src/dates.js';
import { dayPosition, entryDates, layoutEntries, makeRange, makeTicks, visibleEntries } from '../src/timeline.js';

const range = makeRange('2026-10-04', 3);
const event = (id, start, end = null) => ({ id, title: id, kind: 'event', start, end });
const task = (id, finish, start = null, completed = false) => ({ id, title: id, kind: 'task', start, finish, completed });

test('outlooks use calendar months and preserve month-end dates', () => {
  assert.equal(fromDay(makeRange('2026-10-04', 3).end), '2027-01-04');
  assert.equal(fromDay(makeRange('2024-01-31', 1).end), '2024-02-29');
  assert.equal(fromDay(makeRange('2026-10-04', 6).end), '2027-04-04');
  assert.throws(() => makeRange('2026-10-04', 2));
});

test('equal day intervals occupy equal distances at every width and horizon', () => {
  for (const months of [1, 3, 6]) for (const width of [280, 800, 1400]) {
    const outlook = makeRange('2026-10-04', months);
    const x = day => dayPosition(outlook.start + day, outlook, width);
    assert.ok(Math.abs((x(14) - x(0)) - 2 * (x(7) - x(0))) < 1e-9);
    assert.equal(dayPosition(outlook.start, outlook, width), 24);
    assert.equal(dayPosition(outlook.end, outlook, width), width - 24);
  }
});

test('single-date tasks use finish dates and events use their dates', () => {
  assert.deepEqual(entryDates(task('a', '2026-10-20')), { start: '2026-10-20', end: '2026-10-20' });
  assert.deepEqual(entryDates(event('b', '2026-10-10')), { start: '2026-10-10', end: '2026-10-10' });
});

test('intersecting intervals and endpoints are visible; completed tasks are optional', () => {
  const entries = [
    event('past', '2026-10-03'), event('future', '2027-01-05'),
    event('starts-before', '2026-09-01', '2026-10-05'),
    task('finishes-after', '2027-02-01', '2026-12-01'),
    event('first', '2026-10-04'), task('last', '2027-01-04'), task('done', '2026-11-01', null, true),
  ];
  assert.deepEqual(visibleEntries(entries, range, false).map(entry => entry.id), ['starts-before', 'finishes-after', 'first', 'last']);
  assert.equal(visibleEntries(entries, range, true).length, 5);
});

test('tasks connect at finish, event intervals at their midpoint, with exact endpoint positions', () => {
  const { items, padding } = layoutEntries([
    task('project', '2026-11-01', '2026-10-10'), event('travel', '2026-11-10', '2026-11-20'),
  ], range, 1000);
  const project = items.find(item => item.entry.id === 'project');
  const travel = items.find(item => item.entry.id === 'travel');
  assert.equal(project.x, dayPosition(toDay('2026-11-01'), range, 1000, padding));
  assert.ok(Math.abs(travel.x - (travel.x1 + travel.x2) / 2) < 1e-9);
  assert.equal(project.x1, dayPosition(toDay('2026-10-10'), range, 1000, padding));
  assert.equal(project.x2, project.x);
});

test('same-day intervals render as points', () => {
  const { items, axisY } = layoutEntries([
    task('a', '2026-11-01', '2026-11-01'), event('b', '2026-11-01', '2026-11-01'),
  ], range, 800);
  for (const item of items) {
    assert.equal(item.x1, item.x2);
    assert.equal(item.markerY, axisY);
    assert.equal(item.rail, undefined);
  }
});

test('clipped intervals keep full dates, continuation flags, and visible anchors', () => {
  const { items, padding } = layoutEntries([
    event('travel', '2026-09-01', '2027-02-01'), task('project', '2027-02-01', '2026-12-01'),
  ], range, 800);
  assert.equal(items[0].before, true);
  assert.equal(items[0].after, true);
  assert.equal(items[0].x1, padding);
  assert.equal(items[0].x2, 800 - padding);
  assert.equal(items[0].dates.start, '2026-09-01');
  assert.equal(items[1].x, 800 - padding);
});

test('overlapping intervals use separate rails; disjoint intervals reuse a rail', () => {
  const { items } = layoutEntries([
    event('a', '2026-10-10', '2026-11-10'), event('b', '2026-10-20', '2026-11-01'), event('c', '2026-12-01', '2026-12-10'),
  ], range, 1000);
  assert.notEqual(items[0].rail, items[1].rail);
  assert.equal(items[0].rail, items[2].rail);
});

function overlap(a, b) {
  return a.left < b.left + b.boxWidth && b.left < a.left + a.boxWidth && a.y < b.y + b.boxHeight && b.y < a.y + a.boxHeight;
}
test('crowded boxes never overlap, stay in bounds, and each has one direct connector', () => {
  const entries = Array.from({ length: 16 }, (_, index) => index % 2
    ? task(`task-${index}`, '2026-11-01') : event(`event-${index}`, '2026-11-01'));
  const sizes = new Map(entries.map((entry, index) => [entry.id, 64 + index * 7]));
  for (const width of [280, 800, 1400]) for (const unit of [1, 2]) {
    const layout = layoutEntries(entries, range, width, sizes, unit);
    assert.equal(layout.items.length, entries.length);
    for (const item of layout.items) {
      assert.ok(item.left >= 0 && item.left + item.boxWidth <= width);
      assert.ok(item.y >= 0 && item.y + item.boxHeight <= layout.height);
      assert.equal((item.connector.match(/M /g) ?? []).length, 1);
      assert.ok(item.connector.startsWith(`M ${item.x} ${layout.axisY} L ${item.x} ${item.markerY}`));
      if (item.side === 'above') assert.ok(item.y + item.boxHeight < layout.axisY);
      else assert.ok(item.y > layout.axisY);
    }
    for (let a = 0; a < layout.items.length; a++) for (let b = a + 1; b < layout.items.length; b++) {
      assert.equal(overlap(layout.items[a], layout.items[b]), false);
    }
  }
});

test('crowded label layout never shifts the shared date anchor', () => {
  const { items } = layoutEntries([task('a', '2026-10-04'), task('b', '2026-10-04')], range, 280);
  assert.notEqual(items[0].row, items[1].row);
  assert.equal(items[0].x, items[1].x);
  assert.equal(items[0].x, 24);
});

test('month ticks are positioned by unequal calendar months and sparse on small screens', () => {
  const outlook = makeRange('2024-01-01', 3);
  const ticks = makeTicks(outlook, 1000).filter(tick => tick.major);
  assert.deepEqual(ticks.map(tick => fromDay(tick.day)), ['2024-01-01', '2024-02-01', '2024-03-01', '2024-04-01']);
  assert.equal(ticks[1].day - ticks[0].day, 31);
  assert.equal(ticks[2].day - ticks[1].day, 29);
  const small = makeTicks(makeRange('2026-10-04', 6), 280);
  assert.ok(small.filter(tick => tick.label).length < small.length);
});

test('empty layouts and supported calendar bounds remain finite', () => {
  for (const date of [fromDay(MIN_DAY), fromDay(MAX_DAY)]) {
    const outlook = makeRange(date, 6);
    const layout = layoutEntries([], outlook, 280);
    assert.ok(Number.isFinite(layout.height));
    assert.doesNotThrow(() => makeTicks(outlook, 280));
    assert.ok(Number.isFinite(dayPosition(outlook.start, outlook, 280)));
  }
});
