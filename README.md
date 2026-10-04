# Timeline

A small personal timeline built with HTML, CSS, and plain JavaScript modules. Equal calendar intervals occupy equal distances. No framework, backend, dependencies, or build step.

## Run

From this directory:

```sh
python3 -m http.server 5173 --bind 127.0.0.1
```

Open <http://localhost:5173>. With Node.js installed, `npm start` runs the same command. Do not open `index.html` directly: browsers require an HTTP server for JavaScript modules.

## Use

- **Add entry** creates an event, deadline, or task. An optional end date creates an inclusive duration bar.
- Select an entry to edit or delete it, or mark a task complete.
- Scroll horizontally, use a mouse wheel when the timeline has no vertical overflow, or focus the timeline and use the browser's arrow-key scrolling.
- Choose **Days**, **Weeks**, or **Months** to change scale. **Today** returns to the current local date.
- Overlapping entries appear in separate lanes. The timeline extends as you scroll; calendar gaps are never collapsed.

All dates are calendar dates, without times of day. Completed tasks stay on the timeline.

## Data

Entries are saved under `timeline-board` in localStorage for this browser and origin. Different devices, browsers, ports, and `localhost` vs `127.0.0.1` have separate storage. Clearing browser data removes entries. There is no sync or backup in this version.

The record is `{ "version": 1, "entries": [...] }`. Each entry contains `id`, `title`, `kind` (`event`, `deadline`, or `task`), `start` (`YYYY-MM-DD`), `end` (date or `null`), and `completed` (boolean).

If saving fails, the app keeps edits in memory and displays a warning. Save again after restoring storage access. If stored data cannot be read or validated, it is left untouched and editing is disabled. To recover, inspect the `timeline-board` localStorage value in browser developer tools, copy it somewhere safe, and repair or remove it before reloading.

## Tests

Requires Node.js 22 or newer. No installation needed:

```sh
node --test
```

Tests cover calendar arithmetic, timeline spacing and collisions, range boundaries, and storage validation/failures. Browser interactions are checked separately.

## Code

- `src/dates.js`: timezone-independent calendar arithmetic and display formatting.
- `src/timeline.js`: proportional positions, collision lanes, calendar ticks, and DOM rendering.
- `src/storage.js`: entry validation and versioned persistence.
- `src/app.js`: in-memory state, native form interactions, and navigation.

Entry interfaces use JSDoc. TypeScript can be introduced later without replacing the UI architecture.
