# Browser verification

`checks.js` is a self-contained async Playwright function accepting an isolated `page` and optional `{ baseUrl, artifactDirectory }`. It fixes the date at 2026-10-04, seeds five overlapping entries, runs interaction checks, and saves desktop/mobile screenshots. It clears storage in that context: never run it against a user's populated profile.

Use the existing Playwright MCP browser tooling to execute the function on a new context/page. Read `checks.js`, invoke the expression with that page, and close the test context afterward. The default server is `http://127.0.0.1:5173`; start it with `npm start`. Create `browser-artifacts/` before running, or supply another existing artifact directory. The browser should be headed when a desktop is available.

Treat returned check groups as passing only if the function completes and there are no page errors. Inspect the saved screenshots for visual readability; collision assertions alone do not prove a clear layout.

The harness uses English locale expectations; create its context with `locale: 'en-US'`. It tests actual download/upload with saved JSON artifacts. Native file reads and writes use real handles/streams in the browser's origin-private filesystem, with mocked OS pickers and injected write failures. A real OS picker/permission check remains manual. It also verifies failed browser saves/retry and recovery from malformed storage without overwriting that record.

`navigation-checks.js` is a second function with the same interface. Run it in a separate isolated Chromium context with `locale: 'en-US', hasTouch: true`. It tests file upload fallback when native APIs are unavailable, panning from a card without accidental editing, focus through scrolling/resizing, empty-view completion, and keyboard access to Save in the narrow editor. Its CDP touch gestures exercise Chromium's native scroll behavior; they are emulation rather than real phone testing.

The manual checklist remains: add/edit/delete; task/event date switching; completion filtering; reload persistence; 1/3/6 month navigation; Today; mouse panning without accidental edits; touch scrolling; five overlapping entries; narrow screens; keyboard focus. Test on a phone/touch browser separately when available.

No browser package is required to run the app or unit tests. A standalone browser runner is a possible future convenience; the MCP harness can be used now without adding dependencies.
