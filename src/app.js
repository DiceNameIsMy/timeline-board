import { toDay, fromDay, todayDate, formatRange } from './dates.js';
import { loadEntries, saveEntries } from './storage.js';
import { validateEntry } from './entries.js';
import { descriptionLinks } from './notes.js';
import { setupFiles } from './files.js';
import { visibleEntries } from './timeline.js';
import { renderTimeline } from './render.js';
import { paddedOutlookDays, viewportRange, makeScrollBuffer, scrollViewStart, shiftViewStart, todayViewStart } from './viewport.js';
import { keyboardCommand } from './keyboard.js';

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
const description = get('description');
const category = get('category');
const color = get('color');
const message = get('message');
const formError = get('form-error');
const horizon = get('horizon');
const showCompleted = get('show-completed');
let storage;
try { storage = window.localStorage; } catch { storage = null; }
const loaded = loadEntries(storage);
let editingBlocked = loaded.blocked;
const preserveSavedRecord = loaded.blocked;
let entries = loaded.entries;
let today = todayDate();
let span = paddedOutlookDays(toDay(today), Number(horizon.value));
let viewStart = todayViewStart(toDay(today), span);
let range = viewportRange(viewStart, span);
let buffer;
let scrollFrame = null;
let drag = null;
let suppressClickUntil = 0;
let editingId = null;
let editingKind = 'event';
const files = setupFiles({
  getEntries: () => entries,
  replaceEntries: imported => {
    entries = imported;
    editingBlocked = false;
    setEditingBlocked();
    files.changed();
    persistEntries();
    const first = [...entries].sort((a, b) => (a.kind === 'task' ? a.finish : a.start).localeCompare(b.kind === 'task' ? b.finish : b.start))[0];
    if (first) moveTo(toDay(first.kind === 'task' ? first.finish : first.start), true);
    else moveToToday();
    focusEntry(first?.id);
  },
  onError: text => {
    get('file-error').textContent = text ?? '';
    get('file-error').hidden = !text;
  },
});

function setEditingBlocked() {
  get('add').disabled = editingBlocked;
  get('empty-add').disabled = editingBlocked;
  files.setBlocked(editingBlocked);
}

function persistEntries() {
  const error = preserveSavedRecord
    ? 'The unreadable browser record has been preserved. Changes are in this tab only; save or export a JSON file before reloading.'
    : saveEntries(storage, entries);
  showMessage(error);
  get('retry-save').hidden = !error || preserveSavedRecord;
}
get('retry-save').addEventListener('click', persistEntries);

/** Cards in calendar order, independent of their collision rows or insertion order. */
function entryCards() {
  return [...get('boxes').children].sort((a, b) => Number(a.dataset.day) - Number(b.dataset.day) || a.dataset.id.localeCompare(b.dataset.id));
}

