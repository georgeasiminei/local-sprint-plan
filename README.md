# Local Sprint Plan

A local-only project timeline planner built with React, Vite, Tailwind CSS, and Zustand.

The app is designed to run entirely in the browser. It has no backend, no accounts, no database, and no telemetry. The active plan is stored entirely in the URL hash, so copying the browser URL copies the plan.

## Setup

```powershell
npm install
npm run dev
```

## Scripts

```powershell
npm run dev       # Start the local Vite dev server
npm run build     # Create the static production build in dist/
npm run preview   # Preview the production build
npm test          # Run the test suite once
npm run test:watch
```

## Data Storage

The URL hash is the active saved state. Manual `Save` and `Load` actions keep named local snapshots in `localStorage` when the user explicitly asks for them. `Backup/restore` downloads or restores the full local snapshot library in one JSON file.

The hash stores a compact source-only document and the app regenerates ISO weeks, sprints, and computed schedule rows in memory.

Task cell edits are saved as compact resource rules: setting a task to `x` resources in a week applies `x` from that week onward until another rule is added.
Completed historical tasks store only compact frozen resource intervals, so old schedule history stays stable without bloating the URL.

## Export

- Copy the current browser URL to share or preserve the current active plan.
- Use local snapshots when you want named browser-local checkpoints.
- CSV export downloads the computed schedule for review in spreadsheet tools.

## Planning Details

- Weeks are ISO week-year columns labeled `YY.WW`.
- Category and task columns stay frozen while the week columns scroll horizontally.
- Categories render as merged cells spanning their task rows to keep the table vertically compact.
- Task/category colors appear only on weeks where the task has allocated resources.
- Today is shown as a thin blue line positioned within the current week, while external dependency deadline lines keep their status colors on week borders.
- External dependencies are full-height deadline lines; their editable text boxes sit in a dependency lane below the table, and due weeks use ISO labels such as `26.12`.
- Rows and week columns use fixed configurable pixel sizes with clipped text so the grid stays compact and spreadsheet-like.
- The total effort row shows assigned/capacity per week. Click a week header or total-effort cell to edit week resources, working days, and vacation days in the week panel.
- Week resource edits apply to that week and following weeks by default; the week panel can limit the change to only the selected week.
- Working days default to 5; set 4 for a week with one national holiday.
- Working-day reductions apply to every scheduled task in that week. A one-day team holiday makes each task's resource contribution 80% for that week.
- Vacation days are person-days. They can apply to the entire plan or to a selected category; 10 vacation days equals two people away for one five-day week.
- Estimates and resource counts accept one decimal place, for example `12.7` man-weeks or `2.5` resources.
- Tasks and categories can be moved up or down with small arrow controls in their focused side panel headers.
- Editing a past week asks for confirmation before changing historical plan data.
- Tasks in the past, or already in their final execution week, can be marked completed. Very old tasks are completed automatically on load, and their frozen history is removed again if the timeline is moved back into the future. Completed tasks show a subtle italic label plus a check icon in the grid.
- Selecting a category before adding a task makes the task inherit that category and color.
- `Task`, `Category`, and `Dependency` open small focused side panels. New task/category names are preselected so typing replaces the starter text immediately. Dependency creation supports external deadlines and internal task-to-task dependencies.
- Numeric fields use plain edit boxes rather than browser increment controls.
- Pressing Delete with a task, category, or dependency selected deletes it; historical changes ask for confirmation first.
- Shift bulk-moves checked tasks by a chosen number of weeks by changing their earliest-start constraint. Positive values delay selected tasks; negative values pull them earlier.

## Development Notes

- Keep scheduling logic pure and separate from React components.
- Keep generated build output out of version control.
- Add schema migrations whenever a breaking document shape change is introduced.

## License

MIT. See [LICENSE](LICENSE).
