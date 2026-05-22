# Local Sprint Plan — Detailed Requirements
## (Local-Only, Browser-Based, No Backend)

## 1. Overview

A web-based project timeline management tool that runs entirely in the browser. No server, no database, no accounts. A single plan lives entirely in the URL hash so it can be shared by copying the current browser URL.

**Target audience:** Small teams (< 20 users), low-to-medium usage, self-explanatory UI.  
**Deployment:** A single static HTML/JS/CSS bundle — open in latest Chrome or latest Microsoft Edge Chromium, no install required.

---

## 2. Tech Stack

### Frontend
- **Framework:** React (Vite) — produces a static build (`dist/`) that can be opened directly or served from any static host (Nginx, GitHub Pages, S3)
- **Styling:** Tailwind CSS
- **State management:** Zustand or React Context + useReducer
- **Persistence:** URL hash state updated with `history.replaceState` after edits, plus explicit named local snapshots on user request
- **Export:** CSV schedule export via native browser `Blob` download

### No Backend
- No server, no API, no database
- No authentication, no user accounts
- All logic (scheduling, dependency resolution) runs client-side in JavaScript

---

## 3. Data Model (runtime + compact URL JSON)

The app has one active plan. Runtime state uses a full document for rendering and scheduling, while the URL hash stores a compact source-only document. Generated weeks, sprints, computed schedule rows, timestamps, and long UUIDs are not persisted in the URL.

### 3.1 Root Structure
```json
{
  "version": "1.0",
  "plan": { ... },
  "categories": [ ... ],
  "tasks": [ ... ],
  "dependencies": [ ... ],
  "externalDependencies": [ ... ],
  "sprints": [ ... ],
  "weeks": [ ... ],
  "teams": [ ... ],
  "freedays": [ ... ],
  "weekResources": [ ... ],
  "schedule": [ ... ]
}
```

`sprints`, `weeks`, and non-manual `schedule` entries are generated from source inputs when the URL is loaded and after edits.

### 3.2 Plan
```json
{
  "id": "p1",
  "name": "My Project Plan",
  "description": "",
  "startYear": 2026,
  "startWeek": 12,
  "sprintStartNumber": 1,
  "sprintStartOrder": 1,
  "startingResourceCount": 5.0,
  "rowHeight": 19,
  "weekColumnWidth": 48,
  "showInternalDependencyLines": true,
  "vacations": [
    { "weekIndex": 21, "dayCount": 10 }
  ],
  "createdAt": "runtime ISO8601",
  "updatedAt": "runtime ISO8601"
}
```
Plan vacation days are person-days that reduce capacity across the whole plan for a week. Example: 10 vacation days means two people are away for one five-day week, reducing effective capacity by 2 resource-weeks. The reduction affects every task active in that week, similar to working-day adjustments.

### 3.3 Categories
Groups of tasks — displayed as collapsible section headers spanning all columns.
```json
{
  "id": "c1",
  "name": "OBI Integration",
  "order": 1,
  "color": "#FFFF99",
  "vacations": [
    { "weekIndex": 21, "dayCount": 5 }
  ]
}
```
Category vacation days are person-days. They reduce effective scheduling capacity for tasks in that category only and do not change the raw total capacity shown in the total effort row.

