import { toDay } from './dates.js';

/** Named colors keep imported values safe for CSS and consistent with the editor. */
export const ENTRY_COLORS = { blue: '#245ec7', green: '#26734d', amber: '#976000', rose: '#ad3654', violet: '#7450a3', slate: '#555555' };

/**
 * @typedef {{description?: string, category?: string, color?: keyof typeof ENTRY_COLORS}} EntryDetails
 * @typedef {{id: string, title: string, kind: 'event', start: string, end: string|null} & EntryDetails} EventEntry
 * @typedef {{id: string, title: string, kind: 'task', start: string|null, finish: string, completed: boolean} & EntryDetails} TaskEntry
 * @typedef {EventEntry|TaskEntry} Entry
 */

/** Validate form input and untrusted storage, returning only the supported fields. */
export function validateEntry(entry) {
  if (!entry || typeof entry.id !== 'string' || !entry.id ||
      typeof entry.title !== 'string' || !entry.title.trim() || entry.title.length > 160) {
    throw new Error('Enter a title of up to 160 characters.');
  }
  const common = { id: entry.id, title: entry.title.trim(), kind: entry.kind };
  for (const [field, limit] of [['description', 20000], ['category', 40]]) {
    if (entry[field] === undefined) continue;
    if (typeof entry[field] !== 'string' || entry[field].length > limit) throw new Error(`${field === 'description' ? 'Description' : 'Category'} must be text of up to ${limit} characters.`);
    const value = field === 'category' ? entry[field].trim() : entry[field];
    if (value) common[field] = value;
  }
  if (entry.color !== undefined && entry.color !== '') {
    if (typeof entry.color !== 'string' || !Object.hasOwn(ENTRY_COLORS, entry.color)) throw new Error('Choose a supported entry color.');
    common.color = entry.color;
  }
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
