# Timeline outlook

A personal 1–6 month outlook for project submissions, travel, and important events. One horizontal time axis uses proportional calendar spacing. Dots mark single dates and thin lines show intervals; each has a box connected directly to it. Events and tasks sit below a fixed-height axis, so the line stays steady while scrolling. Overlapping boxes stack vertically without shifting their dates.

Built with HTML, CSS, and plain JavaScript modules. No framework, runtime dependencies, installation, or build step.

See [PLANS.md](PLANS.md) for the development direction, UX ideas, and open design questions.

## Run

```sh
python3 server.py
```

Open <http://localhost:5173>. `npm start` runs the same command. JavaScript modules need an HTTP server; opening `index.html` directly will not work.

The local server sends `Cache-Control: no-store` for application files and returns current files even when the browser sends a conditional request. This prevents older modules from being mixed with newer ones after edits or branch changes. After switching from the old server, restart it and hard reload once with Ctrl+Shift+R (Cmd+Shift+R on macOS) to replace previously cached files. Clearing site data is unnecessary and can delete entries.

If hosting elsewhere, configure the host to prevent caching HTML, CSS, and JavaScript at their current stable URLs. For a future production build, use content-hashed asset filenames and revalidate HTML instead.

## Use

- Choose **1, 3, or 6 months**. Outlook controls the zoom: the selected period fits the visible area, while the timeline scrolls continuously into the past and future. Equal day intervals retain equal spacing while scrolling. The initial outlook is three months from today.
- **Previous** and **Next** move by the selected outlook: 1, 3, or 6 calendar months. The visible window adds a 7% margin on each side of the selected outlook. The initial view and **Today** show that small margin of recent history before today and the same extra time beyond the outlook. Scroll horizontally with a trackpad or touch swipe, drag with the mouse, or focus the timeline and use Left/Right arrow keys. Navigation covers years 0001–9999; the scroll buffer recenters as you move.
- Add a **Task** with its finish/submission date and optional planned start. Its box connects to the finish marker.
- Add an **Event** with a date/start and optional end date. Interval boxes connect at the midpoint of their visible portion.
- Select a box to edit or delete it. Tasks also have a completion checkbox directly on the card. Hovering or focusing a box highlights its connection.
- Completed tasks are hidden unless **Show completed** is checked.
- Intervals extending beyond the outlook have continuation marks and retain their full dates in the box.
- Saving an entry whose event start or task finish is outside the outlook moves the view to that date.
- Add optional category labels (such as Exam or Project) and choose a color for cards and their connections. Categories are independent of Event/Task.
- Keep notes and links in the description, visible only in the editor. HTTP(S) links appear as clickable links below the plain-text notes; HTML and Markdown are not rendered.

Dates have day-level precision, without times of day. Interval endpoints are positioned at their calendar dates; same-day intervals appear as dots. On a small screen the selected time span still fits; crowded labels use additional vertical space.

Alternating month bands separate the calendar visually. Each Monday has a separator; day-number labels appear every week when space allows and at a regular wider interval on narrow views. Month names sit above the axis, and the visible year or year range appears in the heading. A nearly clipped month can lose its label until more of it is visible.

## Keyboard

Press **N** to add; **J/K** to select next/previous entries in date order; **Enter** to edit the focused card; **X** to complete/reopen a focused task. Completing a hidden task focuses the next visible entry, or the previous one at the end; an empty view focuses the timeline.

**1/3/6** changes the outlook, **Page Up/Page Down** moves by that outlook, and **T** returns to today. On the timeline or an edit button, **Left/Right** scrolls and **Up/Down** selects entries. **Enter** on the timeline opens the first visible entry.

**Ctrl/Cmd+Enter** saves in the editor; **Escape** cancels a dialog. **?** or the **Keys** button shows all shortcuts. Shortcuts leave input fields and native select controls alone. Tab and Shift+Tab work normally, including the completion checkboxes.

## Storage and the previous view

Use **Export JSON** to download a complete local copy, including descriptions, categories, colors, IDs, and completed tasks. **Open JSON** validates an entire file and asks before replacing the current timeline. Invalid files and canceled imports leave entries unchanged. Existing v2 records and legacy v1 files can be opened.

Export starts a browser download; verify the downloaded file in your Downloads folder. The app cannot confirm whether you accepted or canceled the browser's download.

On browsers with native file access, **Open JSON** can connect to a file and **Save file** writes back to it. Saving without a connected file asks where to save. File access lasts for this tab; reopen the file after reloading. Other browsers use ordinary upload/download. Files save explicitly, while the browser copy saves automatically. The file status shows unsaved changes; closing/reloading after changes to an opened or exported file requests confirmation. Native picker availability depends on the browser and secure-context support.

Portable exports contain `{ "format": "timeline-board", "version": 2, "entries": [...] }`. Keep these files somewhere durable. CSV, GitHub storage, and synchronization are not implemented.

Entries belong to this browser and origin. Different ports, devices, browsers, and `localhost` vs `127.0.0.1` have separate data. Clearing browser data removes entries. There is no sync or backup service.

The new view saves `{ "version": 2, "entries": [...] }` under `timeline-board-v2` in localStorage. Each entry has `id`, `title`, and `kind`:

- Events: `start` (date), `end` (date or `null`).
- Tasks: `finish` (date), `start` (date or `null`), `completed` (boolean).

Both kinds support optional `description` (plain text, up to 20,000 characters), `category` (up to 40 characters), and `color` (`blue`, `green`, `amber`, `rose`, `violet`, or `slate`). These are additive v2 fields; existing records still load. Earlier app revisions can discard these new fields when saving, so retain a backup before using an older revision with detailed entries.

Dates are `YYYY-MM-DD`. When no v2 record exists, the app reads the original `timeline-board` v1 record and converts deadlines to tasks, using the old end date as finish when present. The original record is never overwritten, so it remains available to the previous view in commit `016d4e8`. The two views' subsequent edits are independent.

Save failures leave edits in memory and show a warning with **Retry browser save**. You can also export or save those edits to a file. Invalid saved data is preserved and initially disables editing. Opening a valid JSON file enables editing in this tab while leaving the unreadable browser record untouched; save/export the recovered timeline before reloading. Use browser developer tools to copy the affected localStorage record somewhere safe, then repair or remove it to restore normal browser saving. Invalid v2 data never silently falls back to v1.

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
- `src/storage.js`: legacy migration, versioned persistence, and portable file validation/serialization.
- `src/files.js`: explicit file opening/saving, downloads/uploads, and file status.
- `src/entries.js`: entry types, validation, and supported colors.
- `src/notes.js`: safe HTTP(S) link extraction from plain text.
- `src/app.js`: state, native forms, and navigation.
- `src/viewport.js`: zoom, fractional date positions, scroll buffers, and calendar bounds.
- `src/keyboard.js`: context-aware shortcut resolution, independent of the DOM.

There are no project hierarchies, dependencies between tasks, progress tracking, or scheduled notifications.
