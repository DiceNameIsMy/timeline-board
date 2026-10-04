import test from 'node:test';
import assert from 'node:assert/strict';
import { validateEntry } from '../src/entries.js';
import { loadEntries, saveEntries, STORAGE_KEY } from '../src/storage.js';
import { descriptionLinks } from '../src/notes.js';

const entry = { id: 'one', title: 'Project', kind: 'task', start: null, finish: '2026-10-20', completed: false };

test('existing entries remain valid; descriptions, categories and colors survive persistence', () => {
  assert.deepEqual(validateEntry(entry), entry);
  const detailed = { ...entry, description: 'Notes\nhttps://example.org/project', category: 'Project', color: 'violet' };
  let record = null;
  const storage = { getItem: key => key === STORAGE_KEY ? record : null, setItem: (key, value) => { record = value; } };
  assert.equal(saveEntries(storage, [detailed]), null);
  assert.deepEqual(loadEntries(storage).entries, [detailed]);
  assert.equal(JSON.parse(record).version, 2);
});

test('empty optional fields are omitted, categories trim, and note whitespace is preserved', () => {
  assert.deepEqual(validateEntry({ ...entry, description: '', category: '   ', color: '' }), entry);
  assert.equal(validateEntry({ ...entry, category: ' Exam ' }).category, 'Exam');
  assert.equal(validateEntry({ ...entry, description: '  notes\n' }).description, '  notes\n');
});

test('malformed details block saved data instead of silently dropping it', () => {
  for (const patch of [{ description: 5 }, { description: null }, { description: 'x'.repeat(20001) }, { category: [] }, { category: 'x'.repeat(41) }, { color: ['blue'] }, { color: 'url(javascript:alert(1))' }, { color: '__proto__' }]) {
    assert.throws(() => validateEntry({ ...entry, ...patch }));
    const raw = JSON.stringify({ version: 2, entries: [{ ...entry, ...patch }] });
    assert.equal(loadEntries({ getItem: () => raw }).blocked, true);
  }
});

test('plain text notes expose only distinct HTTP(S) links', () => {
  assert.deepEqual(descriptionLinks('See https://example.org/a, and https://example.org/a.\nhttp://example.org/b'), ['https://example.org/a', 'http://example.org/b']);
  assert.deepEqual(descriptionLinks('<script>alert(1)</script> javascript:alert(1) file:///tmp/a https://'), []);
});
