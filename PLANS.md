# Project plans

Living record of ideas, decisions, delivered milestones, and remaining checks. The README describes current behavior; this document explains the direction and tracks future work.

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

### Original candidate design

- Treat a day as the smallest calendar unit, with weeks, months, and years providing larger context.
- Show week separators at every Monday, seven days apart, with corresponding date labels.
- Give consecutive months alternating white and subtly darker backgrounds. Each month forms a proportional rectangular band covering its days.
- Place the month name inside the top-left corner of its band.
- Present the year separately; its location was initially undecided.

The initial implementation follows this idea with the decisions below. Alternative designs remain welcome if they provide clear month boundaries and a regular weekly rhythm.

### Initial design decisions

- Month bands and faint weekly separators extend through the timeline height, behind cards and geometry.
- The heading shows the visible year or year range; month names omit the year.
- Clipped month labels stay at the left of the visible band and disappear if the band is too narrow to fit them.
- Monday separators always remain weekly. Day-number labels thin at a regular, calendar-anchored stride when space is limited.
- The Today label sits below the axis, leaving the month and week label rows clear.

### Questions for future refinement

- Are whole-height month bands helpful or too prominent in daily use?
- Is year context in the heading sufficient when scrolling across a year boundary?
- Is hiding nearly clipped month labels preferable to abbreviating them further?
- Is the regular weekly rhythm clear enough at six months on a small screen?
- Are the Today marker, interval rails, and connectors easy to follow with five overlaps?

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
- Complete JSON download/upload, validated replacement, browser-save retry, and recovery that preserves malformed records. Native file opening/saving is implemented with tab-scoped handles and explicit saves; its read/write lifecycle is tested with a real browser filesystem handle and mocked OS pickers.
- Additional interaction checks cover mouse panning from cards, focus through scrolling/resizing, upload/download fallback, Chromium-emulated touch scrolling, and completion focus in empty views.

### Delivery status

| Work | Status |
| --- | --- |
| Month separation and Monday weeks | Implemented and verified |
| Repeatable browser checks | Implemented; two isolated Playwright suites |
| JSON files and browser recovery | Implemented and verified; OS picker permission check remains manual |
| Direct task completion | Implemented with predictable focus |
| Keyboard minimum | Implemented with help: N, J/K, Enter, X, 1/3/6, Page Up/Down, T, ?, Ctrl/Cmd+Enter |
| Descriptions and links | Implemented in the editor |
| Categories and colors | Implemented independently of event/task kind |
| Structural improvements | Renderer, entry schema, keyboard resolution, and file interactions extracted into modules |

### Optional follow-ups after actual use

- Review the keyboard conventions, month/week presentation, and palette with real planning data.
- Date dragging is deliberately deferred. The current drag gesture pans the timeline; a future prototype should use explicit handles and define interval movement before implementation.
- Structured checklists remain optional; plain-text notes already support informal lists.
- Extract more editor/navigation coordination only if app.js becomes difficult to change reliably.
- Consider a standalone browser runner if running the existing MCP checks becomes inconvenient.

## Decisions and remaining checks

- Keep native JavaScript modules; no framework, backend, or package installation is needed for the delivered features.
- Use JSON as the durable local format, with browser storage as an automatic working copy. No CSV or remote storage is needed yet.
- Keep keyboard conventions discoverable in the Keys dialog and avoid shortcuts in typing controls. Review conventions after actual use rather than adding more speculative commands.
- Keep descriptions plain text with HTTP(S) links. Structured checklists and richer text formatting remain optional future ideas.
- Manually verify real native file picker permissions and file overwriting: open a temporary local JSON file, edit a deadline and notes, save, then reopen it and verify the contents. Automated tests exercise real browser filesystem streams but mock the OS picker boundary.
- Check real touch hardware and additional browser engines when available. Chromium-emulated touch and narrow-screen checks do not substitute for those checks.

## Development and agent workflow

- Agents implement and verify authorized changes and make focused milestone commits, as subsequently authorized by the user. Deployment remains outside the current scope.
- Discuss unspecified product interactions, storage ownership, and schema compatibility through concrete proposals.
- Report tests and browser checks performed, including checks that could not be run.
- Keep date arithmetic and layout calculations independently testable, and preserve legacy storage compatibility.
- Milestone commits are authorized for this implementation. Broader future autonomy can be revisited after actual use.
- AGENTS.md now documents the module map, product boundaries, storage/file invariants, and browser verification workflow.

## Longer-term architecture

Retain pure date, viewport, and layout calculations. The entry schema is now separate from persistence, rendering is separate from geometry, and keyboard resolution and file interactions have their own modules. Browser storage and local files share validation. Keep app.js as the coordinator and extract editor/navigation responsibilities as further features justify it.

Reconsider a framework if coordinating UI state becomes persistently difficult. Revisit other product features only when actual use demonstrates their value.
