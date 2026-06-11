# Local Sprint Plan Implementation Plan

## Purpose

Build and maintain a live local-only React planning app whose single active plan is owned by the browser URL hash. There is no backend, account system, database, JSON import/export flow, or multi-plan manager. Named `localStorage` saves exist only as explicit user-created snapshots. Because the project is live, compatibility for existing shared URLs and established workflows is a first-class requirement unless a breaking change is explicitly approved and documented with migration steps.

## Current Architecture

- The app opens directly to one timeline editor and stores the plan in `location.hash`.
- Zustand keeps one runtime document for rendering, undo/redo, and scheduling.
- `src/persistence/shareUrl.js` stores compact source data only; generated weeks, sprints, computed schedule rows, timestamps, and long IDs are excluded.
- Weeks are generated from ISO-style planning week-year settings and labeled as `YY.WW`. The planning calendar always uses 52 numbered weeks per year, so `xx.52` rolls to `<xx+1>.01` and week 53 is never emitted.
- Sprints are generated in fixed 2-week groups, with editable numbering from a chosen sprint onward.
- Timeline cells use fixed configurable row height / week width with clipped text and thin spreadsheet-style task row borders.
- Week header and total-effort tooltips are generated locally from each week `startDate`. They show the Monday-Friday date range and quarter, including split-quarter labels such as `Q2/Q3`, with no external calendar requests or runtime data transmission.
- `View starting week` is a render-only old-column cutoff. It accepts an absolute planning week label such as `26.21` or a relative number such as `5`, meaning current week plus five earlier weeks. The cutoff is snapped backward to the containing sprint start so visible sprint headers remain whole.
- External dependencies are deadline markers with notes and status, rendered as thin full-height timeline lines with editable note boxes in a lane below the table. Deadline weeks are edited as planning labels such as `26.12`. Incomplete past-due markers are red, incomplete future markers are dark grey, partial markers are yellow, and completed markers are green.

## Key Behaviors

- Empty URL creates a default URL-owned plan without adding a hash until the first meaningful edit; hash URLs load directly without an import prompt.
- The active plan name is visible in the top-left header and is part of the compact JSON/URL source state.
- Plan edits debounce `history.replaceState` updates.
- Week and task-completion boundaries use local calendar dates, matching the date-only planning-week UI rather than treating those labels as UTC instants.
- View-window filtering is applied only to timeline rendering. It must not mutate generated weeks, scheduling inputs, task resource rules, external dependency due weeks, manual allocations, or exported schedule data.
- `Save` and `Load` manage named manual snapshots in `localStorage`; saving always prompts for a name, updates the current saved snapshot when the name is unchanged, creates a new snapshot when the name changes, and applies the submitted name to the active plan. Loading a named snapshot applies that saved name to the active plan.
- Task resource edits are source rules that apply from the edited week onward.
- Task cells are selection-only on single click. Double-click opens one compact 2-by-2 Set/Unset/cancel editor so blur, clicking elsewhere, or accidental selection cannot create a resource override.
- Shift works from the selected task-week cell. It freezes the current task allocation as manual rows, stores a reversible shift rule containing the original remaining work, then moves the selected cell and later work to the right by whole or fractional weeks, allowing gaps inside a task timeline. The first shifted week is marked; selecting it opens Shift in edit/delete mode.
- Split works from the selected task-week cell. It creates a second task with the same settings and moves the selected cell and later work to that new task.
- Week resource edits live in the focused week panel. They apply from the selected week onward by default, with an "apply only to this week" checkbox for one-week changes.
- Task/category colors render only in scheduled cells with allocated resources.
- Working days default to 5 and are edited from the week panel. A four-day holiday week contributes `resourceCount * 4 / 5` capacity while leaving the raw total capacity row unchanged, and that productivity factor scales every task allocation/cap in the affected week.
- Vacation days are person-days edited from the week panel. A week can contain multiple scoped vacation entries at once. Entire-plan vacation days reduce every task's weekly contribution, category vacation days reduce tasks in that category, and task vacation days reduce only the selected task. Task-scoped vacation subtracts from that task's effective resources, so 2 raw resources with 5 task vacation days displays as 1 effective resource.
- Past week edits require confirmation before mutation.
- Category edits live in the focused side panel; week capacity and vacation edits live in the focused week panel.
- External dependency note boxes stay inside the visible timeline edge by choosing the available side and narrowing when necessary.
- The timeline uses frozen category/task columns and compact task rows; category cells span their visible task rows like merged spreadsheet cells.
- Tasks created from a selected category inherit category and color.
- `Task`, `Category`, and `Dependency` open focused right-side panels with close and delete controls. New task/category starter names are selected immediately for overwrite. Dependency creation supports external deadline markers and internal dependencies from task, category, or external dependency predecessors to task/category successors.
- Numeric entry uses plain edit boxes rather than browser steppers.
- Estimates and resource values are normalized to one decimal place.
- The timeline has a checkbox to switch between editable resource allocation view and read-only effective resource view. The total effort row shows effective allocation/resource allocation.
- Computed schedule rows carry effective allocation plus raw allocation when those differ, so raw totals stay stable at full capacity even when effective allocations are rounded. Completed task intervals preserve the same raw/effective distinction and continue to respect the view toggle.
- Task and category side panel headers expose discreet up/down icon controls for reordering the timeline list without cluttering the grid.
- Selecting a task, category, or dependency and pressing Delete removes it, with past-week confirmation when historical schedule/deadline data is affected.

## Compact URL State

- URL state uses a positional array schema with implicit IDs, numeric cross-references for task/category dependency endpoints, string tokens for external dependency predecessor endpoints, palette-index colors, numeric dependency statuses, and omitted defaults.
- Plan vacation days, categories, category vacation days, tasks, task vacation days, dependencies, external dependencies, teams, working-day adjustments, week resources, and manual/resource overrides are preserved as source data.
- URL payloads use a single `d.` base64url deflate-raw format.
- The current compact URL format is the first shipped hash format. If that positional schema ever changes incompatibly, add explicit URL-format versioning and migration before emitting the new format; object-document migrations alone are not enough for old shared links.
- Keep Markdown documents current when behavior changes, especially the requirements, README, and this implementation plan.

## Verification

- Unit tests cover planning week generation, compact URL round trips, scheduling, validation, and payload errors.
- Component tests cover hash loading/updating, clean root URLs, local snapshot save/load, focused panel behavior, category task defaults, external dependency persistence, cascading capacity, week-panel resource/vacation edits, and past-week confirmation.
- Run `npm run test` and `npm run build` before considering changes complete.
