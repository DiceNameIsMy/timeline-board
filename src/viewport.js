import { MIN_DAY, MAX_DAY, fromDay, toDay, shiftMonths } from './dates.js';

/** Calendar-month span used for zoom; near the calendar end, measure backwards. */
export function outlookDays(start, months) {
  if (![1, 3, 6].includes(months)) throw new Error('Choose a 1, 3, or 6 month outlook.');
  const day = Math.floor(Math.max(MIN_DAY, Math.min(MAX_DAY, start)));
  const date = fromDay(day);
  const end = toDay(shiftMonths(date, months));
  return end === MAX_DAY || end === day
    ? day - toDay(shiftMonths(date, -months))
    : end - day;
}

/** Fractional day positions allow smooth scrolling without changing stored dates. */
export function clampViewStart(start, span) {
  return Math.max(MIN_DAY, Math.min(MAX_DAY - span, start));
}

/** Reserve one fifth of the Today view for recent history and its marker label. */
export function todayViewStart(today, span) {
  return clampViewStart(today - Math.ceil(span / 5), span);
}

export function viewportRange(start, span) {
  const clamped = clampViewStart(start, span);
  return { start: clamped, end: clamped + span };
}

/**
 * A bounded native scroll runway, with up to two viewport widths on each side.
 * @returns {{origin: number, scrollLeft: number, width: number}}
 */
export function makeScrollBuffer(start, span, width, padding = 24) {
  const scale = (width - padding * 2) / span;
  const clamped = clampViewStart(start, span);
  const before = Math.min(width * 2, (clamped - MIN_DAY) * scale);
  const after = Math.min(width * 2, (MAX_DAY - span - clamped) * scale);
  return { origin: clamped - before / scale, scrollLeft: before, width: width + before + after };
}

export function scrollViewStart(origin, scrollLeft, span, width, padding = 24) {
  return clampViewStart(origin + scrollLeft * span / (width - padding * 2), span);
}

/** Move by calendar months while retaining the fractional day from scrolling. */
export function shiftViewStart(start, months, span) {
  const day = Math.floor(start);
  const date = fromDay(day);
  const shifted = toDay(shiftMonths(date, months)) + start - day;
  const monthIndex = Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1 + months;
  // A step beyond the calendar reaches its endpoint, rather than retaining the day.
  if (monthIndex < 12) return MIN_DAY;
  if (monthIndex > 9999 * 12 + 11) return MAX_DAY - span;
  return clampViewStart(shifted, span);
}