### 3.4 Tasks
```json
{
  "id": "t1",
  "categoryId": "category id | null",
  "name": "OBI: Start Integration",
  "priority": 10,              // lower = higher priority; drives scheduling order
  "estimateWeeks": 32.3,       // man-weeks; accepts one decimal place
  "calcWeeks": 32.2,           // system-computed (derived from resource allocation)
  "highlightColor": "#FFFF99", // optional per-task row color override
  "notes": "",
  "earliestStartWeek": null,   // integer week index constraint; null = no constraint
  "maxResources": null,         // max resources in any single week; accepts one decimal place; null = no limit
  "resourceOverrides": [
    { "weekIndex": 21, "allocatedUnits": 3.0 }
  ],
  "vacations": [
    { "weekIndex": 21, "dayCount": 2 }
  ],
  "completed": true,
  "completedIntervals": [
    { "startWeek": 21, "endWeek": 23, "allocatedUnits": 2.4, "rawAllocatedUnits": 3.0 }
  ]
}
```
Resource overrides are source rules. Setting a task cell to `x` resources at a week applies `x` from that week onward until another rule is set, and the scheduler regenerates the computed schedule from those rules.
Task vacation days are source rules. They are person-days that reduce only the selected task's contribution in that week.
Completed tasks are historical freezes. Once a task is completed, the app persists compact run-length-style `completedIntervals` for its actual effective history and, when different, the raw resource history. Completed rows still respect the raw/effective allocation view toggle and are not rescheduled later. If a timeline change makes the task future work again, the completion fields are removed so the URL stays compact.

### 3.5 Dependencies
```json
{
  "id": "d1",
  "predecessorType": "task | category",
  "predecessorId": "task or category id",
  "successorType": "task | category",
  "successorId": "task or category id",
  "lagWeeks": 0    // optional buffer (in weeks) after predecessor ends before successor can start
}
```

Category endpoints expand into task-level scheduling rules at runtime. A task waiting on a category waits for every task in that category; a category waiting on a task applies that wait to every task in the category; category-to-category dependencies apply both rules together.

### 3.6 External Dependencies
```json
{
  "id": "x1",
  "name": "Client test environment available",
  "dueWeek": 20,
  "status": "no",
  "notes": ""
}
```
External dependencies are not task-to-task constraints. They are deadline markers for expected outside inputs, approvals, environments, or vendor deliverables. Status cycles through `no` (default, red), `partial` (empty/neutral), and `yes` (green).

### 3.7 Sprints
```json
{
  "id": "sprint-1",
  "name": "Sprint 6",
  "startWeek": 13,   // week index (1-based within plan)
  "endWeek": 14,
  "order": 6,
  "number": 6
}
```
Sprints are generated in fixed two-week groups. Editing one sprint number updates that sprint and all following sprint numbers; previous sprint labels stay unchanged.

### 3.8 Weeks
```json
{
  "id": "week-12",
  "weekIndex": 12,
  "weekYear": 2026,
  "weekNumber": 12,
  "label": "26.12",
  "startDate": "2026-03-16",
  "endDate": "2026-03-22"
}
```
Weeks use ISO week-years. The label `26.12` means ISO week 12 of 2026.

### 3.9 Teams
```json
{
  "id": "team1",
  "name": "Dev Team"
}
```

### 3.10 Working Day Adjustments (per team)
```json
{
  "id": "f1",
  "teamId": "team id",
  "weekIndex": 12,
  "date": "2025-04-18",
  "reason": "Working day adjustment"
}
```
Working days default to 5. The runtime stores non-working day entries so a week with one national holiday has one entry and therefore 4 working days.

### 3.11 Week Resources (per team per week)
```json
{
  "id": "wr-team1-13",
  "teamId": "team id",
  "weekIndex": 13,
  "resourceCount": 13.0
}
```
Resource counts accept one decimal place.
> **Inheritance rule:** If no entry exists for a week, the resource count equals the previous week's value. The first week must always have an explicit entry.

### 3.12 Schedule (computed)
```json
{
  "taskId": "uuid",
  "weekIndex": 13,
  "allocatedUnits": 2.9,   // resources × effective working fraction used this week
  "rawAllocatedUnits": 3.0, // optional computed raw allocation before working-day/vacation reductions
  "isManual": false         // true = user pinned this cell; scheduler skips it
}
```

---

## 4. Scheduling Engine (client-side)

### 4.1 Core Rules
1. Tasks are sorted by `priority` (ascending — lower number = higher priority).
2. A task starts in the **first week** where:
   - Resources are available (remaining capacity > 0), AND
   - All predecessor tasks are fully completed, AND
   - `weekIndex >= earliestStartWeek` (if set)
