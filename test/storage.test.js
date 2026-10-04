import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, LEGACY_STORAGE_KEY, loadEntries, saveEntries, validateEntry } from '../src/storage.js';

const event = { id: 'event', title: 'Travel', kind: 'event', start: '2026-10-04', end: '2026-10-10' };
const task = { id: 'task', title: 'Submit project', kind: 'task', start: null, finish: '2026-10-20', completed: false };
const legacy = (patch = {}) => ({ id: 'old', title: 'Project', kind: 'task', start: '2026-10-04', end: null, completed: false, ...patch });
const record = (entries, version = 2) => JSON.stringify({ version, entries });
function memoryStorage(initial = {}) {
  const values = new Map(Object.entries(initial));
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
}

test('fresh storage starts empty; events, task intervals, and completion survive reload', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadEntries(storage), { entries: [], error: null, blocked: false });
  const entries = [event, task, { ...task, id: 'done', start: '2026-10-01', completed: true }];
  assert.equal(saveEntries(storage, entries), null);
  assert.deepEqual(loadEntries(storage).entries, entries);
  assert.equal(JSON.parse(storage.getItem(STORAGE_KEY)).version, 2);
});

test('legacy events, deadlines, dated tasks, and task ranges migrate without changing original data', () => {
  const old = record([
    legacy({ id: 'event', kind: 'event', end: '2026-10-10' }),
    legacy({ id: 'deadline', kind: 'deadline' }),
    legacy({ id: 'task' }),
    legacy({ id: 'duration', end: '2026-10-20', completed: true }),
  ], 1);
  const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: old });
  const loaded = loadEntries(storage);
  assert.equal(loaded.blocked, false);
  assert.deepEqual(loaded.entries, [
    event,
    { ...task, id: 'deadline', title: 'Project', finish: '2026-10-04' },
    { ...task, title: 'Project', finish: '2026-10-04' },
    { ...task, id: 'duration', title: 'Project', start: '2026-10-04', completed: true },
  ].map(entry => entry.id === 'event' ? { ...entry, title: 'Project' } : entry));
  assert.equal(storage.getItem(STORAGE_KEY), null);
  assert.equal(saveEntries(storage, loaded.entries), null);
  assert.equal(storage.getItem(LEGACY_STORAGE_KEY), old);
  assert.deepEqual(loadEntries(storage).entries, loaded.entries);
});

test('new data takes precedence, including an intentionally empty timeline', () => {
  const storage = memoryStorage({
    [STORAGE_KEY]: record([]), [LEGACY_STORAGE_KEY]: record([legacy()], 1),
  });
  assert.deepEqual(loadEntries(storage).entries, []);
});

test('invalid v2 data blocks editing rather than resurrecting legacy entries', () => {
  for (const raw of ['{broken', 'null', record([], 3), record([event, event]), record([{ ...task, finish: '2026-02-30' }])]) {
    const storage = memoryStorage({ [STORAGE_KEY]: raw, [LEGACY_STORAGE_KEY]: record([legacy()], 1) });
    const result = loadEntries(storage);
    assert.equal(result.blocked, true);
    assert.ok(result.error);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});

test('malformed legacy data is preserved and never partially migrated', () => {
  for (const raw of ['{broken', record([legacy({ kind: 'other' })], 1), record([legacy(), legacy()], 1), record([legacy({ end: undefined })], 1)]) {
    const storage = memoryStorage({ [LEGACY_STORAGE_KEY]: raw });
    assert.equal(loadEntries(storage).blocked, true);
    assert.equal(storage.getItem(LEGACY_STORAGE_KEY), raw);
    assert.equal(storage.getItem(STORAGE_KEY), null);
  }
});

test('failed reads and writes produce errors; invalid saves leave the prior record intact', () => {
  const denied = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Full'); } };
  assert.equal(loadEntries(denied).blocked, true);
  assert.match(saveEntries(denied, [event]), /could not be saved/);
  assert.equal(loadEntries(null).blocked, true);
  const storage = memoryStorage({ [STORAGE_KEY]: record([event]) });
  assert.ok(saveEntries(storage, [task, task]));
  assert.equal(storage.getItem(STORAGE_KEY), record([event]));
});

test('task finish is required, planned start is optional, and ordering is validated', () => {
  assert.deepEqual(validateEntry(task), task);
  for (const patch of [{ title: '   ' }, { title: 'x'.repeat(161) }, { finish: '' }, { start: '2026-10-21' }, { start: '' }, { completed: 'yes' }]) {
    assert.throws(() => validateEntry({ ...task, ...patch }));
  }
  assert.equal(validateEntry({ ...task, title: '  Project  ' }).title, 'Project');
});

test('event dates are ordered and the deadline type is removed', () => {
  assert.throws(() => validateEntry({ ...event, end: '2026-10-03' }));
  assert.throws(() => validateEntry({ ...event, end: '' }));
  assert.throws(() => validateEntry({ ...task, kind: 'deadline' }));
  assert.deepEqual(validateEntry({ ...event, end: null, completed: false }), { ...event, end: null });
});
