import test from 'node:test';
import assert from 'node:assert/strict';
import { STORAGE_KEY, loadEntries, saveEntries, validateEntry } from '../src/storage.js';

const entry = { id: 'one', title: 'Project deadline', kind: 'deadline', start: '2026-10-04', end: null, completed: false };
function memoryStorage(initial = null) {
  let value = initial;
  return {
    getItem(key) { assert.equal(key, STORAGE_KEY); return value; },
    setItem(key, next) { assert.equal(key, STORAGE_KEY); value = next; },
  };
}

test('a fresh browser starts empty and a save survives reloading', () => {
  const storage = memoryStorage();
  assert.deepEqual(loadEntries(storage), { entries: [], error: null, blocked: false });
  assert.equal(saveEntries(storage, [entry]), null);
  assert.deepEqual(loadEntries(storage).entries, [entry]);
});

test('task completion and duration dates round-trip', () => {
  const storage = memoryStorage();
  const task = { ...entry, kind: 'task', end: '2026-10-10', completed: true };
  saveEntries(storage, [task]);
  assert.deepEqual(loadEntries(storage).entries, [task]);
});

test('malformed, unsupported, duplicate, and invalid stored records remain untouched', () => {
  for (const raw of [
    '{broken', 'null', JSON.stringify({ version: 2, entries: [] }),
    JSON.stringify({ version: 1, entries: [entry, entry] }),
    JSON.stringify({ version: 1, entries: [{ ...entry, start: '2026-02-30' }] }),
  ]) {
    const storage = memoryStorage(raw);
    const result = loadEntries(storage);
    assert.equal(result.blocked, true);
    assert.ok(result.error);
    assert.equal(storage.getItem(STORAGE_KEY), raw);
  }
});

test('blocked reads and failed writes produce actionable errors', () => {
  const storage = { getItem() { throw new Error('Denied'); }, setItem() { throw new Error('Full'); } };
  assert.equal(loadEntries(storage).blocked, true);
  assert.match(saveEntries(storage, [entry]), /could not be saved/);
  assert.equal(loadEntries(null).blocked, true);
});

test('invalid titles, date ordering, type, and completion state are rejected', () => {
  for (const patch of [
    { title: '   ' }, { title: 'x'.repeat(161) }, { end: '2026-10-03' },
    { end: '' }, { start: '2026-02-29' }, { kind: 'other' }, { completed: true },
  ]) assert.throws(() => validateEntry({ ...entry, ...patch }));
  assert.equal(validateEntry({ ...entry, title: '  Deadline  ' }).title, 'Deadline');
});
