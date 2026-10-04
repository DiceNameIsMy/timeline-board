# Repository Guidelines

## Project Structure & Module Organization

This is a small static app using HTML, CSS, and native JavaScript modules. `index.html`, `styles.css`, and `favicon.svg` contain the page, styles, and icon. Source modules live in `src/`:

- `app.js`: application state, forms, and navigation.
- `dates.js`: calendar arithmetic and date formatting.
- `timeline.js`: proportional geometry, calendar bands, and collision layout.
- `render.js`: measured HTML cards and SVG rendering.
- `viewport.js`: zoom, fractional scroll positions, scroll buffers, and calendar bounds.
- `storage.js`: validation, versioned persistence, and legacy migration.

Tests live in `test/`. Keep calculation functions independent of the DOM so they remain easy to test.

Product direction and open ideas live in `PLANS.md`. Prioritize a personal, keyboard-friendly timeline with about five overlapping entries; keep descriptions outside the timeline. The user authorizes agents to make verified milestone commits for the current implementation work.

## Build, Test, and Development Commands

No dependency installation or build step is required. Use Python 3 for serving and Node.js 22+ for tests.

- `npm start`: serve locally at `http://localhost:5173`.
- `python3 -m http.server 5173 --bind 127.0.0.1`: equivalent without npm.
- `npm test` or `node --test`: run all tests.
- `node --test --experimental-test-isolation=none`: fallback when isolated test reporting is unavailable.
- `git diff --check`: catch whitespace errors before submitting changes.

Use HTTP rather than opening `index.html` directly; browser modules require a server.

## Coding Style & Naming Conventions

Follow existing JavaScript style: two-space indentation, single quotes, semicolons, ES module imports, camelCase functions/variables, and UPPER_SNAKE_CASE constants. Use lowercase module filenames and kebab-case CSS classes and HTML IDs. Document entry shapes and important interfaces with JSDoc. No formatter or linter is configured. Keep dependencies minimal and use `textContent` for user-entered text.

## Testing Guidelines

Use `node:test` and `node:assert/strict`. Name files `test/<module>.test.js` and describe expected behavior in test names. No numerical coverage threshold is configured. Add focused regression tests for changed calendar, spacing, clipping, collision, validation, or migration behavior.

For UI changes, check add/edit/delete, completion filtering, reload persistence, navigation, narrow screens, and keyboard focus. Report browser checks that could not be performed.

Use the isolated Playwright checks in `browser/checks.js` as described in `browser/README.md`. Never seed fixtures or clear storage in a user's browser profile. Inspect screenshots for visual changes and report touch checks separately from desktop browser checks.

## Commit & Pull Request Guidelines

History uses descriptive imperative subjects, such as “Add month-based timeline outlook and migrate entry storage”; no mandatory prefix convention exists. Keep commits focused. PR descriptions should explain the behavior change, validation performed, and storage compatibility impacts. Link relevant issues when available; include screenshots when they help explain layout changes.

## Storage Compatibility

Store calendar dates as `YYYY-MM-DD`; preserve timezone-independent spacing. New data uses `timeline-board-v2`. Never overwrite the legacy `timeline-board` record during migration or silently replace malformed saved data.
