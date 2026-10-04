# Browser verification

Install the development dependency and Chromium once (and again after upgrading Playwright):

```sh
npm ci
npx playwright install chromium
```

Run both suites locally:

```sh
npm run test:browser
```

The runner opens a visible Chromium window, starts its own no-cache Python server on an available loopback port, and gives each suite a fresh context with English locale and UTC timezone. It closes the browser and server on completion, failure, or Ctrl+C. Your development server and browser profile are independent. Assertions, uncaught browser errors, and timeouts produce a failing exit status. No CI or pull request workflow is required.

For machines without a desktop, explicitly select headless mode:

```sh
npm run test:browser -- --headless
```

Screenshots and downloaded JSON go into ignored `browser-artifacts/`; each run overwrites the same filenames. Failures also attempt to capture a screenshot named after the suite. Inspect the screenshots for readability; passing assertions alone do not prove a clear layout. `npm test` remains the separate, fast unit-test command and requires no dependency installation.

`checks.js` exports an async Playwright function accepting an isolated `page` and optional `{ baseUrl, artifactDirectory }`. It fixes the date at 2026-10-04, seeds five overlapping entries, runs interaction checks, and saves desktop/mobile screenshots. It clears storage in that context: never run it against a user's populated profile.

For optional Playwright MCP execution, read `checks.js`, remove the leading `export default` to obtain the function expression, invoke it on a new isolated context/page, and close that context afterward. The default server is `http://127.0.0.1:5173`; start it with `npm start`. Create `browser-artifacts/` before running, or supply another existing artifact directory. The browser should be headed when a desktop is available.

Treat returned check groups as passing only if the function completes and there are no page errors. Inspect the saved screenshots for visual readability; collision assertions alone do not prove a clear layout.

The harness uses English locale expectations; create its context with `locale: 'en-US'`. It tests actual download/upload with saved JSON artifacts. Native file reads and writes use real handles/streams in the browser's origin-private filesystem, with mocked OS pickers and injected write failures. A real OS picker/permission check remains manual. It also verifies failed browser saves/retry and recovery from malformed storage without overwriting that record.

`navigation-checks.js` is a second function with the same interface. Run it in a separate isolated Chromium context with `locale: 'en-US', hasTouch: true`. It tests file upload fallback when native APIs are unavailable, panning from a card without accidental editing, focus through scrolling/resizing, empty-view completion, and keyboard access to Save in the narrow editor. Its CDP touch gestures exercise Chromium's native scroll behavior; they are emulation rather than real phone testing.

The manual checklist remains: add/edit/delete; task/event date switching; completion filtering; reload persistence; 1/3/6 month navigation; Today; mouse panning without accidental edits; touch scrolling; five overlapping entries; narrow screens; keyboard focus. Test on a phone/touch browser separately when available.

No browser package is required to run the app or unit tests. Playwright is used only by the browser runner.
