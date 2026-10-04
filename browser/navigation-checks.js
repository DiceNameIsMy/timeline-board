async (page, { baseUrl = 'http://127.0.0.1:5173', artifactDirectory = 'browser-artifacts' } = {}) => {
  const assert = (condition, message) => { if (!condition) throw new Error(message); };
  await page.clock.setFixedTime(new Date('2026-10-04T12:00:00Z'));
  // Exercise browsers without native filesystem APIs as well as supported ones.
  await page.addInitScript(() => {
    window.showOpenFilePicker = undefined;
    window.showSaveFilePicker = undefined;
  });
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.goto(baseUrl);
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('timeline-board-v2', JSON.stringify({ version: 2, entries: [
      { id: 'task', title: 'Upcoming assignment', kind: 'task', finish: '2026-11-02', start: '2026-10-10', completed: false },
      { id: 'event', title: 'Travel', kind: 'event', start: '2026-10-20', end: '2026-11-05' },
    ] }));
  });
  await page.reload();
  assert(await page.locator('#save-file').isHidden(), 'Native save must hide when unsupported');
  const chooser = page.waitForEvent('filechooser');
  await page.locator('#open-file').click();
  await chooser;
  const before = await page.locator('#visible-range').textContent();
  const card = await page.locator('[data-id="event"] .entry-edit').boundingBox();
  await page.mouse.move(card.x + card.width / 2, card.y + 20);
  await page.mouse.down();
  await page.mouse.move(card.x + card.width / 2 - 80, card.y + 20, { steps: 8 });
  await page.mouse.up();
  await page.waitForFunction(previous => document.querySelector('#visible-range').textContent !== previous, before);
  assert(!await page.locator('#editor').evaluate(element => element.open), 'Panning from a card must not open its editor');
  await page.locator('#today').click();
  await page.locator('[data-id="event"] .entry-edit').focus();
  const rangeBeforeScroll = await page.locator('#visible-range').textContent();
  await page.evaluate(() => { document.querySelector('#timeline').scrollLeft += 80; });
  await page.waitForFunction(previous => document.querySelector('#visible-range').textContent !== previous, rangeBeforeScroll);
  assert(await page.locator('[data-id="event"] .entry-edit').evaluate(element => element === document.activeElement), 'Scroll rerender must preserve card focus');
  await page.setViewportSize({ width: 375, height: 812 });
  await page.waitForFunction(() => document.querySelector('#canvas').clientWidth === document.querySelector('#timeline').clientWidth);
  assert(await page.locator('[data-id="event"] .entry-edit').evaluate(element => element === document.activeElement), 'Resize must preserve card focus');
  await page.locator('#timeline').focus();
  await page.keyboard.press('Home');
  await page.waitForFunction(() => document.querySelector('#visible-range').textContent.startsWith('Oct 4'));
  const session = await page.context().newCDPSession(page);
  await session.send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 1 });
  const timeline = await page.locator('#timeline').boundingBox();
  const touchY = timeline.y + 60;
  const touchX = timeline.x + timeline.width - 40;
  await session.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: touchX, y: touchY }] });
  for (let step = 1; step <= 6; step++) await session.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: touchX - step * 20, y: touchY }] });
  await session.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForFunction(() => !document.querySelector('#visible-range').textContent.startsWith('Oct 4'));
  assert(!await page.locator('#editor').evaluate(element => element.open), 'Touch scrolling must not open the editor');
  await session.detach();
  await page.locator('#today').click();
  await page.locator('[data-id="task"] .entry-edit').focus();
  await page.keyboard.press('x');
  assert(await page.locator('.entry-edit:focus').evaluate(element => element.closest('.entry-box').dataset.id) === 'event', 'Completing the last card must focus the preceding card');
  await page.getByRole('button', { name: /Travel.*Edit entry/ }).click();
  page.once('dialog', dialog => dialog.accept());
  await page.locator('#delete').click();
  assert(await page.locator('#empty').isVisible(), 'A view with no visible entries must show its empty state');
  await page.locator('#show-completed').check();
  await page.locator('[data-id="task"] .entry-edit').focus();
  await page.keyboard.press('x');
  await page.locator('#show-completed').uncheck();
  await page.locator('[data-id="task"] .entry-edit').focus();
  await page.keyboard.press('x');
  assert(await page.locator('#timeline').evaluate(element => element === document.activeElement), 'Completing the only visible task must focus the timeline');
  await page.locator('#show-completed').check();
  await page.getByRole('button', { name: /Upcoming assignment.*Edit entry/ }).click();
  await page.locator('#description').fill('Notes on a narrow screen');
  await page.screenshot({ path: `${artifactDirectory}/editor-mobile.png`, fullPage: true });
  await page.locator('#description').press('Tab');
  await page.keyboard.press('Tab');
  await page.keyboard.press('Tab');
  const saveButton = page.getByRole('button', { name: 'Save', exact: true });
  assert(await saveButton.evaluate(element => element === document.activeElement), 'Tab must reach Save from notes');
  const saveBounds = await saveButton.boundingBox();
  assert(saveBounds.y >= 0 && saveBounds.y + saveBounds.height <= 812, 'Keyboard focus must scroll Save into view');
  await page.keyboard.press('Escape');
  return ['Upload/download fallback', 'Mouse pan and focus through scroll/resize', 'Chromium-emulated touch scrolling', 'Completion focus at end and empty view', 'Narrow editor'];
}
