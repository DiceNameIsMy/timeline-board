import test from 'node:test';
import assert from 'node:assert/strict';
import { parseEntriesFile, serializeEntriesFile, migrateEntry } from '../src/storage.js';

const entries = [
  { id: 'one', title: 'Exam', kind: 'event', start: '2026-10-20', end: null, description: 'Notes\nhttps://example.org', category: 'Exam', color: 'rose' },
  { id: 'two', title: 'Project', kind: 'task', start: '2026-10-04', finish: '2026-11-01', completed: true },
];

test('portable JSON round-trips all entry details, stable IDs and completed tasks', () => {
  const file = serializeEntriesFile(entries);
  assert.equal(JSON.parse(file).format, 'timeline-board');
  assert.equal(JSON.parse(file).version, 2);
  assert.deepEqual(parseEntriesFile(file), entries);
  assert.deepEqual(parseEntriesFile(`\uFEFF${file}`), entries);
  assert.deepEqual(parseEntriesFile(serializeEntriesFile([])), []);
});

test('files accept existing v2 records and migrate legacy files', () => {
  assert.deepEqual(parseEntriesFile(JSON.stringify({ version: 2, entries })), entries);
  const old = { id: 'old', title: 'Old task', kind: 'deadline', start: '2026-10-04', end: null, completed: false };
  assert.deepEqual(parseEntriesFile(JSON.stringify({ version: 1, entries: [old] })), [migrateEntry(old)]);
});

test('whole-file validation rejects malformed, foreign, future and partially invalid imports', () => {
  for (const file of ['{bad', 'null', JSON.stringify({ format: 'another-app', version: 2, entries }), JSON.stringify({ version: 3, entries }), JSON.stringify({ version: 2, entries: [entries[0], entries[0]] }), JSON.stringify({ version: 2, entries: [entries[0], { ...entries[1], finish: '2026-02-30' }] })]) {
    assert.throws(() => parseEntriesFile(file));
  }
  assert.throws(() => serializeEntriesFile([entries[0], entries[0]]));
});
