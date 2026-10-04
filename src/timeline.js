import { toDay, fromDay, shiftMonths, formatMonth, MAX_DAY } from './dates.js';

/** Inclusive outlook endpoints, shifted using calendar months rather than fixed day counts. */
export function makeRange(date, months) {
  if (![1, 3, 6].includes(months)) throw new Error('Choose a 1, 3, or 6 month outlook.');
  return { start: toDay(date), end: toDay(shiftMonths(date, months)) };
}

export function dayPosition(day, range, width, padding = 24) {
  return padding + (day - range.start) / Math.max(1, range.end - range.start) * (width - padding * 2);
}

/** @param {import('./storage.js').Entry} entry */
export function entryDates(entry) {
  return entry.kind === 'task'
    ? { start: entry.start ?? entry.finish, end: entry.finish }
    : { start: entry.start, end: entry.end ?? entry.start };
}

/** Return intersecting entries; past/future portions of intervals are not discarded. */
export function visibleEntries(entries, range, showCompleted) {
  return entries.filter(entry => {
    if (entry.kind === 'task' && entry.completed && !showCompleted) return false;
    const dates = entryDates(entry);
    return toDay(dates.start) <= range.end && toDay(dates.end) >= range.start;
  });
}

/**
 * Pure geometry: shared label rows and interval rails below a fixed-height axis.
 * Boxes can move; all date markers retain their proportional positions.
 * @param {import('./storage.js').Entry[]} entries
 */
export function layoutEntries(entries, range, width, sizes = new Map(), unit = 1) {
  const padding = Math.min(24 * unit, width / 10);
  const boxWidth = Math.min(224 * unit, width - padding * 2);
  const gap = 12 * unit;
  const items = entries.map(entry => {
    const dates = entryDates(entry);
    const start = toDay(dates.start);
    const end = toDay(dates.end);
    const clippedStart = Math.max(start, range.start);
    const clippedEnd = Math.min(end, range.end);
    const anchor = entry.kind === 'task' ? clippedEnd : (clippedStart + clippedEnd) / 2;
    const x = dayPosition(anchor, range, width, padding);
    return {
      entry, dates, start, end, x,
      x1: dayPosition(clippedStart, range, width, padding),
      x2: dayPosition(clippedEnd, range, width, padding),
      before: start < range.start, after: end > range.end,
      left: Math.max(padding, Math.min(x - boxWidth / 2, width - padding - boxWidth)),
      boxWidth, boxHeight: sizes.get(entry.id) ?? 80 * unit,
      side: 'below',
    };
  });
  const railEnds = [];
  for (const item of items.filter(item => item.start !== item.end).sort((a, b) => a.x1 - b.x1 || a.entry.id.localeCompare(b.entry.id))) {
    let rail = railEnds.findIndex(end => end + 10 * unit < item.x1);
    if (rail === -1) rail = railEnds.length;
    railEnds[rail] = item.x2;
    item.rail = rail;
  }
  const rowEnds = [];
  const heights = [];
  for (const item of [...items].sort((a, b) => a.x - b.x || a.entry.id.localeCompare(b.entry.id))) {
    let row = rowEnds.findIndex(end => end + gap <= item.left);
    if (row === -1) row = rowEnds.length;
    rowEnds[row] = item.left + boxWidth;
    heights[row] = Math.max(heights[row] ?? 0, item.boxHeight);
    item.row = row;
  }
  const band = railEnds.length * 8 * unit;
  const total = heights.reduce((sum, height) => sum + height + gap, 0);
  const axisY = padding + 60 * unit;
  for (const item of items) {
    const preceding = heights.slice(0, item.row).reduce((sum, height) => sum + height + gap, 0);
    item.y = axisY + band + 72 * unit + preceding;
    // Interval rails stay below the axis; date labels stay above it.
    item.markerY = item.start === item.end ? axisY : axisY + 40 * unit + (item.rail + 1) * 8 * unit;
    const boxEdge = item.y;
    // One connector per box; its slight diagonal never forces date anchors to move.
    item.connector = `M ${item.x} ${item.markerY} L ${item.x} ${(item.markerY + boxEdge) / 2} L ${item.left + boxWidth / 2} ${boxEdge}`;
  }
  return {
    items, axisY, padding, tickY: axisY - 12 * unit,
    height: Math.max(240 * unit, axisY + band + 72 * unit + total + padding),
    boxWidth,
  };
}

/**
 * Calendar month bands, clipped to the viewport. Endpoints are month boundaries,
 * not inclusive entry endpoints. Shading stays anchored to the calendar while scrolling.
 * @returns {{date: string, start: number, end: number, label: string, shaded: boolean}[]}
 */
export function makeMonths(range) {
  const months = [];
  let date = `${fromDay(Math.floor(range.start)).slice(0, 7)}-01`;
  while (toDay(date) < range.end) {
    const start = toDay(date);
    const next = date.startsWith('9999-12') ? null : shiftMonths(date, 1);
    const end = next ? toDay(next) : MAX_DAY + 1;
    const monthIndex = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1;
    months.push({ date, start: Math.max(start, range.start), end: Math.min(end, range.end), label: formatMonth(date), shaded: monthIndex % 2 === 1 });
    if (!next) break;
    date = next;
  }
  return months;
}

/** Every Monday is a separator; day-number labels thin at a regular stride on narrow views. */
export function makeTicks(range, width, padding = 24, unit = 1) {
  const ticks = [];
  const pixelsPerWeek = dayPosition(range.start + 7, range, width, padding) - padding;
  const stride = Math.max(1, Math.ceil(28 * unit / Math.max(1, pixelsPerWeek)));
  const firstDay = Math.ceil(range.start);
  const firstMonday = firstDay + ((4 - firstDay) % 7 + 7) % 7;
  for (let day = firstMonday; day <= range.end; day += 7) {
    const labeled = ((day - 4) / 7) % stride === 0;
    ticks.push({ day, label: labeled ? String(Number(fromDay(day).slice(8))) : '' });
  }
  return ticks;
}
