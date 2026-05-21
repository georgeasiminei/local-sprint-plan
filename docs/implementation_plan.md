# Local Sprint Plan Implementation Plan

## Purpose

Build a local-only React planning app whose single active plan is owned by the browser URL hash. There is no backend, account system, database, JSON import/export flow, or multi-plan manager. Named `localStorage` saves exist only as explicit user-created snapshots.

## Current Architecture

- The app opens directly to one timeline editor and stores the plan in `location.hash`.
- Zustand keeps one runtime document for rendering, undo/redo, and scheduling.
- `src/persistence/shareUrl.js` stores compact source data only; generated weeks, sprints, computed schedule rows, timestamps, and long IDs are excluded.
- Weeks are generated from ISO week-year settings and labeled as `YY.WW`.
- Sprints are generated in fixed 2-week groups, with editable numbering from a chosen sprint onward.
- Timeline cells use fixed configurable row height / week width with clipped text and thin spreadsheet-style task row borders.
- External dependencies are deadline markers with notes and status, rendered as full-height timeline lines with editable note boxes in a lane below the table. Deadline weeks are edited as ISO labels such as `26.12`.

## Key Behaviors

- Empty URL creates a default URL-owned plan without adding a hash until the first meaningful edit; hash URLs load directly without an import prompt.
- The active plan name is visible in the top-left header and is part of the compact JSON/URL source state.
- Plan edits debounce `history.replaceState` updates.
- Week and task-completion boundaries use local calendar dates, matching the date-only ISO-week UI rather than treating those labels as UTC instants.
- `Save` and `Load` manage named manual snapshots in `localStorage`; saving always prompts for a name and updates the active plan name to match, and loading a named snapshot applies that saved name to the active plan.
- Task resource edits are source rules that apply from the edited week onward.
- Week resource edits live in the focused week panel. They apply from the selected week onward by default, with an "apply only to this week" checkbox for one-week changes.
- Task/category colors render only in scheduled cells with allocated resources.
- Working days default to 5 and are edited from the week panel. A four-day holiday week contributes `resourceCount * 4 / 5` capacity while leaving the raw total capacity row unchanged, and that productivity factor scales every task allocation/cap in the affected week.
- Vacation days are person-days edited from the week panel. Entire-plan vacation days reduce every task's weekly contribution, category vacation days reduce tasks in that category, and task vacation days reduce only the selected task.
- Past week edits require confirmation before mutation.
- Category edits live in the focused side panel; week capacity and vacation edits live in the focused week panel.
- External dependency note boxes stay inside the visible timeline edge by choosing the available side and narrowing when necessary.
- The timeline uses frozen category/task columns and compact task rows; category cells span their visible task rows like merged spreadsheet cells.
- Tasks created from a selected category inherit category and color.
- `Task`, `Category`, and `Dependency` open focused right-side panels with close and delete controls. New task/category starter names are selected immediately for overwrite. Dependency creation supports external deadline markers and internal task-to-task dependencies.
- Numeric entry uses plain edit boxes rather than browser steppers.
- Estimates and resource values are normalized to one decimal place.
- Task and category side panel headers expose discreet up/down icon controls for reordering the timeline list without cluttering the grid.
- Selecting a task, category, or dependency and pressing Delete removes it, with past-week confirmation when historical schedule/deadline data is affected.

## Compact URL State

- URL state uses a positional array schema with implicit IDs, numeric cross-references, palette-index colors, numeric dependency statuses, and omitted defaults.
- Plan vacation days, categories, category vacation days, tasks, task vacation days, dependencies, external dependencies, teams, working-day adjustments, week resources, and manual/resource overrides are preserved as source data.
- URL payloads use a single `d.` base64url deflate-raw format.
- The current compact URL format is the first shipped hash format. If that positional schema ever changes incompatibly, add explicit URL-format versioning and migration before emitting the new format; object-document migrations alone are not enough for old shared links.

## Verification

- Unit tests cover ISO week generation, compact URL round trips, scheduling, validation, and payload errors.
- Component tests cover hash loading/updating, clean root URLs, local snapshot save/load, focused panel behavior, category task defaults, external dependency persistence, cascading capacity, week-panel resource/vacation edits, and past-week confirmation.
- Run `npm run test` and `npm run build` before considering changes complete.
