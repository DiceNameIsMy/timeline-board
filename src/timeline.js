import { toDay, fromDay, shiftMonths, formatMonth, formatTickDate, formatRange } from './dates.js';

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

/** Sparse labels selected by available pixel spacing, independently of screen size. */
export function makeTicks(range, width, padding = 24, unit = 1) {
  const ticks = [];
  let monthDate = `${fromDay(Math.floor(range.start)).slice(0, 7)}-01`;
  while (toDay(monthDate) <= range.end) {
    const day = toDay(monthDate);
    if (day >= range.start) ticks.push({ day, label: formatMonth(monthDate), major: true });
    const next = shiftMonths(monthDate, 1);
    if (next === monthDate) break;
    monthDate = next;
  }
  const pixelsPerWeek = dayPosition(range.start + 7, range, width, padding) - padding;
  if (pixelsPerWeek >= 56 * unit) {
    const firstDay = Math.ceil(range.start);
    const firstMonday = firstDay + ((4 - firstDay) % 7 + 7) % 7;
    for (let day = firstMonday; day <= range.end; day += 7) {
      if (ticks.every(tick => Math.abs(dayPosition(tick.day, range, width, padding) - dayPosition(day, range, width, padding)) >= 68 * unit)) {
        ticks.push({ day, label: formatTickDate(fromDay(day)), major: false });
      }
    }
  }
  ticks.sort((a, b) => a.day - b.day);
  let previousLabel = -Infinity;
  for (const tick of ticks) {
    const x = dayPosition(tick.day, range, width, padding);
    if (x - previousLabel < 76 * unit) tick.label = '';
    else previousLabel = x;
  }
  return ticks;
}

const SVG_NS = 'http://www.w3.org/2000/svg';
function svgElement(tag, attributes, text) {
  const element = document.createElementNS(SVG_NS, tag);
  for (const [key, value] of Object.entries(attributes)) element.setAttribute(key, String(value));
  if (text !== undefined) element.textContent = text;
  return element;
}

export function renderTimeline({ canvas, geometry, boxes, entries, range, today, onEdit }) {
  const width = canvas.clientWidth;
  if (width <= 0) return;
  const unit = parseFloat(getComputedStyle(canvas).fontSize) / 16;
  const focusedId = boxes.contains(document.activeElement) ? document.activeElement.dataset.id : null;
  const initial = layoutEntries(entries, range, width, new Map(), unit);
  const buttons = new Map();
  const existing = new Map([...boxes.children].map(button => [button.dataset.id, button]));
  for (const item of initial.items) {
    const { entry, dates } = item;
    const button = existing.get(entry.id) ?? document.createElement('button');
    button.type = 'button';
    button.className = `entry-box ${entry.kind}${entry.completed ? ' complete' : ''}`;
    button.dataset.id = entry.id;
    button.style.width = `${initial.boxWidth}px`;
    const dateLabel = formatRange(dates.start, dates.end);
    button.setAttribute('aria-label', `${entry.title}, ${entry.kind}${entry.completed ? ', complete' : ''}, ${dateLabel}. Edit entry.`);
    for (const [className, text] of [
      ['entry-title', entry.title], ['entry-date', dateLabel],
      ['entry-type', entry.kind === 'task' ? `Task${entry.completed ? ' · complete' : ' · finish ' + formatTickDate(entry.finish)}` : 'Event'],
    ]) {
      let span = button.querySelector(`.${className}`);
      if (!span) {
        span = document.createElement('span');
        span.className = className;
        button.append(span);
      }
      if (span.textContent !== text) span.textContent = text;
    }
    button.onclick = () => onEdit(entry);
    buttons.set(entry.id, button);
    if (!existing.has(entry.id)) boxes.append(button);
  }
  for (const [id, button] of existing) if (!buttons.has(id)) button.remove();
  const sizes = new Map([...buttons].map(([id, button]) => [id, button.offsetHeight]));
  const layout = layoutEntries(entries, range, width, sizes, unit);
  canvas.style.height = `${layout.height}px`;
  geometry.setAttribute('viewBox', `0 0 ${width} ${layout.height}`);
  geometry.replaceChildren();
  geometry.append(svgElement('line', { x1: 0, x2: width, y1: layout.axisY, y2: layout.axisY, class: 'axis' }));
  for (const item of layout.items) {
    const button = buttons.get(item.entry.id);
    button.style.left = `${item.left}px`;
    button.style.top = `${item.y}px`;
    const group = svgElement('g', { class: `entry-geometry ${item.entry.kind}${item.entry.completed ? ' complete' : ''}` });
    if (item.start !== item.end) {
      for (const x of [item.x1, item.x2]) {
        group.append(svgElement('line', {
          x1: x, x2: x, y1: layout.axisY, y2: item.markerY, class: 'endpoint-guide',
        }));
      }
    }
    group.append(svgElement('path', { d: item.connector, class: 'connector' }));
    if (item.start !== item.end) {
      group.append(svgElement('line', { x1: item.x1, x2: item.x2, y1: item.markerY, y2: item.markerY, class: 'interval' }));
      for (const [x, clipped, direction, finish] of [
        [item.x1, item.before, -1, false], [item.x2, item.after, 1, item.entry.kind === 'task'],
      ]) {
        group.append(clipped
          ? svgElement('path', { d: `M ${x - direction * 5 * unit} ${item.markerY - 4 * unit} L ${x} ${item.markerY} L ${x - direction * 5 * unit} ${item.markerY + 4 * unit}`, class: 'continuation' })
          : svgElement('circle', { cx: x, cy: item.markerY, r: (finish ? 5 : 3) * unit, class: 'marker' }));
      }
    } else group.append(svgElement('circle', { cx: item.x, cy: item.markerY, r: 5 * unit, class: 'marker' }));
    geometry.append(group);
    const highlight = () => group.classList.toggle('highlight', button.matches(':hover, :focus'));
    for (const event of ['mouseenter', 'mouseleave', 'focus', 'blur']) button[`on${event}`] = highlight;
    highlight();
  }
  // Draw date labels over connectors so crossing branches cannot obscure their text.
  let previousLabelRight = -Infinity;
  for (const tick of makeTicks(range, width, layout.padding, unit)) {
    const x = dayPosition(tick.day, range, width, layout.padding);
    geometry.append(svgElement('line', { x1: x, x2: x, y1: layout.axisY - 4 * unit, y2: layout.axisY + 4 * unit, class: 'tick' }));
    if (tick.label) {
      const label = svgElement('text', {
        x, y: layout.tickY, class: 'tick-label',
        'text-anchor': x > width - layout.padding - 68 * unit ? 'end' : 'start',
      }, tick.label);
      geometry.append(label);
      const bounds = label.getBBox();
      if (bounds.x < previousLabelRight + 12 * unit) label.remove();
      else previousLabelRight = bounds.x + bounds.width;
    }
  }
  if (today >= range.start && today <= range.end) {
    const x = dayPosition(today, range, width, layout.padding);
    const marker = svgElement('g', { class: 'today-marker' });
    marker.append(svgElement('line', { x1: x, x2: x, y1: layout.axisY - 40 * unit, y2: layout.axisY + 14 * unit }));
    marker.append(svgElement('text', { x, y: layout.axisY - 48 * unit, 'text-anchor': x > width / 2 ? 'end' : 'start' }, 'Today'));
    geometry.append(marker);
  }
  if (focusedId && !buttons.has(focusedId)) canvas.closest('[role="region"]').focus({ preventScroll: true });
}
