import { MIN_DAY, MAX_DAY, toDay, fromDay, formatMonth, formatTickDate, formatRange } from './dates.js';

export const LABEL_WIDTH = 240;
export const LANE_HEIGHT = 106;
const ENTRY_TOP = 54;

export function dayPosition(day, rangeStart, scale) {
  return (day - rangeStart) * scale;
}

/** Keep a bounded canvas; scrolling rebases it without compressing calendar gaps. */
export function makeRange(center, scale, viewportWidth) {
  const half = Math.max(90, Math.ceil(viewportWidth / scale * 2));
  return {
    start: Math.max(MIN_DAY, Math.floor(center) - half),
    end: Math.min(MAX_DAY + 1, Math.floor(center) + half + 1),
  };
}

/**
 * Assign collision-free lanes. Label footprints count too, but date anchors never move.
 * @param {import('./storage.js').Entry[]} entries
 */
export function layoutEntries(entries, range, scale) {
  const candidates = entries.map(entry => {
    const start = toDay(entry.start);
    const end = entry.end === null ? start + 1 : toDay(entry.end) + 1;
    const x = dayPosition(start, range.start, scale);
    const durationWidth = entry.end === null ? 0 : (end - start) * scale;
    return { entry, start, end, x, width: Math.max(LABEL_WIDTH, durationWidth), durationWidth };
  }).filter(item => item.start < range.end && (item.entry.end === null ? item.start >= range.start : item.end > range.start))
    .sort((a, b) => a.start - b.start || a.entry.id.localeCompare(b.entry.id));

  const laneEnds = [];
  return candidates.map(item => {
    const left = Math.max(0, item.x);
    // Bars that began before this canvas still expose their title and dates.
    const width = Math.min(Math.max(LABEL_WIDTH, item.x + item.width - left), (range.end - range.start) * scale - left);
    let lane = laneEnds.findIndex(end => end + 12 <= left);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = left + width;
    return {
      ...item, left, width, lane,
      durationWidth: Math.max(0, Math.min(item.x + item.durationWidth - left, width)),
    };
  });
}

/** Calendar-aware tick generation: daily, Monday weekly, or month boundaries. */
export function makeTicks(range, scale) {
  const ticks = [];
  if (scale >= 32) {
    for (let day = range.start; day < range.end; day++) {
      const date = fromDay(day);
      ticks.push({ day, label: day % 2 === 0 ? date.slice(8) : '', monthLabel: date.endsWith('-01') ? formatMonth(date) : null });
    }
  } else if (scale >= 12) {
    // 1970-01-05 was a Monday (integer day 4).
    const first = range.start + ((4 - range.start) % 7 + 7) % 7;
    for (let day = first; day < range.end; day += 7) ticks.push({ day, label: formatTickDate(fromDay(day)) });
  } else {
    const date = fromDay(range.start);
    let year = Number(date.slice(0, 4));
    let month = Number(date.slice(5, 7));
    while (year <= 9999) {
      const monthDate = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-01`;
      const day = toDay(monthDate);
      if (day >= range.end) break;
      if (day >= range.start) ticks.push({ day, label: formatMonth(monthDate) });
      if (++month === 13) { month = 1; year++; }
    }
  }
  return ticks;
}

/** Draw semantic entry buttons; CSS supplies only the ruler geometry. */
export function renderTimeline({ canvas, ruler, entriesElement, todayLine, entries, range, scale, today, onEdit }) {
  const width = (range.end - range.start) * scale;
  const layout = layoutEntries(entries, range, scale);
  const laneCount = layout.reduce((count, item) => Math.max(count, item.lane + 1), 0);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${Math.max(318, ENTRY_TOP + laneCount * LANE_HEIGHT + 40)}px`;

  const ticks = document.createDocumentFragment();
  for (const tick of makeTicks(range, scale)) {
    const line = document.createElement('div');
    line.className = 'tick';
    line.style.left = `${dayPosition(tick.day, range.start, scale)}px`;
    const label = document.createElement('span');
    label.className = `tick-label${scale >= 32 ? ' day-label' : ''}`;
    label.textContent = tick.label;
    line.append(label);
    if (tick.monthLabel) {
      const month = document.createElement('span');
      month.className = 'tick-label';
      month.textContent = tick.monthLabel;
      line.append(month);
    }
    ticks.append(line);
  }
  ruler.replaceChildren(ticks);

  const buttons = document.createDocumentFragment();
  for (const item of layout) {
    const { entry } = item;
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `entry ${entry.kind}${entry.end === null ? ' point' : ''}${entry.completed ? ' complete' : ''}`;
    button.dataset.id = entry.id;
    button.style.left = `${item.left}px`;
    button.style.top = `${ENTRY_TOP + item.lane * LANE_HEIGHT}px`;
    button.style.width = `${item.width}px`;
    button.style.setProperty('--duration', `${item.durationWidth}px`);
    const dates = formatRange(entry.start, entry.end);
    button.setAttribute('aria-label', `${entry.title}, ${entry.kind}${entry.completed ? ', complete' : ''}, ${dates}. Edit entry.`);
    button.title = `${entry.title}\n${dates}`;
    const body = document.createElement('span');
    body.className = 'entry-body';
    for (const [className, text] of [
      ['entry-title', entry.title], ['entry-date', dates],
      ['entry-kind', entry.completed ? 'Task · complete' : entry.kind[0].toUpperCase() + entry.kind.slice(1)],
    ]) {
      const span = document.createElement('span');
      span.className = className;
      span.textContent = text;
      body.append(span);
    }
    button.append(body);
    button.addEventListener('click', () => onEdit(entry));
    buttons.append(button);
  }
  entriesElement.replaceChildren(buttons);
  todayLine.hidden = today < range.start || today >= range.end;
  todayLine.style.left = `${dayPosition(today, range.start, scale)}px`;
}
