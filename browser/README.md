# Browser verification

`checks.js` is a self-contained async Playwright function accepting an isolated `page` and optional `{ baseUrl, artifactDirectory }`. It fixes the date at 2026-10-04, seeds five overlapping entries, runs interaction checks, and saves desktop/mobile screenshots. It clears storage in that context: never run it against a user's populated profile.

Use the existing Playwright MCP browser tooling to execute the function on a new context/page. Read `checks.js`, invoke the expression with that page, and close the test context afterward. The default server is `http://127.0.0.1:5173`; start it with `npm start`. Create `browser-artifacts/` before running, or supply another existing artifact directory. The browser should be headed when a desktop is available.

Treat returned check groups as passing only if the function completes and there are no page errors. Inspect the saved screenshots for visual readability; collision assertions alone do not prove a clear layout.

The manual checklist remains: add/edit/delete; task/event date switching; completion filtering; reload persistence; 1/3/6 month navigation; Today; mouse panning without accidental edits; touch scrolling; five overlapping entries; narrow screens; keyboard focus. Test on a phone/touch browser separately when available.

No browser package is required to run the app or unit tests. A standalone browser runner is a possible future convenience; the MCP harness can be used now without adding dependencies.
