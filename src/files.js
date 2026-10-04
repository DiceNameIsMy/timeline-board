import { parseEntriesFile, serializeEntriesFile } from './storage.js';

const FILE_TYPES = [{ description: 'Timeline JSON', accept: { 'application/json': ['.json'] } }];

/**
 * Explicit local file operations. Browser storage remains an automatic working copy.
 * File handles last only for this tab; downloads/uploads work without native pickers.
 * @param {{getEntries: () => import('./entries.js').Entry[], replaceEntries: (entries: import('./entries.js').Entry[]) => void, onError: (text: string|null) => void}} options
 */
export function setupFiles({ getEntries, replaceEntries, onError }) {
  const get = id => document.getElementById(id);
  const status = get('file-status');
  const input = get('import-file');
  const buttons = [get('open-file'), get('export-file'), get('save-file')];
  let handle = null;
  let fileName = null;
  let downloaded = false;
  let revision = 0;
  let savedRevision = null;
  let busy = false;
  let blocked = false;
  const nativeOpen = typeof window.showOpenFilePicker === 'function';
  const nativeSave = typeof window.showSaveFilePicker === 'function';
  get('save-file').hidden = !nativeSave;

  function refresh() {
    const unsaved = savedRevision !== null && savedRevision !== revision;
    const copyStatus = unsaved ? 'changes since last file copy' : downloaded ? 'JSON download requested' : 'opened file matches this timeline';
    status.textContent = fileName
      ? `${fileName} · ${handle ? (unsaved ? 'unsaved file changes' : 'file matches this timeline') : copyStatus}${handle ? '' : ' · use Export JSON for a new copy'}`
      : 'Browser copy only · save a JSON file for a durable copy.';
    for (const button of buttons) button.disabled = busy || (blocked && button.id !== 'open-file');
  }

  async function operation(work) {
    if (busy) return;
    busy = true;
    refresh();
    onError(null);
    try { await work(); }
    catch (error) {
      if (error.name !== 'AbortError') onError(`File operation failed: ${error.message}`);
    } finally {
      busy = false;
      refresh();
    }
  }

  async function importFile(file, nextHandle = null) {
    const text = await file.text();
    let imported;
    try { imported = parseEntriesFile(text); }
    catch (error) { throw new Error(`Invalid timeline JSON. Current entries have not been changed. ${error.message}`); }
    if (!window.confirm(`Replace this timeline with ${imported.length} ${imported.length === 1 ? 'entry' : 'entries'} from “${file.name}”? Export the current timeline first if you want to keep it.`)) return;
    replaceEntries(imported);
    handle = nextHandle;
    fileName = file.name;
    downloaded = false;
    savedRevision = revision;
  }

  get('open-file').addEventListener('click', () => {
    if (!nativeOpen) { input.click(); return; }
    operation(async () => {
      const [nextHandle] = await window.showOpenFilePicker({ types: FILE_TYPES, multiple: false });
      await importFile(await nextHandle.getFile(), nextHandle);
    });
  });
  input.addEventListener('change', () => {
    const file = input.files[0];
    input.value = '';
    if (file) operation(() => importFile(file));
  });
  get('save-file').addEventListener('click', () => operation(async () => {
    const nextHandle = handle ?? await window.showSaveFilePicker({ suggestedName: fileName ?? 'timeline.json', types: FILE_TYPES });
    const saved = revision;
    const content = serializeEntriesFile(getEntries());
    const writable = await nextHandle.createWritable();
    try {
      await writable.write(content);
      await writable.close();
    } catch (error) {
      try { await writable.abort(); } catch { /* Retain the original write error. */ }
      throw error;
    }
    handle = nextHandle;
    fileName = nextHandle.name;
    savedRevision = saved;
  }));
  get('export-file').addEventListener('click', () => {
    try {
      const content = serializeEntriesFile(getEntries());
      const url = URL.createObjectURL(new Blob([content], { type: 'application/json' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = fileName ?? 'timeline.json';
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      if (!handle) { fileName = link.download; downloaded = true; savedRevision = revision; }
      onError(null);
      refresh();
    } catch (error) { onError(`JSON export failed: ${error.message}`); }
  });
  window.addEventListener('beforeunload', event => {
    if (fileName && savedRevision !== revision) {
      event.preventDefault();
      event.returnValue = '';
    }
  });
  refresh();
  return {
    changed() { revision++; refresh(); },
    setBlocked(value) { blocked = value; refresh(); },
  };
}
