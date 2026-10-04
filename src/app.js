import { toDay, fromDay, todayDate, formatRange } from './dates.js';
import { loadEntries, saveEntries, validateEntry } from './storage.js';
import { renderTimeline, visibleEntries } from './timeline.js';
import { outlookDays, viewportRange, makeScrollBuffer, scrollViewStart, shiftViewStart } from './viewport.js';

const get = id => document.getElementById(id);
const canvas = get('canvas');
const timeline = get('timeline');
const scrollTrack = get('scroll-track');
const editor = get('editor');
const form = get('entry-form');
const title = get('title');
const kind = get('kind');
const date = get('date');
const otherDate = get('other-date');
const completed = get('completed');
const message = get('message');
const formError = get('form-error');
const horizon = get('horizon');
const showCompleted = get('show-completed');
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const loaded = loadEntries(storage);
let entries = loaded.entries;
let today = todayDate();
let viewStart = toDay(today);
let span = outlookDays(viewStart, Number(horizon.value));
let range = viewportRange(viewStart, span);
let buffer;
let scrollFrame = null;
let drag = null;
let suppressClickUntil = 0;
let editingId = null;
let editingKind = 'event';

function showMessage(text) {
  message.textContent = text ?? '';
  message.hidden = !text;
}
showMessage(loaded.error);
get('add').disabled = loaded.blocked;
get('empty-add').disabled = loaded.blocked;

function render() {
  range = viewportRange(viewStart, span);
  viewStart = range.start;
  const visible = visibleEntries(entries, range, showCompleted.checked);
  renderTimeline({
    canvas, geometry: get('geometry'), boxes: get('boxes'),
    entries: visible, range, today: toDay(today), onEdit: openEditor,
  });
  get('visible-range').textContent = formatRange(fromDay(Math.floor(range.start)), fromDay(Math.floor(range.end)));
  get('entry-count').textContent = `${visible.length} visible · ${entries.length} total`;
  get('empty').hidden = visible.length !== 0;
  get('empty-text').textContent = entries.length === 0 ? 'Your timeline is empty.' : 'No entries in this view. Scroll to another date or show completed tasks.';
  get('empty-add').textContent = entries.length === 0 ? 'Add your first entry' : 'Add entry';
  const months = Number(horizon.value);
  for (const [id, direction] of [['previous', -1], ['next', 1]]) {
    const button = get(id);
    button.disabled = shiftViewStart(viewStart, direction * months, span) === viewStart;
    button.setAttribute('aria-label', `${direction < 0 ? 'Previous' : 'Next'} ${months} ${months === 1 ? 'month' : 'months'}`);
  }
}

function syncFields() {
  const task = kind.value === 'task';
  get('date-label').textContent = task ? 'Finish / submission date' : 'Date / start';
  get('other-date-label').textContent = task ? 'Planned start (optional)' : 'End date (optional)';
  get('completed-label').hidden = !task;
  if (!task) completed.checked = false;
  otherDate.min = task ? '0001-01-01' : date.value || '0001-01-01';
  otherDate.max = task ? date.value || '9999-12-31' : '9999-12-31';
}

function openEditor(entry = null) {
  editingId = entry?.id ?? null;
  form.reset();
  title.value = entry?.title ?? '';
  kind.value = entry?.kind ?? 'event';
  editingKind = kind.value;
  date.value = entry ? (entry.kind === 'task' ? entry.finish : entry.start) : todayDate();
  otherDate.value = entry ? (entry.kind === 'task' ? entry.start ?? '' : entry.end ?? '') : '';
  completed.checked = entry?.completed ?? false;
  get('editor-heading').textContent = entry ? 'Edit entry' : 'Add entry';
  get('delete').hidden = !entry;
  formError.hidden = true;
  syncFields();
  editor.showModal();
  title.focus();
}

function commit(nextEntries, entry = null) {
  readScrollPosition();
  range = viewportRange(viewStart, span);
  entries = nextEntries;
  const relevant = entry ? toDay(entry.kind === 'task' ? entry.finish : entry.start) : null;
  if (relevant !== null && (relevant < range.start || relevant > range.end)) {
    moveTo(relevant);
  }
  showMessage(saveEntries(storage, entries));
  editor.close();
  render();
  const button = entry ? [...get('boxes').children].find(button => button.dataset.id === entry.id) : null;
  (button ?? get('add')).focus({ preventScroll: true });
}

get('add').addEventListener('click', () => openEditor());
get('empty-add').addEventListener('click', () => openEditor());
get('cancel').addEventListener('click', () => editor.close());
kind.addEventListener('change', () => {
  if (kind.value !== editingKind) {
    const previous = date.value;
    date.value = otherDate.value || previous;
    otherDate.value = otherDate.value ? previous : '';
    editingKind = kind.value;
  }
  syncFields();
});
date.addEventListener('input', syncFields);
form.addEventListener('submit', event => {
  event.preventDefault();
  if (loaded.blocked) return;
  try {
    const common = { id: editingId ?? crypto.randomUUID(), title: title.value, kind: kind.value };
    const entry = validateEntry(kind.value === 'task'
      ? { ...common, finish: date.value, start: otherDate.value || null, completed: completed.checked }
      : { ...common, start: date.value, end: otherDate.value || null });
    const next = editingId ? entries.map(existing => existing.id === editingId ? entry : existing) : [...entries, entry];
    commit(next, entry);
  } catch (error) {
    formError.textContent = error.message;
    formError.hidden = false;
  }
});
get('delete').addEventListener('click', () => {
  if (!editingId || loaded.blocked) return;
  if (window.confirm('Delete this entry?')) commit(entries.filter(entry => entry.id !== editingId));
});

