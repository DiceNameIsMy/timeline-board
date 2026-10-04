const DAY_MS = 86_400_000;
const datePattern = /^\d{4}-\d{2}-\d{2}$/;

/** Convert a calendar date to an integer day, without local timezone arithmetic. */
export function toDay(date) {
  if (typeof date !== 'string' || !datePattern.test(date) || date.startsWith('0000')) {
    throw new Error('Choose a valid calendar date.');
  }
  const milliseconds = Date.parse(`${date}T00:00:00.000Z`);
  if (!Number.isFinite(milliseconds) || new Date(milliseconds).toISOString().slice(0, 10) !== date) {
    throw new Error('Choose a valid calendar date.');
  }
  return milliseconds / DAY_MS;
}

export const MIN_DAY = toDay('0001-01-01');
export const MAX_DAY = toDay('9999-12-31');

export function fromDay(day) {
  if (!Number.isInteger(day) || day < MIN_DAY || day > MAX_DAY) {
    throw new Error('Date is outside the supported calendar.');
  }
  return new Date(day * DAY_MS).toISOString().slice(0, 10);
}

/** Today's date in the user's local timezone. */
export function todayDate(now = new Date()) {
  return `${String(now.getFullYear()).padStart(4, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
}

const dateFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});
const monthFormatter = new Intl.DateTimeFormat(undefined, {
  month: 'short', year: 'numeric', timeZone: 'UTC',
});
const tickFormatter = new Intl.DateTimeFormat(undefined, {
  day: 'numeric', month: 'short', timeZone: 'UTC',
});
export function formatDate(date) {
  return dateFormatter.format(new Date(toDay(date) * DAY_MS));
}

export function formatMonth(date) {
  return monthFormatter.format(new Date(toDay(date) * DAY_MS));
}

export function formatTickDate(date) {
  return tickFormatter.format(new Date(toDay(date) * DAY_MS));
}

export function formatRange(start, end) {
  return end && end !== start ? `${formatDate(start)} – ${formatDate(end)}` : formatDate(start);
}

/** Shift by calendar months, clamping month-end dates and supported calendar bounds. */
export function shiftMonths(date, amount) {
  toDay(date);
  if (!Number.isInteger(amount)) throw new Error('Month offset must be an integer.');
  const index = Math.max(12, Math.min(9999 * 12 + 11, Number(date.slice(0, 4)) * 12 + Number(date.slice(5, 7)) - 1 + amount));
  const year = String(Math.floor(index / 12)).padStart(4, '0');
  const month = String(index % 12 + 1).padStart(2, '0');
  const last = new Date(`${year}-${month}-01T00:00:00Z`);
  last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const day = String(Math.min(Number(date.slice(8)), last.getUTCDate())).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
