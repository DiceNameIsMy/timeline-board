import { toDay } from './dates.js';

export const LEGACY_STORAGE_KEY = 'timeline-board';
export const STORAGE_KEY = 'timeline-board-v2';

/**
 * @typedef {{id: string, title: string, kind: 'event', start: string, end: string|null}} EventEntry
 * @typedef {{id: string, title: string, kind: 'task', start: string|null, finish: string, completed: boolean}} TaskEntry
 * @typedef {EventEntry|TaskEntry} Entry
 */

/** Validate form input and untrusted storage, returning only the supported fields. */
export function validateEntry(entry) {
  if (!entry || typeof entry.id !== 'string' || !entry.id ||
      typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 160) {
    throw new Error('Enter a title of up to 160 characters.');
  }
  const common = { id: entry.id, title: entry.title.trim(), kind: entry.kind };
  if (entry.kind === 'event') {
    const start = toDay(entry.start);
    if (entry.end !== null && toDay(entry.end) < start) throw new Error('End date must be on or after the start date.');
    return { ...common, start: entry.start, end: entry.end };
  }
  if (entry.kind === 'task') {
    const finish = toDay(entry.finish);
    if (entry.start !== null && toDay(entry.start) > finish) throw new Error('Planned start must be on or before the finish date.');
    if (typeof entry.completed !== 'boolean') throw new Error('Check the task completion state.');
    return { ...common, start: entry.start, finish: entry.finish, completed: entry.completed };
  }
  throw new Error('Choose Event or Task.');
}

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
  const record = JSON.parse(raw);
  if (!record || record.version !== version || !Array.isArray(record.entries)) throw new Error('Unsupported data.');
  const entries = record.entries.map(convert);
  if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('Duplicate IDs.');
  return entries;
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
