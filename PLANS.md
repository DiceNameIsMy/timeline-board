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

The following sequence is a starting point, not a fixed schedule. Time readability above is an explicit UX priority to consider alongside these items.

1. Establish a repeatable browser verification workflow with deterministic sample data, including add/edit/complete/reload, keyboard focus, and narrow screens.
2. Add versioned JSON export/import with whole-file validation and explicit replacement. Preserve current data if import fails. Consider opening and repeatedly saving a local file afterward.
3. Add quick task completion without opening the editor, with predictable focus after hidden completed tasks disappear. Use separate edit and completion controls rather than nesting a checkbox in a button.
4. Add keyboard actions for creating entries, selecting and opening entries for editing, and changing the outlook. Exact shortcuts remain to be designed.
5. Add item descriptions with arbitrary text and links, shown in the details/editor. Checklists are a possible later addition.
6. Add optional category labels and colors for distinctions such as exams, projects, and goals. Keep category separate from event/task kind.
7. Make small structural improvements as needed: separate rendering from geometry, document interfaces, and extract growing interaction responsibilities from app.js.
8. Explore dragging to change dates. Resolve conflicts with timeline panning and define whether moving a task finish shifts its planned start or moving an event shifts its whole interval.

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