3. **Resource inheritance:** Missing `weekResources` entry → inherit from previous week.
4. **Working days reduce working capacity:** `workingDayAdjustedCapacity = resourceCount × workingDays / 5`. A four-day week makes each resource count as `0.8` toward task estimates. This productivity factor applies to every activity in that week, including capped tasks and task resource rules; it is not applied only to whichever lower-priority task happens to receive the remaining capacity.
5. **Vacation person-days reduce capacity:** `effectiveCapacity = max(0, workingDayAdjustedCapacity − planVacationDays / 5 − categoryVacationDays / 5)`. Example: 4 resources and 10 plan vacation days gives 2 effective resources in that week. Example: 4 resources and 5 category vacation days gives 3 effective resources for that category in that week. Plan vacation applies to every task in the week, category vacation applies only to tasks in that category, and task vacation applies only to the selected task. Like working-day adjustments, plan and category scoped vacation also scale each affected task's weekly resource cap and task resource rules so the reduction is distributed across all affected activities rather than falling only on lower-priority work. Task vacation subtracts directly from only that task's effective allocation; for example, 2 allocated resources and 5 task vacation days produces 1 effective resource for that task in that week.
6. **Effective and raw allocations remain visible:** The timeline can show raw resource allocation or effective resource allocation. The total effort row displays effective allocation/resource allocation for each week.
7. **Resource cap per task:** In any given week, the resources allocated to a task cannot exceed `maxResources` after the week's working-day productivity factor is applied. If `maxResources` is null, the task can consume all available team capacity. This means a capped task may take more calendar weeks than a naive estimate suggests, as excess capacity is left unused for that task and remains available for lower-priority tasks in the same week.
8. **Task resource rules:** A task resource override applies from its `weekIndex` onward and limits that task's weekly allocation until the task completes or another override starts.
9. **`calcWeeks`** is updated after scheduling: `estimateWeeks / avgResourcesUsed`
10. **Manual overrides** (`isManual: true`) are locked — the engine distributes the remaining unscheduled portion of the task around them.
11. **Completed task history** is locked. Completed tasks reuse their saved compact resource intervals instead of being recalculated.

### 4.2 Recalculation Triggers
The schedule is fully recomputed (in-memory, synchronously) whenever:
- A task is added, removed, or edited (estimate, priority, earliestStartWeek)
- A task resource rule is added, removed, or edited
- A task is marked completed or restored to editable work
- A dependency is added or removed
- An external dependency marker is added, removed, or edited
- Resource count changes for any week
- Working days are changed for a week
- Plan vacation days are added, removed, or edited
- Category vacation days are added, removed, or edited
- Task vacation days are added, removed, or edited
- Sprint or week structure changes

Recalculation is fast (< 100ms for typical plans) and runs on every state change before re-render.

### 4.3 Shift / Delay Handling
- **Per-task constraint:** Set `earliestStartWeek` to prevent a task from starting before a given week (drag handle in UI or manual input).
- **Lag on dependency:** Add `lagWeeks > 0` to insert a buffer between predecessor end and successor start.
- **Task shift:** Select a task-week cell → Shift moves the remaining visible work from that cell onward to the right by whole or fractional weeks. This can create gaps inside the same task timeline; for example, shifting a 10-resource task by 1.5 weeks inserts one empty week before the selected cell, then schedules 5 resources in the next week before continuing at 10.

---

## 5. UI Requirements

### 5.1 Timeline Grid (main view)
> The timeline grid has two rendering layers: (1) an HTML table/CSS grid for task rows and data cells, and (2) an SVG overlay perfectly aligned on top of the grid for vertical line markers (dependency lines and today marker). The SVG overlay is position-absolute and pointer-events are set to none on lines so cell interaction is not blocked.

