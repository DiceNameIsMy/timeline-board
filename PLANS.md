# Project plans

Living backlog for ideas, agreed direction, and unresolved design questions. Entries here are plans, not descriptions of implemented behavior. Update this document as decisions are made and work lands.

## Product direction

- A personal replacement for a paper planning timeline: gradually add deadlines and events, adjust dates, and choose work based on urgency and expected effort.
- Keep the timeline central. A list or agenda is optional; its value is not established yet.
- Prioritize keyboard use, while retaining mouse and touch support.
- Aim for clear presentation with about five overlapping entries. Larger densities are welcome if practical.
- Keep details outside the timeline; concise labels and colors can help distinguish items.
- Keep deployment local for now. Durable local data files are sufficient; accounts, sync, notifications, and collaboration are outside the current direction.
- Improve the existing architecture incrementally. Dependencies or a framework are allowed when a concrete benefit justifies them.

## Time readability: month separation and regular weeks

Status: first implementation verified in desktop Chromium and at a narrow viewport; visual refinements remain possible.

### Problem and desired outcome

Current date labels are irregular and the year placement feels awkward. The viewport needs visual separation by month and regular week separators to help estimate time and plan work. This concerns the time scale and background, rather than labels inside entry cards.

### Candidate design

- Treat a day as the smallest calendar unit, with weeks, months, and years providing larger context.
- Show week separators at every Monday, seven days apart, with corresponding date labels.
- Give consecutive months alternating white and subtly darker backgrounds. Each month forms a proportional rectangular band covering its days.
- Place the month name inside the top-left corner of its band.
- Present the year separately; its location and treatment remain undecided.

This is one possible solution. Alternative designs are welcome if they provide clear month boundaries and a regular weekly rhythm.

### Initial design decisions

- Month bands and faint weekly separators extend through the timeline height, behind cards and geometry.
- The heading shows the visible year or year range; month names omit the year.
- Clipped month labels stay at the left of the visible band and disappear if the band is too narrow to fit them.
- Monday separators always remain weekly. Day-number labels thin at a regular, calendar-anchored stride when space is limited.
- The Today label sits below the axis, leaving the month and week label rows clear.

### Questions for future refinement

- How far should month backgrounds and week separators extend vertically?
- Where should the year appear, especially when the viewport crosses a year boundary?
- How should a partially visible month's name remain readable while scrolling?
- How should weekly labels behave when seven-day spacing is too narrow for readable text? Preserve the weekly rhythm even if label density must change.
- How should the scale, Today marker, interval rails, and connectors coexist without obscuring one another?

### Validation targets

- Preserve proportional calendar-day spacing and the stable axis position.
- Check 1-, 3-, and 6-month outlooks, narrow screens, and scrolling through partial months.
- Check unequal month lengths, leap February, and year boundaries.
- Check readability with approximately five overlapping entries and long titles.
- Test calendar boundary and separator calculations independently of the DOM; verify the visual result in a browser.

## Improvement backlog

Verified milestones:

- Month bands, weekly Monday separators, and year context; renderer separated from pure layout.
- Isolated browser regression harness with fixed dates, measured collisions, and desktop/mobile screenshots.
- Direct card completion and keyboard adding, date-ordered selection, editing, saving, outlook navigation, and help. Completion focuses a nearby visible card; shortcuts do not intercept typing.
- Plain-text descriptions and HTTP(S) links in the editor, optional category labels, and six named colors. Shared entry validation now lives separately from storage. Existing v2 records remain valid.
- Complete JSON download/upload, validated replacement, browser-save retry, and recovery that preserves malformed records. Native file opening/saving is implemented with tab-scoped handles and explicit saves; its write lifecycle is browser-tested with a mocked picker.

The following sequence is a starting point, not a fixed schedule. Time readability above is an explicit UX priority to consider alongside these items.

1. Establish a repeatable browser verification workflow with deterministic sample data, including add/edit/complete/reload, keyboard focus, and narrow screens.
2. JSON export/import and native file opening/repeated saving are implemented. Browser storage remains an automatic working copy. Files save explicitly; native OS picker permissions still need a manual check on the user's browser.
3. Add quick task completion without opening the editor, with predictable focus after hidden completed tasks disappear. Use separate edit and completion controls rather than nesting a checkbox in a button.
4. Keyboard minimum is implemented: N adds, J/K selects, Enter edits, X completes, 1/3/6 changes outlook, Page Up/Down navigates, T returns to today, and ? opens help. Ctrl/Cmd+Enter saves in the editor. Review these conventions after real use.
5. Descriptions and links are implemented in the editor. Structured checklists remain a possible later addition; plain text already supports informal lists.
6. Optional category labels and colors are implemented independently of event/task kind. Review the palette after real use.
7. Make small structural improvements as needed: separate rendering from geometry, document interfaces, and extract growing interaction responsibilities from app.js.
8. Date dragging is deliberately deferred until real use of the keyboard/editor workflow. The current drag gesture pans the timeline. A future prototype should use explicit handles and define interval movement before implementation.

## Decisions and remaining checks

- Keep native JavaScript modules; no framework, backend, or package installation is needed for the delivered features.
- Use JSON as the durable local format, with browser storage as an automatic working copy. No CSV or remote storage is needed yet.
- Keep keyboard conventions discoverable in the Keys dialog and avoid shortcuts in typing controls. Review conventions after actual use rather than adding more speculative commands.
- Keep descriptions plain text with HTTP(S) links. Structured checklists and richer text formatting remain optional future ideas.
- Manually verify real native file picker permissions and file overwriting; automated browser tests mock that OS boundary.
- Check real touch hardware and additional browser engines when available. Narrow-screen Chromium checks do not substitute for those checks.

## Development and agent workflow

- Agents implement and verify authorized changes and make focused milestone commits, as subsequently authorized by the user. Deployment remains outside the current scope.
- Discuss unspecified product interactions, storage ownership, and schema compatibility through concrete proposals.
- Report tests and browser checks performed, including checks that could not be run.
- Keep date arithmetic and layout calculations independently testable, and preserve legacy storage compatibility.
- Reconsider allowing agents to commit verified changes once browser checks and interaction conventions are established.
- Update AGENTS.md with the viewport module, product boundaries, and the browser verification workflow when that workflow exists.

## Longer-term architecture

Retain pure date, viewport, and layout calculations. As features require it, separate the entry schema from persistence, rendering from geometry, and editor/keyboard interactions from application coordination. Browser storage and local files can then share validation through separate persistence adapters.

Reconsider a framework if coordinating UI state becomes persistently difficult. Revisit other product features only when actual use demonstrates their value.
