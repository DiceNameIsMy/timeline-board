import { toDay, formatTickDate, formatRange } from './dates.js';
import { dayPosition, layoutEntries, makeMonths, makeTicks } from './timeline.js';

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
  for (const month of makeMonths(range)) {
    const left = dayPosition(month.start, range, width, layout.padding);
    const right = dayPosition(month.end, range, width, layout.padding);
    geometry.append(svgElement('rect', { x: left, y: 0, width: right - left, height: layout.height, class: `month-band${month.shaded ? ' shaded' : ''}` }));
    geometry.append(svgElement('line', { x1: left, x2: left, y1: 0, y2: layout.height, class: 'month-boundary' }));
    const label = svgElement('text', { x: left + 6 * unit, y: 24 * unit, class: 'month-label' }, month.label);
    geometry.append(label);
    // A nearly clipped month must not spill its label into the following month.
    if (label.getBBox().width + 12 * unit > right - left) label.remove();
  }
  for (const tick of makeTicks(range, width, layout.padding, unit)) {
    const x = dayPosition(tick.day, range, width, layout.padding);
    geometry.append(svgElement('line', { x1: x, x2: x, y1: 34 * unit, y2: layout.height, class: 'week-separator', 'data-day': tick.day }));
  }
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
  for (const tick of makeTicks(range, width, layout.padding, unit)) {
    const x = dayPosition(tick.day, range, width, layout.padding);
    geometry.append(svgElement('line', { x1: x, x2: x, y1: layout.axisY - 4 * unit, y2: layout.axisY + 4 * unit, class: 'tick' }));
    if (tick.label) {
      const label = svgElement('text', {
        x, y: layout.tickY, class: 'tick-label',
        'text-anchor': 'middle',
      }, tick.label);
      geometry.append(label);
    }
  }
  if (today >= range.start && today <= range.end) {
    const x = dayPosition(today, range, width, layout.padding);
    const marker = svgElement('g', { class: 'today-marker' });
    marker.append(svgElement('line', { x1: x, x2: x, y1: layout.axisY + 4 * unit, y2: layout.height }));
    marker.append(svgElement('text', { x, y: layout.axisY + 24 * unit, 'text-anchor': x > width / 2 ? 'end' : 'start' }, 'Today'));
    geometry.append(marker);
  }
  if (focusedId && !buttons.has(focusedId)) canvas.closest('[role="region"]').focus({ preventScroll: true });
}