function focusEntry(id, fallbackIndex = 0) {
  const cards = entryCards();
  const card = cards.find(card => card.dataset.id === id) ?? cards[Math.min(fallbackIndex, cards.length - 1)];
  (card?.querySelector('.entry-edit') ?? timeline).focus({ preventScroll: true });
  card?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

function selectEntry(direction) {
  const cards = entryCards();
  const current = document.activeElement.closest('.entry-box');
  const index = cards.indexOf(current);
  const next = index < 0 ? (direction > 0 ? 0 : cards.length - 1) : Math.max(0, Math.min(cards.length - 1, index + direction));
  focusEntry(cards[next]?.dataset.id);
}

function showMessage(text) {
  message.textContent = text ?? '';
  message.hidden = !text;
}
showMessage(loaded.error);
setEditingBlocked();

function render() {
  range = viewportRange(viewStart, span);
  viewStart = range.start;
  const visible = visibleEntries(entries, range, showCompleted.checked);
  renderTimeline({
    canvas, geometry: get('geometry'), boxes: get('boxes'),
    entries: visible, range, today: toDay(today), onEdit: openEditor, onComplete: toggleCompletion,
  });
  const startYear = fromDay(Math.floor(range.start)).slice(0, 4);
  const endYear = fromDay(Math.floor(range.end)).slice(0, 4);
  get('visible-year').textContent = startYear === endYear ? startYear : `${startYear} – ${endYear}`;
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
  if (editingBlocked || editor.open) return;
  editingId = entry?.id ?? null;
  form.reset();
  title.value = entry?.title ?? '';
  kind.value = entry?.kind ?? 'event';
  editingKind = kind.value;
  date.value = entry ? (entry.kind === 'task' ? entry.finish : entry.start) : todayDate();
  otherDate.value = entry ? (entry.kind === 'task' ? entry.start ?? '' : entry.end ?? '') : '';
  completed.checked = entry?.completed ?? false;
  description.value = entry?.description ?? '';
  category.value = entry?.category ?? '';
  color.value = entry?.color ?? '';
  updateDescriptionLinks();
  get('editor-heading').textContent = entry ? 'Edit entry' : 'Add entry';
  get('delete').hidden = !entry;
  formError.hidden = true;
  syncFields();
  editor.showModal();
  title.focus();
}

function updateDescriptionLinks() {
  const links = get('description-links');
  links.replaceChildren();
  for (const url of descriptionLinks(description.value)) {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.textContent = url;
    anchor.target = '_blank';
    anchor.rel = 'noopener noreferrer';
    links.append(anchor);
  }
}
description.addEventListener('input', updateDescriptionLinks);

function commit(nextEntries, entry = null) {
  readScrollPosition();
  range = viewportRange(viewStart, span);
  entries = nextEntries;
  files.changed();
  const relevant = entry ? toDay(entry.kind === 'task' ? entry.finish : entry.start) : null;
  if (relevant !== null && (relevant < range.start || relevant > range.end)) {
    moveTo(relevant);
  }
  persistEntries();
  editor.close();
  render();
  if (entry) focusEntry(entry.id);
  else get('add').focus({ preventScroll: true });
}

function toggleCompletion(entry) {
  if (editingBlocked || entry.kind !== 'task') return;
  const index = entryCards().findIndex(card => card.dataset.id === entry.id);
  entries = entries.map(existing => existing.id === entry.id ? { ...existing, completed: !existing.completed } : existing);
  files.changed();
  persistEntries();
  readScrollPosition();
  render();
  focusEntry(entry.id, Math.max(0, index));
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
  if (editingBlocked) return;
  try {
    const common = { id: editingId ?? crypto.randomUUID(), title: title.value, kind: kind.value, description: description.value, category: category.value, color: color.value };
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
  if (!editingId || editingBlocked) return;
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
  if (zoom) span = paddedOutlookDays(start, Number(horizon.value));
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
  moveToToday();
});
function moveToToday() {
  span = paddedOutlookDays(toDay(today), Number(horizon.value));
  moveTo(todayViewStart(toDay(today), span));
}
for (const [id, amount] of [['previous', -1], ['next', 1]]) {
  get(id).addEventListener('click', () => {
    readScrollPosition();
    moveTo(shiftViewStart(viewStart, amount * Number(horizon.value), span));
  });
}
horizon.addEventListener('change', () => {
  readScrollPosition();
  if (Math.abs(viewStart - todayViewStart(toDay(today), span)) < 1e-7) moveToToday();
  else moveTo(viewStart, true);
});
showCompleted.addEventListener('change', () => {
  readScrollPosition();
  render();
});
const shortcuts = get('shortcuts-dialog');
get('shortcuts').addEventListener('click', () => shortcuts.showModal());
get('hint-keys').addEventListener('click', () => shortcuts.showModal());
get('close-shortcuts').addEventListener('click', () => shortcuts.close());
document.addEventListener('keydown', event => {
  const active = document.activeElement;
  const card = active.closest('.entry-box');
  // Keep Enter/Space activation native on buttons and checkboxes.
  const command = keyboardCommand(event, {
    editorOpen: editor.open,
    dialogOpen: Boolean(document.querySelector('dialog[open]')),
    typing: active.matches('input, textarea, select') || active.isContentEditable,
    inTimeline: active === timeline || Boolean(card && active.matches('.entry-edit')),
    hasEntry: Boolean(card && active.matches('.entry-edit')),
  });
  if (!command || (command === 'edit' && active !== timeline)) return;
  event.preventDefault();
  if (command === 'save') form.requestSubmit();
  else if (command === 'add') openEditor();
  else if (command === 'today') get('today').click();
  else if (command === 'help') shortcuts.showModal();
  else if (command === 'previous' || command === 'next') get(command).click();
  else if (command.startsWith('zoom-')) {
    horizon.value = command.slice(5);
    horizon.dispatchEvent(new Event('change'));
  } else if (command.startsWith('scroll-')) timeline.scrollLeft += (command === 'scroll-left' ? -1 : 1) * 60;
  else if (command.startsWith('select-')) selectEntry(command === 'select-next' ? 1 : -1);
  else if (command === 'edit') {
    const first = entryCards()[0];
    if (first) openEditor(entries.find(entry => entry.id === first.dataset.id));
  } else if (command === 'complete') toggleCompletion(entries.find(entry => entry.id === card.dataset.id));
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
  const followsToday = Math.abs(viewStart - todayViewStart(toDay(today), span)) < 1e-7;
  today = nextToday;
  if (followsToday) moveToToday();
  else render();
});

moveTo(viewStart);
