# Timeline outlook

A personal 1–6 month outlook for project submissions, travel, and important events. One horizontal time axis uses proportional calendar spacing. Dots mark single dates and thin lines show intervals; each has a box connected directly to it. Events and tasks sit below a fixed-height axis, so the line stays steady while scrolling. Overlapping boxes stack vertically without shifting their dates.

Built with HTML, CSS, and plain JavaScript modules. No framework, runtime dependencies, installation, or build step.

See [PLANS.md](PLANS.md) for the development direction, UX ideas, and open design questions.

## Run

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

Open <http://localhost:5173>. `npm start` runs the same command. JavaScript modules need an HTTP server; opening `index.html` directly will not work.

## Use

- Choose **1, 3, or 6 months**. Outlook controls the zoom: the selected period fits the visible area, while the timeline scrolls continuously into the past and future. Equal day intervals retain equal spacing while scrolling. The initial outlook is three months from today.
- **Previous** and **Next** move by the selected outlook: 1, 3, or 6 calendar months. **Today** places today at the left inset to show upcoming items. Scroll horizontally with a trackpad or touch swipe, drag with the mouse, or focus the timeline and use Left/Right arrow keys. Navigation covers years 0001–9999; the scroll buffer recenters as you move.
- Add a **Task** with its finish/submission date and optional planned start. Its box connects to the finish marker.
- Add an **Event** with a date/start and optional end date. Interval boxes connect at the midpoint of their visible portion.
- Select a box to edit, delete, or complete a task. Hovering or focusing a box highlights its connection.
- Completed tasks are hidden unless **Show completed** is checked.
- Intervals extending beyond the outlook have continuation marks and retain their full dates in the box.
- Saving an entry whose event start or task finish is outside the outlook moves the view to that date.

Dates have day-level precision, without times of day. Interval endpoints are positioned at their calendar dates; same-day intervals appear as dots. On a small screen the selected time span still fits; crowded labels use additional vertical space.

Alternating month bands separate the calendar visually. Each Monday has a separator; day-number labels appear every week when space allows and at a regular wider interval on narrow views. Month names sit above the axis, and the visible year or year range appears in the heading. A nearly clipped month can lose its label until more of it is visible.

## Storage and the previous view

Entries belong to this browser and origin. Different ports, devices, browsers, and `localhost` vs `127.0.0.1` have separate data. Clearing browser data removes entries. There is no sync or backup service.

The new view saves `{ "version": 2, "entries": [...] }` under `timeline-board-v2` in localStorage. Each entry has `id`, `title`, and `kind`:

- Events: `start` (date), `end` (date or `null`).
- Tasks: `finish` (date), `start` (date or `null`), `completed` (boolean).

Dates are `YYYY-MM-DD`. When no v2 record exists, the app reads the original `timeline-board` v1 record and converts deadlines to tasks, using the old end date as finish when present. The original record is never overwritten, so it remains available to the previous view in commit `016d4e8`. The two views' subsequent edits are independent.

Save failures leave edits in memory and show a warning; save again after restoring storage access. Invalid saved data is preserved and editing is disabled. Use browser developer tools to copy the affected localStorage record somewhere safe, then repair or remove it before reloading. Invalid v2 data never silently falls back to v1.

## Verify

Requires Node.js 22 or newer:

```sh
node --test
```

Tests cover calendar arithmetic, horizon spacing, clipping, label collisions, direct connectors, completion filtering, migration, and storage errors. In environments where the isolated test runner cannot report individual tests, use `node --test --experimental-test-isolation=none`.

The browser checklist is add/edit/delete, finish-first task input, completion visibility, reload persistence, 1/3/6 month navigation, Today, overlapping entries, narrow screens, and keyboard focus.

See [browser/README.md](browser/README.md) for deterministic Playwright checks and screenshot verification.

## Code

- `src/dates.js`: timezone-independent calendar arithmetic, month shifts, and formatting.
- `src/timeline.js`: calendar bands, Monday separators, label collisions, and interval rails.
- `src/render.js`: SVG rendering and measured HTML cards.
- `src/storage.js`: validated JSDoc entry types, legacy migration, and persistence.
- `src/app.js`: state, native forms, and navigation.
- `src/viewport.js`: zoom, fractional date positions, scroll buffers, and calendar bounds.

There are no project hierarchies, dependencies between tasks, progress tracking, or scheduled notifications.
