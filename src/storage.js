import { toDay } from './dates.js';
import { validateEntry } from './entries.js';

export { validateEntry } from './entries.js';
/** @typedef {import('./entries.js').Entry} Entry */

export const LEGACY_STORAGE_KEY = 'timeline-board';
export const STORAGE_KEY = 'timeline-board-v2';

/** Convert a legacy entry without modifying its stored copy. */
export function migrateEntry(entry) {
  if (!entry || !['event', 'task', 'deadline'].includes(entry.kind) ||
      typeof entry.completed !== 'boolean' || (entry.kind !== 'task' && entry.completed)) {
    throw new Error('Invalid legacy entry.');
  }
  const start = toDay(entry.start);
  if (entry.end !== null && toDay(entry.end) < start) throw new Error('Invalid legacy dates.');
  if (entry.kind === 'event') return validateEntry(entry);
  return validateEntry({
    id: entry.id, title: entry.title, kind: 'task',
    start: entry.end === null ? null : entry.start,
    finish: entry.end ?? entry.start, completed: entry.completed,
  });
}

function readRecord(raw, version, convert) {
  const record = JSON.parse(raw.replace(/^\uFEFF/, ''));
  if (!record || record.version !== version || !Array.isArray(record.entries)) throw new Error('Unsupported data.');
  if (record.format !== undefined && record.format !== 'timeline-board') throw new Error('This file belongs to another application.');
  const entries = record.entries.map(convert);
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('Duplicate IDs.');
  return entries;
}

/** Validate the complete file before any UI state or saved data can be replaced. */
export function parseEntriesFile(raw) {
  const record = JSON.parse(raw.replace(/^\uFEFF/, ''));
  if (record?.version === 1) return readRecord(raw, 1, migrateEntry);
  return readRecord(raw, 2, validateEntry);
}

/** A portable, versioned file with all supported entry fields and stable IDs. */
export function serializeEntriesFile(entries) {
  const validated = entries.map(validateEntry);
  if (new Set(validated.map(entry => entry.id)).size !== validated.length) throw new Error('Duplicate IDs.');
  return `${JSON.stringify({ format: 'timeline-board', version: 2, entries: validated }, null, 2)}\n`;
}

/** A failed read blocks writes. An invalid v2 record never falls back to older data. */
export function loadEntries(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    const legacy = raw === null ? storage.getItem(LEGACY_STORAGE_KEY) : null;
    const entries = raw !== null ? readRecord(raw, 2, validateEntry)
      : legacy !== null ? readRecord(legacy, 1, migrateEntry) : [];
    return { entries, error: null, blocked: false };
  } catch {
    return {
      entries: [], blocked: true,
      error: 'Saved data could not be read. It has not been changed. Adding and editing are disabled; check browser storage access or recover your saved data before reloading.',
    };
  }
}

/** @param {Storage} storage @param {Entry[]} entries */
export function saveEntries(storage, entries) {
  try {
    const validated = entries.map(validateEntry);
    if (new Set(validated.map(entry => entry.id)).size !== validated.length) throw new Error('Duplicate IDs.');
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 2, entries: validated }));
    return null;
  } catch {
    return 'Changes could not be saved. They are only available until this page is closed or reloaded. Check browser storage access and save again.';
  }
}