function viewportMetrics() {
  const width = timeline.clientWidth;
  const unit = parseFloat(getComputedStyle(canvas).fontSize) / 16;
  return { width, padding: Math.min(24 * unit, width / 10) };
}

// The sticky canvas renders the viewport; the wider track provides native scrolling.
function resetBuffer() {
  const { width, padding } = viewportMetrics();
  if (width <= 0) return;
  canvas.style.width = `${width}px`;
  buffer = makeScrollBuffer(viewStart, span, width, padding);
  buffer.viewportWidth = width;
  buffer.padding = padding;
  scrollTrack.style.width = `${buffer.width}px`;
  timeline.scrollLeft = buffer.scrollLeft;
  // Browsers may round scroll positions. Use the actual value as the origin reference.
  buffer.origin = viewStart - timeline.scrollLeft * span / (width - padding * 2);
}

function readScrollPosition() {
  if (!buffer) return;
  viewStart = scrollViewStart(buffer.origin, timeline.scrollLeft, span, buffer.viewportWidth, buffer.padding);
}

function moveTo(start, zoom = false) {
  if (scrollFrame !== null) {
    cancelAnimationFrame(scrollFrame);
    scrollFrame = null;
  }
  if (zoom) span = outlookDays(start, Number(horizon.value));
  viewStart = viewportRange(start, span).start;
  resetBuffer();
  render();
}

function flushScroll() {
  scrollFrame = null;
  readScrollPosition();
  const { width, padding } = viewportMetrics();
  if (width <= 0) return;
  const left = timeline.scrollLeft;
  const right = scrollTrack.offsetWidth - width - left;
  const next = makeScrollBuffer(viewStart, span, width, padding);
  if ((left < width / 2 && next.scrollLeft > left + 1)
    || (right < width / 2 && next.width - width - next.scrollLeft > right + 1)) resetBuffer();
  render();
}

timeline.addEventListener('scroll', () => {
  if (scrollFrame === null) scrollFrame = requestAnimationFrame(flushScroll);
});
get('today').addEventListener('click', () => {
  today = todayDate();
  moveTo(toDay(today), true);
});
for (const [id, amount] of [['previous', -1], ['next', 1]]) {
  get(id).addEventListener('click', () => {
    readScrollPosition();
    moveTo(shiftViewStart(viewStart, amount * Number(horizon.value), span));
  });
}
horizon.addEventListener('change', () => {
  readScrollPosition();
  moveTo(viewStart, true);
});
showCompleted.addEventListener('change', () => {
  readScrollPosition();
  render();
});
timeline.addEventListener('keydown', event => {
  if (event.target !== timeline || !['ArrowLeft', 'ArrowRight'].includes(event.key)
    || event.altKey || event.ctrlKey || event.metaKey) return;
  event.preventDefault();
  timeline.scrollLeft += (event.key === 'ArrowLeft' ? -1 : 1) * 60;
});

// Touch uses native scrolling; pointer capture begins only after a mouse drag.
timeline.addEventListener('pointerdown', event => {
  if (event.pointerType !== 'mouse' || event.button !== 0) return;
  // Leave the native scrollbar interactive.
  if (event.clientY >= timeline.getBoundingClientRect().top + timeline.clientHeight) return;
  drag = { id: event.pointerId, x: event.clientX, moved: false };
});
timeline.addEventListener('pointermove', event => {
  if (!drag || drag.id !== event.pointerId) return;
  const delta = drag.x - event.clientX;
  if (!drag.moved && Math.abs(delta) < 6) return;
  if (!drag.moved) {
    drag.moved = true;
    timeline.setPointerCapture(event.pointerId);
    timeline.classList.add('dragging');
  }
  event.preventDefault();
  timeline.scrollLeft += delta;
  drag.x = event.clientX;
});
function finishDrag(event) {
  if (!drag || drag.id !== event.pointerId) return;
  if (drag.moved) suppressClickUntil = performance.now() + 300;
  drag = null;
  timeline.classList.remove('dragging');
  if (timeline.hasPointerCapture(event.pointerId)) timeline.releasePointerCapture(event.pointerId);
}
timeline.addEventListener('pointerup', finishDrag);
timeline.addEventListener('pointercancel', finishDrag);
timeline.addEventListener('lostpointercapture', finishDrag);
timeline.addEventListener('pointerleave', event => {
  if (drag && !drag.moved) finishDrag(event);
});
timeline.addEventListener('click', event => {
  if (performance.now() < suppressClickUntil && event.detail !== 0) {
    event.preventDefault();
    event.stopImmediatePropagation();
  }
}, true);

let previousWidth = timeline.clientWidth;
let previousFont = getComputedStyle(canvas).fontSize;
new ResizeObserver(() => {
  const width = timeline.clientWidth;
  const font = getComputedStyle(canvas).fontSize;
  if (width === previousWidth && font === previousFont) return;
  previousWidth = width;
  previousFont = font;
  moveTo(viewStart);
}).observe(timeline);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const nextToday = todayDate();
  if (today === nextToday) return;
  readScrollPosition();
  const followsToday = Math.abs(viewStart - toDay(today)) < 1e-7;
  today = nextToday;
  if (followsToday) moveTo(toDay(today), true);
  else render();
});

moveTo(viewStart);
