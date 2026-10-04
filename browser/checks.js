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
  await page.locator('#horizon').selectOption('3');
  assert(await page.locator('#visible-year').textContent() === '2026 – 2027', 'Year context must show a year boundary');
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
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.reload();
  await page.getByRole('button', { name: /Edited browser entry.*Edit entry/ }).waitFor();
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
  await page.keyboard.press('Control+Enter');
  assert(!await page.locator('#editor').evaluate(element => element.open), 'Ctrl+Enter must save and close');
  assert(await page.locator('.entry-edit:focus').count() === 1, 'Saving must return focus to the card');
  await page.keyboard.press('6');
  assert(await page.locator('#horizon').inputValue() === '6', '6 must change outlook');
  await page.keyboard.press('PageDown');
  assert((await page.locator('#visible-range').textContent()).includes('Apr'), 'PageDown must move one selected outlook');
  await page.keyboard.press('t');
  assert((await page.locator('#visible-range').textContent()).startsWith('Oct 4'), 'T must return to today');
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
  return results;
}
