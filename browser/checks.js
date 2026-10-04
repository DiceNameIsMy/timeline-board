async (page, { baseUrl = 'http://127.0.0.1:5173', artifactDirectory = 'browser-artifacts' } = {}) => {
  // Run on an isolated page/context; never use a user's populated browser profile.
  const results = [];
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00Z'));
  await page.goto(baseUrl);
  await page.evaluate(() => {
    localStorage.clear();
    const entries = Array.from({ length: 5 }, (_, index) => index % 2
      ? { id: `fixture-${index}`, title: `Assignment ${index} with a long title for checking card wrapping`, kind: 'task', start: '2026-10-10', finish: '2026-11-02', completed: false }
      : { id: `fixture-${index}`, title: `Event ${index}`, kind: 'event', start: '2026-10-20', end: '2026-11-05' });
    localStorage.setItem('timeline-board-v2', JSON.stringify({ version: 2, entries }));
  });
  await page.reload();
  await page.locator('.entry-box').first().waitFor();
  assert(await page.locator('.entry-box').count() === 5, 'Five overlapping entries should render');
  for (const zoom of ['1', '3', '6']) {
    await page.locator('#horizon').selectOption(zoom);
    const separators = await page.locator('.week-separator').evaluateAll(elements => elements.map(element => Number(element.dataset.day)));
    assert(separators.length >= 4, `Weekly separators missing at ${zoom}-month zoom`);
    assert(separators.slice(1).every((day, index) => day - separators[index] === 7), 'Separators must be seven days apart');
  }
  await page.locator('#horizon').selectOption('6');
  assert(await page.locator('#visible-year').textContent() === '2026 – 2027', 'Year context must show a year boundary');
  await page.locator('#horizon').selectOption('3');
  const checkCards = async () => {
    const bounds = await page.locator('.entry-box').evaluateAll(elements => elements.map(element => {
      const { x, y, width, height } = element.getBoundingClientRect();
      return { x, y, width, height };
    }));
    for (let a = 0; a < bounds.length; a++) for (let b = a + 1; b < bounds.length; b++) {
      const first = bounds[a], second = bounds[b];
      assert(!(first.x < second.x + second.width && second.x < first.x + first.width && first.y < second.y + second.height && second.y < first.y + first.height), 'Measured cards must not overlap');
    }
  };
  await checkCards();
  await page.screenshot({ path: `${artifactDirectory}/month-weeks-desktop.png`, fullPage: true });
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForFunction(() => document.querySelector('#canvas').clientWidth === document.querySelector('#timeline').clientWidth);
  await checkCards();
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'Narrow layout must not overflow the page');
  await page.screenshot({ path: `${artifactDirectory}/month-weeks-mobile.png`, fullPage: true });
  results.push('Month bands, Monday separators, year context, five overlaps, narrow layout');
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.locator('#add').click();
  await page.locator('#title').fill('Browser regression entry');
  await page.locator('#date').fill('2026-10-15');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.getByRole('button', { name: /Browser regression entry.*Edit entry/ }).click();
  await page.locator('#title').fill('Edited browser entry');
  await page.locator('#description').fill('Read https://example.org/assignment\n<script>plain text</script>');
  await page.locator('#category').fill('Exam');
  await page.locator('#color').selectOption('rose');
  assert(await page.locator('#description-links a').getAttribute('href') === 'https://example.org/assignment', 'Notes must expose an HTTP link');
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /Edited browser entry.*Edit entry/ }).waitFor();
  const details = await page.evaluate(() => JSON.parse(localStorage.getItem('timeline-board-v2')).entries.find(entry => entry.title === 'Edited browser entry'));
  assert(details.category === 'Exam' && details.color === 'rose' && details.description.includes('<script>plain text</script>'), 'Details must survive reload as plain data');
  assert(!(await page.locator('#boxes').innerText()).includes('https://'), 'Descriptions must stay outside timeline cards');
  results.push('Descriptions, safe links, categories and colors survive reload');
  results.push('Add, edit, reload persistence');
  await page.locator('#timeline').focus();
  await page.keyboard.press('ArrowDown');
  assert(await page.locator('.entry-edit:focus').innerText().then(text => text.includes('Edited browser entry')), 'Selection must follow calendar dates');
  await page.keyboard.press('Enter');
  assert(await page.locator('#editor').evaluate(element => element.open), 'Enter must open the focused card');
  await page.locator('#title').press('n');
  assert(await page.locator('#title').inputValue() === 'Edited browser entryn', 'N must type normally in the editor');
  await page.locator('#title').fill('Edited browser entry');
  await page.locator('#date').fill('2026-10-16');
  await page.locator('#other-date').fill('2026-10-18');
  await page.locator('#kind').selectOption('task');
  assert(await page.locator('#date').inputValue() === '2026-10-18' && await page.locator('#other-date').inputValue() === '2026-10-16', 'Changing kind must preserve interval endpoints');
  await page.locator('#kind').selectOption('event');
  await page.keyboard.press('Control+Enter');
  assert(!await page.locator('#editor').evaluate(element => element.open), 'Ctrl+Enter must save and close');
  assert(await page.locator('.entry-edit:focus').count() === 1, 'Saving must return focus to the card');
  await page.keyboard.press('6');
  assert(await page.locator('#horizon').inputValue() === '6', '6 must change outlook');
  await page.keyboard.press('PageDown');
  assert((await page.locator('#visible-range').textContent()).startsWith('Mar 21'), 'PageDown must move one selected outlook');
  await page.keyboard.press('t');
  assert((await page.locator('#visible-range').textContent()).startsWith('Sep 21'), 'T must return to today with recent history');
  assert(await page.locator('.today-marker text').evaluate(label => {
    const bounds = label.getBBox();
    const line = label.parentElement.querySelector('line');
    return bounds.x >= 0 && bounds.x + bounds.width < Number(line.getAttribute('x1'));
  }), 'Today label must fit fully to the left of its marker');
  await page.keyboard.press('3');
  await page.locator('[data-id="fixture-1"] .entry-edit').focus();
  await page.keyboard.press('x');
  assert(await page.locator('[data-id="fixture-1"]').count() === 0, 'Completed task must hide');
  assert(await page.locator('.entry-edit:focus').evaluate(element => element.closest('.entry-box').dataset.id) === 'fixture-3', 'Completion must focus the next visible entry');
  assert(!await page.locator('#editor').evaluate(element => element.open), 'Quick completion must not open the editor');
  await page.locator('#show-completed').check();
  assert(await page.locator('[data-id="fixture-1"] input').isChecked(), 'Show completed must restore the checked task');
  await page.locator('[data-id="fixture-1"] input').uncheck();
  await page.locator('#show-completed').uncheck();
  assert(await page.locator('[data-id="fixture-1"]').count() === 1, 'Checkbox must reopen the task');
  await page.locator('#timeline').focus();
  await page.keyboard.press('?');
  assert(await page.locator('#shortcuts-dialog').evaluate(element => element.open), 'Help must open');
  await page.keyboard.press('Escape');
  await page.keyboard.press('n');
  assert(await page.locator('#editor').evaluate(element => element.open), 'N must add an entry');
  await page.keyboard.press('Escape');
  results.push('Keyboard selection/edit/save/zoom/navigation/help, typing protection, quick completion and focus');
  await page.getByRole('button', { name: /Edited browser entry.*Edit entry/ }).click();
  assert(await page.locator('#description').inputValue() === details.description, 'Editor must restore notes');
  await page.screenshot({ path: `${artifactDirectory}/entry-details.png`, fullPage: true });
  await page.keyboard.press('Escape');
  const beforeExport = await page.evaluate(() => JSON.parse(localStorage.getItem('timeline-board-v2')).entries);
  const downloading = page.waitForEvent('download');
  await page.locator('#export-file').click();
  assert((await page.locator('#file-status').textContent()).includes('download requested'), 'Download status must not claim the OS has saved the file');
  const download = await downloading;
  const exportedPath = `${artifactDirectory}/timeline-export.json`;
  await download.saveAs(exportedPath);
  await page.getByRole('button', { name: /Edited browser entry.*Edit entry/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#delete').click();
  assert(await page.getByRole('button', { name: /Edited browser entry.*Edit entry/ }).count() === 0, 'Delete must remove the entry');
  assert(await page.locator('#add').evaluate(element => element === document.activeElement), 'Delete must return focus to Add');
  results.push('Task/event interval switching, details editing, deletion and focus');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#import-file').setInputFiles(exportedPath);
  await page.getByRole('button', { name: /Edited browser entry.*Edit entry/ }).waitFor();
  const afterImport = await page.evaluate(() => JSON.parse(localStorage.getItem('timeline-board-v2')).entries);
  assert(JSON.stringify(afterImport) === JSON.stringify(beforeExport), 'Actual JSON download/upload must round-trip every entry');
  await page.evaluate(() => {
    const input = document.querySelector('#import-file');
    const transfer = new DataTransfer();
    transfer.items.add(new File(['{broken'], 'invalid.json', { type: 'application/json' }));
    input.files = transfer.files;
    input.dispatchEvent(new Event('change'));
  });
  await page.locator('#file-error').waitFor();
  assert(JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('timeline-board-v2')).entries)) === JSON.stringify(beforeExport), 'Invalid import must preserve the browser record');
  page.once('dialog', dialog => dialog.dismiss());
  await page.locator('#import-file').setInputFiles(exportedPath);
  await page.waitForFunction(() => !document.querySelector('#open-file').disabled);
  assert(await page.locator('.entry-box').count() === beforeExport.length, 'Canceled import must preserve entries');
  results.push('Actual JSON export/import round-trip, invalid import and cancellation');
  // Mock only the OS picker: use a real browser filesystem handle and writable
  // stream in origin-private storage to exercise native file reads and writes.
  await page.evaluate(async () => {
    const root = await navigator.storage.getDirectory();
    const diskHandle = await root.getFileHandle('linked-timeline.json', { create: true });
    window.__diskHandle = diskHandle;
    window.__fileWrites = [];
    window.__pickerCalls = 0;
    window.showSaveFilePicker = async () => {
      window.__pickerCalls++;
      return {
        name: 'linked-timeline.json',
        createWritable: async () => {
          if (window.__denyFileWrite) throw new Error('Permission denied');
          const stream = await diskHandle.createWritable();
          return {
            write: async text => { window.__fileWrites.push(text); await stream.write(text); },
            close: async () => stream.close(),
            abort: async () => stream.abort(),
          };
        },
      };
    };
  });
  await page.locator('#save-file').click();
  await page.waitForFunction(() => document.querySelector('#file-status').textContent.includes('linked-timeline.json'));
  assert(await page.evaluate(() => JSON.parse(window.__fileWrites[0]).entries.length) === beforeExport.length, 'Native save must write the entire timeline');
  await page.locator('[data-id="fixture-1"] input').click();
  await page.waitForFunction(() => !document.querySelector('[data-id="fixture-1"]'));
  assert((await page.locator('#file-status').textContent()).includes('unsaved'), 'Changes must mark the linked file dirty');
  await page.evaluate(() => { window.__denyFileWrite = true; });
  await page.locator('#save-file').click();
  await page.locator('#file-error').waitFor();
  assert((await page.locator('#file-status').textContent()).includes('unsaved'), 'A failed file write must remain dirty');
  await page.evaluate(() => { window.__denyFileWrite = false; });
  await page.locator('#save-file').click();
  await page.waitForFunction(() => document.querySelector('#file-status').textContent.includes('file matches'));
  assert(await page.evaluate(() => window.__pickerCalls) === 1, 'Repeated saves must reuse the selected handle');
  assert(await page.evaluate(() => JSON.parse(window.__fileWrites.at(-1)).entries.find(entry => entry.id === 'fixture-1').completed), 'Repeated save must include new edits');
  const diskEntries = await page.evaluate(async () => JSON.parse(await (await window.__diskHandle.getFile()).text()).entries);
  assert(diskEntries.find(entry => entry.id === 'fixture-1').completed, 'Actual browser filesystem file must contain the saved edits');
  await page.evaluate(() => { window.showOpenFilePicker = async () => [window.__diskHandle]; });
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#open-file').click();
  await page.waitForFunction(() => !document.querySelector('#open-file').disabled);
  assert(JSON.stringify(await page.evaluate(() => JSON.parse(localStorage.getItem('timeline-board-v2')).entries)) === JSON.stringify(diskEntries), 'Opening an actual file handle must restore its complete contents');
  results.push('Real browser filesystem read/write, handle reuse, dirty state and write failure (OS pickers mocked)');
  await page.evaluate(() => {
    window.__originalSetItem = Storage.prototype.setItem;
    Storage.prototype.setItem = function(key, value) {
      if (key === 'timeline-board-v2') throw new Error('Storage full');
      return window.__originalSetItem.call(this, key, value);
    };
  });
  await page.locator('#add').click();
  await page.locator('#title').fill('Unsaved browser edit');
  await page.locator('#date').fill('2026-10-25');
  await page.keyboard.press('Control+Enter');
  await page.locator('#retry-save').waitFor();
  await page.getByRole('button', { name: /Unsaved browser edit.*Edit entry/ }).waitFor();
  assert(!(await page.evaluate(() => localStorage.getItem('timeline-board-v2'))).includes('Unsaved browser edit'), 'Failed browser save must preserve prior record');
  await page.evaluate(() => { Storage.prototype.setItem = window.__originalSetItem; });
  await page.locator('#retry-save').click();
  assert((await page.evaluate(() => localStorage.getItem('timeline-board-v2'))).includes('Unsaved browser edit'), 'Retry must save in-memory edits');
  await page.locator('#save-file').click();
  await page.waitForFunction(() => document.querySelector('#file-status').textContent.includes('file matches'));
  results.push('Browser write failure preserves edits and supports explicit retry');
  await page.evaluate(() => { localStorage.setItem('timeline-board-v2', '{broken'); });
  await page.reload();
  assert(await page.locator('#add').isDisabled(), 'Invalid saved data must initially block editing');
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#import-file').setInputFiles(exportedPath);
  await page.waitForFunction(() => !document.querySelector('#add').disabled);
  assert(await page.evaluate(() => localStorage.getItem('timeline-board-v2')) === '{broken', 'File recovery must preserve unreadable browser data');
  await page.locator('#add').click();
  await page.locator('#title').fill('Recovered file edit');
  await page.locator('#date').fill('2026-10-26');
  await page.keyboard.press('Control+Enter');
  await page.getByRole('button', { name: /Recovered file edit.*Edit entry/ }).waitFor();
  assert(await page.evaluate(() => localStorage.getItem('timeline-board-v2')) === '{broken', 'Recovered edits must not overwrite unreadable data');
  const recoveredDownload = page.waitForEvent('download');
  await page.locator('#export-file').click();
  await (await recoveredDownload).saveAs(`${artifactDirectory}/recovered-timeline.json`);
  results.push('File recovery enables editing while preserving malformed storage');
  return results;
}
