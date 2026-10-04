import { toDay, fromDay, todayDate, formatRange, MIN_DAY, MAX_DAY } from './dates.js';
import { loadEntries, saveEntries, validateEntry } from './storage.js';
import { makeRange, renderTimeline } from './timeline.js';

const get = id => document.getElementById(id);
const timeline = get('timeline');
const editor = get('editor');
const form = get('entry-form');
const title = get('title');
const kind = get('kind');
const start = get('start');
const end = get('end');
const completed = get('completed');
const message = get('message');
const formError = get('form-error');
const zoom = get('zoom');
let storage;
// Even accessing localStorage can throw when browser policy blocks it.
try { storage = window.localStorage; } catch { storage = null; }
const loaded = loadEntries(storage);
let entries = loaded.entries;
let scale = Number(zoom.value);
let today = toDay(todayDate());
let range = makeRange(today, scale, timeline.clientWidth);
let editingId = null;
let scrollFrame = null;

function showMessage(text) {
  message.textContent = text ?? '';
  message.hidden = !text;
}
showMessage(loaded.error);
get('add').disabled = loaded.blocked;
get('empty-add').disabled = loaded.blocked;

function centerDay() {
  return range.start + (timeline.scrollLeft + timeline.clientWidth / 2) / scale;
}

function updateVisibleRange() {
  const first = Math.max(MIN_DAY, Math.min(MAX_DAY, Math.floor(range.start + timeline.scrollLeft / scale)));
  const last = Math.min(MAX_DAY, Math.ceil(range.start + (timeline.scrollLeft + timeline.clientWidth) / scale) - 1);
  get('visible-range').textContent = formatRange(fromDay(first), fromDay(last));
}

function render(center = centerDay()) {
  range = makeRange(center, scale, timeline.clientWidth);
  renderTimeline({
    canvas: get('canvas'), ruler: get('ruler'), entriesElement: get('entries'),
    todayLine: get('today-line'), entries, range, scale, today, onEdit: openEditor,
  });
  timeline.scrollLeft = (center - range.start) * scale - timeline.clientWidth / 2;
  get('entry-count').textContent = `${entries.length} ${entries.length === 1 ? 'entry' : 'entries'}`;
  get('empty').hidden = entries.length !== 0;
  updateVisibleRange();
}

function syncFields() {
  get('completed-label').hidden = kind.value !== 'task';
  if (kind.value !== 'task') completed.checked = false;
  end.min = start.value || '0001-01-01';
}

function openEditor(entry = null) {
  editingId = entry?.id ?? null;
  form.reset();
  title.value = entry?.title ?? '';
  kind.value = entry?.kind ?? 'event';
  start.value = entry?.start ?? todayDate();
  end.value = entry?.end ?? '';
  completed.checked = entry?.completed ?? false;
  get('editor-heading').textContent = entry ? 'Edit entry' : 'Add entry';
  get('delete').hidden = !entry;
  formError.hidden = true;
  syncFields();
  editor.showModal();
  title.focus();
}

function commit(nextEntries, center) {
  entries = nextEntries;
  showMessage(saveEntries(storage, entries));
  editor.close();
  render(center);
  // Replacing the entry DOM must not strand focus on the page body.
  timeline.focus({ preventScroll: true });
}

get('add').addEventListener('click', () => openEditor());
get('empty-add').addEventListener('click', () => openEditor());
get('cancel').addEventListener('click', () => editor.close());
kind.addEventListener('change', syncFields);
start.addEventListener('input', syncFields);
form.addEventListener('submit', event => {
  event.preventDefault();
  if (loaded.blocked) return;
  try {
    const entry = validateEntry({
      id: editingId ?? crypto.randomUUID(), title: title.value,
      kind: kind.value, start: start.value, end: end.value || null,
      completed: kind.value === 'task' && completed.checked,
    });
    const next = editingId ? entries.map(existing => existing.id === editingId ? entry : existing) : [...entries, entry];
    commit(next, toDay(entry.start));
  } catch (error) {
    formError.textContent = error.message;
    formError.hidden = false;
  }
});
get('delete').addEventListener('click', () => {
  if (!editingId || loaded.blocked) return;
  if (window.confirm('Delete this entry?')) commit(entries.filter(entry => entry.id !== editingId), centerDay());
});
get('today').addEventListener('click', () => {
  today = toDay(todayDate());
  render(today);
});
zoom.addEventListener('change', () => {
  const center = centerDay();
  scale = Number(zoom.value);
  render(center);
});
timeline.addEventListener('scroll', () => {
  if (scrollFrame !== null) return;
  scrollFrame = requestAnimationFrame(() => {
    scrollFrame = null;
    const threshold = timeline.clientWidth / 2;
    const leftEdge = timeline.scrollLeft < threshold && range.start > MIN_DAY;
    const rightEdge = timeline.scrollLeft + timeline.clientWidth > timeline.scrollWidth - threshold && range.end <= MAX_DAY;
    if (leftEdge || rightEdge) render(centerDay());
    else updateVisibleRange();
  });
});

// A conventional vertical mouse wheel pans horizontally unless it targets a scrollable lane overflow.
timeline.addEventListener('wheel', event => {
  if (event.ctrlKey || event.shiftKey || Math.abs(event.deltaX) >= Math.abs(event.deltaY) || timeline.scrollHeight > timeline.clientHeight) return;
  event.preventDefault();
  const multiplier = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? timeline.clientWidth : 1;
  timeline.scrollLeft += event.deltaY * multiplier;
}, { passive: false });

let previousWidth = timeline.clientWidth;
new ResizeObserver(() => {
  const width = timeline.clientWidth;
  if (width === previousWidth) return;
  const center = range.start + (timeline.scrollLeft + previousWidth / 2) / scale;
  previousWidth = width;
  render(center);
}).observe(timeline);

render(today);
