import { toDay } from './dates.js';

export const STORAGE_KEY = 'timeline-board';

/**
 * @typedef {object} Entry
 * @property {string} id
 * @property {string} title
 * @property {'event'|'deadline'|'task'} kind
 * @property {string} start
 * @property {string|null} end
 * @property {boolean} completed
 */

/** Validate entries from both forms and untrusted browser storage. */
export function validateEntry(entry) {
  if (!entry || typeof entry.id !== 'string' || !entry.id ||
      typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 160 ||
      !['event', 'deadline', 'task'].includes(entry.kind) ||
      typeof entry.completed !== 'boolean' || (entry.kind !== 'task' && entry.completed)) {
    throw new Error('Check the title and entry type.');
  }
  const start = toDay(entry.start);
  if (entry.end !== null && toDay(entry.end) < start) {
    throw new Error('End date must be on or after the start date.');
  }
  return {
    id: entry.id, title: entry.title.trim(), kind: entry.kind,
    start: entry.start, end: entry.end, completed: entry.completed,
  };
}

/** A failed read blocks writes so existing data cannot be overwritten accidentally. */
export function loadEntries(storage) {
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw === null) return { entries: [], error: null, blocked: false };
    const record = JSON.parse(raw);
    if (!record || record.version !== 1 || !Array.isArray(record.entries)) throw new Error('Unsupported data.');
    const entries = record.entries.map(validateEntry);
    if (new Set(entries.map(entry => entry.id)).size !== entries.length) throw new Error('Duplicate IDs.');
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
    storage.setItem(STORAGE_KEY, JSON.stringify({ version: 1, entries: entries.map(validateEntry) }));
    return null;
  } catch {
    return 'Changes could not be saved. They are only available until this page is closed or reloaded. Check browser storage access and save again.';
  }
}
