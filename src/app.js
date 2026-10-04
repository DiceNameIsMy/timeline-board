import { toDay, fromDay, todayDate, formatRange, shiftMonths } from './dates.js';
import { loadEntries, saveEntries, validateEntry } from './storage.js';
import { makeRange, renderTimeline, visibleEntries } from './timeline.js';

const get = id => document.getElementById(id);
const canvas = get('canvas');
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
let navigationBase = today;
let monthOffset = 0;
let range = makeRange(today, Number(horizon.value));
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
  const viewStart = shiftMonths(navigationBase, monthOffset);
  range = makeRange(viewStart, Number(horizon.value));
  const visible = visibleEntries(entries, range, showCompleted.checked);
  renderTimeline({
    canvas, geometry: get('geometry'), boxes: get('boxes'),
    entries: visible, range, today: toDay(today), onEdit: openEditor,
  });
  get('visible-range').textContent = formatRange(fromDay(range.start), fromDay(range.end));
  get('entry-count').textContent = `${visible.length} visible · ${entries.length} total`;
  get('empty').hidden = visible.length !== 0;
  get('empty-text').textContent = entries.length === 0 ? 'Your timeline is empty.' : 'No entries in this outlook. Change the period or show completed tasks.';
  get('empty-add').textContent = entries.length === 0 ? 'Add your first entry' : 'Add entry';
  get('previous').disabled = shiftMonths(navigationBase, monthOffset - 1) === viewStart;
  get('next').disabled = shiftMonths(navigationBase, monthOffset + 1) === viewStart;
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
  entries = nextEntries;
  const relevant = entry ? toDay(entry.kind === 'task' ? entry.finish : entry.start) : null;
  if (relevant !== null && (relevant < range.start || relevant > range.end)) {
    navigationBase = fromDay(relevant);
    monthOffset = 0;
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
get('today').addEventListener('click', () => {
  today = todayDate();
  navigationBase = today;
  monthOffset = 0;
  render();
});
get('previous').addEventListener('click', () => { monthOffset--; render(); });
get('next').addEventListener('click', () => { monthOffset++; render(); });
horizon.addEventListener('change', render);
showCompleted.addEventListener('change', render);

let previousWidth = canvas.clientWidth;
let previousFont = getComputedStyle(canvas).fontSize;
new ResizeObserver(() => {
  const width = canvas.clientWidth;
  const font = getComputedStyle(canvas).fontSize;
  if (width === previousWidth && font === previousFont) return;
  previousWidth = width;
  previousFont = font;
  render();
}).observe(canvas);
document.addEventListener('visibilitychange', () => {
  if (document.hidden) return;
  const nextToday = todayDate();
  if (today === nextToday) return;
  if (navigationBase === today && monthOffset === 0) navigationBase = nextToday;
  today = nextToday;
  render();
});

render();