- **Frozen left columns:** Category | Task name | Est (man-weeks) stay fixed while week columns scroll horizontally.
- **Plan name:** The current plan name is visible in the top-left header.
- **Scrollable week area:** One column per ISO week, grouped under merged two-week sprint header rows. Horizontal scrolling moves week headers, task cells, total cells, and dependency lane content together.
- The timeline scrolls horizontally as far as generated tasks and external dependency markers require.
- On wide screens, the app uses the full available browser width before horizontal scrolling is needed.
- **Fixed compact cells:** Task rows use a configurable fixed pixel height (`plan.rowHeight`, default 19px) and week columns use a configurable fixed pixel width (`plan.weekColumnWidth`, default 48px). Text is clipped/truncated instead of wrapping so row heights stay consistent. Task-to-task separation uses thin spreadsheet-like borders; category separation remains visually stronger.
- Sprint headers span the correct number of week columns and expose editable sprint numbers.
- Each data cell shows either raw resource allocation or effective allocation for that task-week; empty if zero.
- **Resource allocation toggle:** A checkbox switches between resource allocation view and effective resource view. Effective resource view is read-only and includes working-day/vacation reductions. Resource allocation view is editable and shows the planned resource count before those reductions.
- **Editable cells:** In resource allocation view, single-click selects a task-week cell without changing plan data. Double-click opens one compact 2-by-2 cell editor with the value and cancel controls on top and Set/Unset below. Set creates or updates a resource rule from that week onward. Unset removes the resource rule at that week. Closing, clicking elsewhere, or canceling the editor does not write a value.
- **Row grouping:** Categories render as merged left-column cells spanning the visible task rows in that category, similar to merged spreadsheet cells. This avoids a separate category header row and keeps the table vertically compact.
- **Task color:** Category and/or task colors are applied only to task cells where resources are allocated, not to the full row. A task created while a category is selected inherits that category and color by default.
- **Today marker:** A thin blue vertical line spanning the full grid height is drawn at the current date's fractional position within the current ISO week, not snapped to a week boundary. The today marker updates automatically each time the app is opened. If the current date is outside the plan's week range, the marker is not shown.
- **Dependency markers:** Vertical lines drawn on the timeline grid at the week boundary where a dependency handoff occurs (i.e., the week column where the successor task is allowed to start). The line spans the full vertical height of the grid (all task rows). Each dependency line is color-coded or labeled and shows the compact relation `Predecessor → Successor` with lag when present. Multiple dependencies at the same week column are stacked/merged into one line with a combined tooltip. Dependency lines are rendered as an SVG overlay on top of the grid, not inside individual cells, and can be shown or hidden from plan settings.
- **Week panel access:** Clicking a week header or a total-effort cell opens the focused week panel for that ISO week.
- **Total effort row:** Displayed below task rows. Each week shows `x/y`, where `x` is calculated effective effort for that week and `y` is raw resource allocation for that week.
- **External dependency markers:** Expected external inputs are rendered as full-height deadline lines on the border after the due week. These lines use red/neutral/green status colors and are visually distinct from the thin blue today line. Free-text boxes are displayed in a dedicated dependency lane below the task table so they do not cover schedule cells. Where space allows, same-week dependency boxes are centered on the deadline line and stack vertically; near edges they may fall to the available side / shrink as needed instead of escaping the scrollable timeline. Compact boxes may truncate long text, with the full note shown on hover.
- **Category totals:** The merged category cell shows compact category summary values; task-week resource totals remain visible in task cells and the total effort row.
- **Compact toolbar:** The timeline has one compact top toolbar with `Task`, `Category`, `Dependency`, shift, split, CSV export, `Save`, `Load`, `Backup/restore`, and settings actions. Save/load tooltips clarify that they use local storage, Shift explains that it moves remaining work from the selected cell, Effective resources explains the adjusted/read-only view, and the header links back to the original GitHub repository.
- **Task split:** Select a task-week cell → Split creates a second task starting at that cell. The selected cell becomes the first week of the new task. The new task keeps the original task's category, priority placement, color, max resources, notes, and other task settings, while the original task keeps the work before the split.
- **Reordering:** Task and category side panel headers expose discreet move-up/move-down icon controls. Reordering tasks updates their priority/order in the list; reordering categories updates category order. The timeline grid itself stays free of persistent reorder controls.
- **Focused side panel:** Clicking a task, category, dependency box, or add action opens a small right-side panel only for that item type. The panel has an `X` close control and a delete action.
- **Keyboard delete:** With a task, category, or dependency selected, Delete removes it. If the deletion affects historical schedule/deadline data, the past-week confirmation appears before mutation.
- **Past-week warning:** Mutating week-scoped values for weeks whose `endDate` is before today opens a confirmation modal before applying changes.
- **Completed task styling:** Completed tasks remain visible in the grid with a subtle italic task label and a small check icon, so frozen historical work is recognizable without opening the side panel.

### 5.2 Task Detail Side Panel
- Opens on row click
- Can be closed to maximize horizontal timeline space
- Fields: name, category, priority, estimate (one decimal), notes, highlight color, earliestStartWeek, maxResources (one-decimal numeric input; empty = no limit), plus a `Completed` checkbox whenever the task is historical or currently in its final execution week
- Dependencies list (incoming + outgoing) with add/remove controls
- Per-week allocation table (override individual weeks)
- Marking a task completed freezes its historical resource intervals. Tasks older than three weeks are auto-completed on load; if a timeframe change moves them back into the future, the completion control and frozen data are removed.

### 5.3 Plan Settings Panel
- **Timeline start:** Edit ISO start year and ISO start week.
- **Row height:** Edit fixed timeline row height in pixels.
- **Week width:** Edit fixed timeline week-column width in pixels.
- **Internal dependency lines:** Toggle whether internal dependency handoff markers are drawn on the timeline.

### 5.4 Week Detail Panel
- Opens when clicking a week header or total-effort cell.
- **Resources:** Edit raw team resources for the selected week. By default the new value applies from that week through all following weeks until changed again.
- **Typed resource entry:** Resource edits use typed text entry committed on blur or Enter, so a historical change prompts once for the completed value instead of once per spinner increment.
- **Apply only to this week:** Optional checkbox that writes the resource change only for the selected week and restores the previous inherited value in the following week.
- **Working days:** Defaults to 5. Set to 4 for a week with one national holiday. This reduces every resource's contribution for the selected week while raw capacity still displays unchanged.
- **Vacation day scope:** Add one or more vacation entries for the week. Each entry chooses the entire plan, a category, or a task.
- **Vacation days:** Person-days of absence. Multiple scoped entries can coexist in the same week, such as 10 days for one category plus 3 days for one task and 2 days for another task. Entire-plan vacation days reduce every task's contribution; category vacation days reduce only tasks in the selected category; task vacation days reduce only the selected task.

### 5.5 Dependency Manager
- Adding a dependency first asks whether it is an external deadline marker or an internal task-to-task dependency.
- Table of all dependencies: Predecessor → Successor, Lag
- Add new dependency using clearly separated task/category selectors for both predecessor and successor endpoints
- Remove existing dependency
- Add, edit, move, and remove external dependency deadline markers by ISO due week label such as `26.12`.
- External dependency status cycles through No, Partially, and Yes via a checkbox-style control.
- Circular dependency detection: warn and block if a cycle would be created
- Task and category rows expose a compact internal-dependency indicator; clicking it opens the right panel list for that item so internal dependencies can be reviewed and edited after creation

### 5.6 Shift Task Modal
- Trigger: click a task row to select it → "Shift" button
- Input: shift by N weeks (positive = delay, negative = accelerate)
- Preview: shows before/after start week for each affected task
- Confirm / Cancel

### 5.7 URL-Owned Plan And Local Snapshots
- The app opens directly into the single active plan.
- If `location.hash` contains a payload, decode it into the active plan.
- If no hash exists, create a default plan without adding a hash until the first meaningful edit.
- Every meaningful edit updates the hash with `history.replaceState` after a short debounce.
- The active plan remains URL-owned even when local snapshots exist.
- `Save` always prompts for a snapshot name, prefilled with the current plan name. Saving with the current saved snapshot name updates that snapshot. Changing the submitted name behaves like Save as: it creates a new local snapshot, keeps the previous saved snapshot, and makes the submitted name the active plan name.
- `Load` lists named plans stored in browser `localStorage` and replaces the active plan after selection.
- `Backup/restore` can download one JSON backup containing all locally saved named plans and restore that backup later. Restore warns that it overwrites every locally saved plan in the current browser; restored plans then appear in `Load`.
- New task/category starter names and the default local-save name are selected on focus so typing replaces them immediately.

### 5.8 URL State Indicator
- Visual indicator: "updating url", "url updated", or "url error" in the top bar.
- Local snapshot actions are explicit backup/checkpoint commands; they do not replace live URL updates.

---

## 6. URL Encoding and CSV Export

### 6.1 URL Payload
- URL format: `https://app/#<payload>`.
- Payload format: `d.<base64url(deflate-raw(JSON bytes))>`.
- Everything after the first `#` is treated as the payload; no key prefix such as `p=` is used.
- Store only source data needed to reconstruct the plan: plan settings and plan vacation days, categories and category vacation days, tasks and task vacation days, dependencies, external dependencies, teams, resource overrides, compact completed-task intervals, working-day adjustments, week resources, and manual allocation overrides.
- The compact payload includes the plan name so exported JSON and copied URLs reopen with the same plan name.
- The compact document is a positional array schema, not a human-readable object schema. It uses implicit IDs from row order, numeric cross-references, palette indexes for built-in colors, numeric external-dependency status codes, and omitted defaults.
- Do not store generated weeks, generated sprints, computed schedule rows, timestamps, or long UUIDs.
- Runtime short IDs such as `p1`, `c1`, `t1`, `d1`, and `team1` are regenerated from row order on load rather than persisted in the URL.
- The encoder always picks the shortest valid payload representation.

### 6.2 CSV Export
- CSV export is available for reviewing schedules outside the app.
- CSV export does not affect saved state because the URL remains the source of truth.

---

## 7. Keyboard & UX Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + Z` | Undo last change |
| `Ctrl/Cmd + Shift + Z` | Redo |
| `Escape` | Close side panel / modal |
| `Tab` / `Shift+Tab` | Navigate cells in grid |
| `Enter` | Confirm inline edit |
| `Delete` / `Backspace` | Delete selected task, category, or dependency |

**Undo/Redo:** Maintained as an in-memory action stack (command pattern); does not persist across page reloads.

---

## 8. Non-Functional Requirements

- **Performance:** Full schedule recalculation < 100ms for plans up to 150 tasks × 52 weeks in a modern browser
- **Bundle size:** Target < 500KB gzipped for fast initial load
- **Offline-first:** Fully functional with no internet connection after initial page load
- **Browser support:** Latest Chrome and latest Microsoft Edge Chromium
- **Responsive:** Usable on laptop/desktop screens (1280px+ width); mobile is out of scope
- **No telemetry:** Zero network requests during normal use; no analytics, no error reporting services

---

## 9. Future / Stretch Goals

- Gantt view (horizontal bar per task, color-coded by category)
- Baseline snapshot: save original plan state and visually diff current vs. baseline
- Excel/XLSX import (parse `.xlsx` into the data model) and export
- Print-optimized CSS layout for the timeline grid
- Multi-plan comparison view
- Dark mode

---

## 10. Out of Scope (v1)

- Any backend, server, or database
- User accounts or access control
- Real-time collaboration
- Mobile / tablet layout
- Integration with Jira, GitHub, or other PM tools
- Notifications or reminders
