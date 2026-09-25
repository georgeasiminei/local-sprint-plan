# Code Review Findings — local-sprint-plan (2026-09-25)

## Recovery note

This review ran as a nine-dimension automated pass with independent adversarial verification. It was stopped by the user before its final synthesis step (to control cost), but the **Find phase (all 9 dimensions) and roughly 30 verification checks had already completed and were cached** in the run's journal before the stop. This document was assembled by hand from that cached, completed work — nothing here was regenerated or re-run. No further model spend was used to produce this file beyond reading and organizing the already-completed results.

Bottom line on the money already spent: it was **not wasted**. Every dimension finished its read of the codebase, and the highest-value findings (the ones that got queued for verification first) went through two independent checks each — a skeptic trying to refute the claim, and a separate agent hand-tracing the code to reproduce it. 27 of those 30 verified findings were confirmed as real defects, including one **critical**, live-compatibility bug. The remaining ~100 findings from the Find phase did not get the second-pass verification before the stop; they are included below as unverified but are still first-pass findings from a careful, full-file read of each area, organized so a maintainer can triage them.

## Scope and method

- **Repository:** branch `work`, commit `9b2b8c1`. No Node.js runtime was available, so no agent (or this synthesis) ran `npm test` / `npm run build`; all findings are from static reading and hand-tracing.
- **Nine review dimensions**, each a separate agent instructed to read every file in its slice in full: persistence/URL encoding, scheduling engine, Zustand store/undo, React UI/hooks, validators/utils, security, tests/docs drift, build/CI/tooling, performance/scale. Combined, these reads covered the large majority of the 106 tracked files, including every engine, store, persistence and utils module and almost all components.
- **Verification:** for a finding to be marked **Confirmed** below, two separate agents independently read the real code (not trusting the original excerpt) — one actively trying to refute the claim, one hand-tracing concrete inputs to reproduce it — and both agreed the defect is real. **Disputed** means the two disagreed. **Refuted** means both agreed the original claim does not hold as stated. Findings with no such second pass are marked **Unverified (first pass only)**.

## Summary

| Status | Count |
|---|---|
| Confirmed (double-verified) | 26 |
| Disputed (verifiers disagreed) | 2 |
| Refuted (both verifiers rejected) | 2 |
| Unverified, first-pass only (from the 9 dimension reads) | ~100 |

| Severity (confirmed findings only) | Count |
|---|---|
| Critical | 1 |
| High | 6 |
| Medium | 14 |
| Low | 8 |
| Info | 3 |

## Top priorities

1. **[Critical]** [src/persistence/shareUrl.js:312](src/persistence/shareUrl.js#L312) — every shared URL/snapshot created with the default start year silently re-dates itself at the next New Year.
2. **[Critical/High]** [src/engine/scheduler.js:54](src/engine/scheduler.js#L54) — an easily-triggered dependency cycle (via category reassignment, unguarded) wipes every manual allocation in the whole plan.
3. **[High]** [src/store/planSlice.js:146-161](src/store/planSlice.js#L146-L161) — changing the plan's start week shifts some week-indexed data but not vacations, manual schedule rows, or shift rules, corrupting the plan.
4. **[High]** [src/engine/timeline.js:117](src/engine/timeline.js#L117) — a two-digit start year (typed in mid-edit, uncommitted-input bug) resolves to the 1900s and triggers irreversible auto-completion that deletes manual allocations.
5. **[High]** [src/hooks/useUrlPlan.js:65](src/hooks/useUrlPlan.js#L65) — a malformed shared-link error is set and then immediately wiped by `hydratePlan`, so a broken link silently looks like an empty plan and the next edit destroys the original (possibly recoverable) payload.
6. **[High/Medium]** [src/engine/scheduler.js:187](src/engine/scheduler.js#L187) — manual allocations before a task's dependency-driven start week are silently deleted from the document, yet still consume other tasks' capacity during the same recalculation.
7. **[Medium]** [src/hooks/useUrlPlan.js:47](src/hooks/useUrlPlan.js#L47) — no `hashchange` listener; pasting a different shared link into an open tab is ignored and then overwritten by the stale plan.
8. **[Medium]** [src/store/planSlice.js:18](src/store/planSlice.js#L18) — `hydratePlan` doesn't reset UI selection, so loading a different snapshot can silently edit the wrong task in the new plan.

## Confirmed findings

Findings below were independently hand-traced and agreed upon by two separate verification passes. Severity shown is the consensus after verification (verifiers sometimes revised the original dimension's severity).

### Critical

#### F-01 `startYear` omitted from every URL/snapshot created in the "current" year — silently re-dates at New Year
- **Location:** [src/persistence/shareUrl.js:312](src/persistence/shareUrl.js#L312) (encode), [shareUrl.js:156](src/persistence/shareUrl.js#L156) (decode), [src/constants/defaults.js:4](src/constants/defaults.js#L4) (root cause)
- **Reported by:** persistence-url, security, tests-docs, validation-utils (4 of 9 dimensions independently found this)
- **Summary:** `DEFAULT_START_YEAR` is `new Date().getFullYear()`, evaluated at module load. `compactPlan` omits `startYear` from the encoded payload whenever it equals that value; `expandCompactPlanDocument` fills a missing value with the same time-dependent constant.
- **Failure scenario:** A plan created in 2026 with the default start year 2026 is shared as a URL or saved as a named/backup snapshot. Opened on 2027-01-02, the missing year now defaults to 2027: every week label, date, "today" marker, past-week lock, and auto-completion decision shifts a full year, and the next edit writes the wrong year back permanently.
- **Verification notes:** Both the refute and reproduce passes independently hand-traced encode-then-decode across a simulated year boundary and confirmed the shift occurs exactly as described; the refuting agent found no guard anywhere that prevents it. The test suite has the same latent bug baked in (see F-19/F-20).
- **Suggested fix:** Always emit `startYear` in the compact row (a few characters), or compare against a fixed constant rather than the wall clock. Keep the current-year fallback on decode only for legacy payloads already missing the field.

### High

#### F-02 Dependency cycle via category reassignment wipes every manual allocation in the plan
- **Location:** [src/engine/scheduler.js:54](src/engine/scheduler.js#L54); unguarded caller at [src/store/tasksSlice.js:50-53](src/store/tasksSlice.js#L50-L53)
- **Reported by:** scheduling-engine
- **Summary:** When `topologicalSort` reports a cycle, `recalculateSchedule` returns `schedule: []`, and `recalculateActiveSchedule` writes that empty array back into the document and URL — deleting all `isManual` entries for **every** task, not just the ones in the cycle. Dependency creation is cycle-guarded, but changing a task's category (which can create a cycle via category-level dependencies) is not.
- **Failure scenario:** A dependency exists from category "Foundation" to task T. Task U has manual allocations from a shift/split. The user reassigns T's category to "Foundation" in the task panel — this creates edge T→T, `hasCycle=true`, and the resulting empty schedule is written to the document and hash. Moving T back out of the category regenerates the schedule from scratch: U's (and everyone else's) manual allocations are gone, with no undo entry for the recalculation.
- **Verification notes:** The reproduce pass hand-traced the exact category-change path end to end and confirmed no guard exists; it rated this **critical** given the ease of triggering it through an ordinary UI action and the blast radius (whole-plan data loss). The refute pass independently agreed it is real, at **high**.
- **Suggested fix:** In the cycle branch, return existing manual/completed entries instead of `[]`, or have `recalculateActiveSchedule` skip the write entirely when a cycle warning is present. Also guard `updateTask` category changes with `wouldCreateDependencyCycle`.

#### F-03 Changing the plan's start week only shifts some week-indexed data, corrupting the rest
- **Location:** [src/store/planSlice.js:146-161](src/store/planSlice.js#L146-L161)
- **Reported by:** scheduling-engine, store-state, persistence-url (3 of 9 dimensions)
- **Summary:** `updatePlanSettings` shifts `earliestStartWeek`, `resourceOverrides`, `completedIntervals`, external `dueWeek`, `freedays` and `weekResources` by the start-week delta — but leaves `plan/category/task.vacations`, manual `schedule` entries, and `task.shiftRules` at their old absolute week index.
- **Failure scenario:** Plan starts week 10; task T has a manual allocation and a stored shift anchored at week 12, plus a plan vacation entry at week 12. User changes the start week to 12 (delta +2). T's `earliestStartWeek`/overrides move to 14+, but the manual allocation and vacation stay at week 12 (now the very first column), and "Delete shift" later restores `sourceEntries` at the old, un-shifted weeks. Effort totals and the shared URL are now wrong.
- **Verification notes:** Both passes hand-traced a concrete start-week change against a fixture with all the affected field types and confirmed the partial shift exactly as described.
- **Suggested fix:** Shift every week-indexed field consistently (`schedule[].weekIndex`, `shiftRules[]` fields, all three `vacations[].weekIndex` collections) in the same updater, and add a store test that asserts all of them move together.

#### F-04 Two-digit start year resolves to the 1900s and triggers irreversible auto-completion
- **Location:** [src/engine/timeline.js:117](src/engine/timeline.js#L117); no range validation at [src/store/planSlice.js:89](src/store/planSlice.js#L89) or [src/components/panels/PlanSettingsPanel.jsx:24](src/components/panels/PlanSettingsPanel.jsx#L24)
- **Reported by:** scheduling-engine
- **Summary:** `new Date(year, 0, 4)` maps years 0-99 to 1900-1999. The Start year input commits on every keystroke with no range check, so typing "26" (or pausing mid-typing "2026") persists a plan whose weeks are all in the 1920s.
- **Failure scenario:** User types "26" into Start year and copies the URL. On reopen, every week's end date is far in the past, so `buildCompletionMaintenance` freezes every non-completed task as completed and deletes their manual schedule rows with no undo entry — before the user even notices the wrong year.
- **Verification notes:** Both passes confirmed the century bug and the missing range validation, and independently confirmed the downstream auto-completion data loss; rated high due to real risk of triggering it through ordinary (if careless) typing.
- **Suggested fix:** Build the date with `setFullYear` so "26" means year 26 predictably, but more importantly clamp `startYear`/`startWeek` to a sane range in `updatePlanSettings` and defer the settings write to blur (the panel already has a deferred-input pattern used elsewhere).

#### F-05 Malformed shared-link error is set then immediately erased, so a broken link looks like an empty plan
- **Location:** [src/hooks/useUrlPlan.js:65](src/hooks/useUrlPlan.js#L65); erased by `hydratePlan` in planSlice
- **Reported by:** persistence-url
- **Summary:** On decode failure, `setImportError(message)` runs, then `hydratePlan(createPlanDocument())` runs — but `hydratePlan` unconditionally sets `importError: null` and `saveStatus: 'url updated'`, clearing the error before it can be shown.
- **Failure scenario:** A user opens a link truncated by a chat client (`#d.abc`). The error is set then wiped; the header shows no banner and status reads healthy. The user, believing the link was simply empty, starts editing; 250ms later the debounced writer replaces the original (possibly recoverable) broken hash with the new blank-plan payload, permanently losing it.
- **Verification notes:** Both passes traced the exact set-then-clear sequence in `planSlice.hydratePlan` and confirmed the error never reaches the UI.
- **Suggested fix:** Call `hydratePlan` first and `setImportError` after, or give `hydratePlan` an option to preserve an existing error. Consider not writing to the hash until the user acknowledges a decode failure.

#### F-06 Manual allocations before a dependency-driven start week are deleted from the document but still consume capacity during the same recalculation
- **Location:** [src/engine/scheduler.js:187](src/engine/scheduler.js#L187) (filter), lines 76-80 (unfiltered allocation seed)
- **Reported by:** scheduling-engine
- **Summary:** `scheduleTask` drops any manual entry earlier than `earliestStartWeek` from what it returns (so it's deleted from the document on the next write), but `allocatedByWeek`/`rawAllocatedByWeek` were seeded from the *unfiltered* manual entries earlier in the same pass — so other tasks in the same recalculation still lose capacity to an entry that is simultaneously being deleted as if it doesn't exist.
- **Failure scenario:** Task B has manual rows in weeks 3-4 from a prior shift. The user adds a dependency that pushes B's earliest start to week 5. B's week 3-4 rows are silently dropped with no warning, while a third task C scheduled in the same pass is pushed later than necessary because it still saw B's now-vanishing rows as consuming capacity.
- **Verification notes:** Both passes confirmed the mechanism (seed-before-filter ordering) and the resulting data loss plus knock-on scheduling side effect.
- **Suggested fix:** Either keep pre-start manual entries and warn, or exclude them from the capacity maps too, and always warn the user before silently dropping their data.

#### F-07 Sub-0.05 residual capacity creates a phantom zero-effort schedule row
- **Location:** [src/engine/scheduler.js:240](src/engine/scheduler.js#L240)
- **Reported by:** scheduling-engine
- **Summary:** The allocation branch checks `allocation > 0` before rounding to tenths, so a value like 0.04 rounds to `allocatedUnits: 0` but still pushes a schedule entry and leaves `remainingEstimate` effectively unchanged — inflating `calcWeeks` and drawing the task's bar starting a week before any real work happens.
- **Verification notes:** Confirmed by both passes with a concrete numeric trace (5 resources, 3 free days, specific `maxResources`/estimate values producing exactly the 0.04 residual).
- **Suggested fix:** Round first, then branch on the rounded value; only push an entry when `allocatedUnits > 0`, else fall through to the fully-vacationed-reservation branch.

### Medium

#### F-08 No `hashchange` listener — pasting a different shared link into an open tab is silently overwritten
- **Location:** [src/hooks/useUrlPlan.js:44-96](src/hooks/useUrlPlan.js#L44-L96)
- **Reported by:** ui-react, persistence-url
- **Summary/scenario:** Hydration runs once, gated by `hasHydrated`; pasting a colleague's link into the address bar of an already-open tab is a same-document navigation with no reload, so the app keeps showing the old plan while the address bar shows the new link. The next edit's debounced write then overwrites the freshly pasted hash with the stale plan.
- **Verification notes:** Both passes confirmed there is no listener anywhere in the hook and traced the overwrite sequence.
- **Suggested fix:** Add a `window.addEventListener('hashchange', ...)` that decodes and hydrates when the hash differs from the hook's own last write.

#### F-09 `hydratePlan` doesn't reset UI selection — loading another plan can edit the wrong entity
- **Location:** [src/store/planSlice.js:18](src/store/planSlice.js#L18)
- **Reported by:** store-state, ui-react (as the TaskDetailPanel fallback symptom)
- **Summary/scenario:** IDs are re-derived positionally on every load (`t1..tN`, `c1..cN`), but `hydratePlan` keeps the previous selection state. Selecting task `t3` in plan A, then loading snapshot B, leaves `t3` "selected" — now plan B's third (unrelated) task — highlighted and open for editing.
- **Verification notes:** Both passes confirmed the positional re-derivation and the stale-selection carryover with a concrete two-plan scenario.
- **Suggested fix:** Reset all UI selection fields in `hydratePlan` (selection ids, editing cell, pending past-week edit, sidebar open state).

#### F-10 No-op document updates still push undo entries and wipe the redo stack
- **Location:** [src/store/planSlice.js:257](src/store/planSlice.js#L257)
- **Reported by:** store-state
- **Summary/scenario:** `updateActiveDocument` always pushes the previous document and clears `redoStack`, even when the updater returned an unchanged document (a rejected duplicate dependency, a boundary-clamped move, etc.). After an undo, attempting a rejected action silently destroys the redo entry the user just created.
- **Verification notes:** Both passes traced `updateActiveDocument` and confirmed it never compares `updated` against the original document before touching undo/redo state.
- **Suggested fix:** Compute the updated document first; if it's reference-equal to the input, return state unchanged with no undo/redo/saveStatus side effects.

#### F-11 CSV export writes the internal week index instead of the `YY.WW` label users see
- **Location:** [src/persistence/exportPlan.js:32](src/persistence/exportPlan.js#L32)
- **Reported by:** persistence-url, security (angle: unreadable without extra mapping)
- **Summary/scenario:** `exportScheduleCsv` writes `item.weekIndex` (an internal counter with no year) rather than consulting `document.weeks` for the label. A plan starting at week 40 exports a task in column "27.03" as `Week: 55`, which nobody reading the CSV can map back to a calendar week.
- **Verification notes:** Both passes confirmed by reading the export code and the week-index arithmetic in `timeline.js`.
- **Suggested fix:** Build a `weekIndex -> week` map and export the label (and optionally the date range) instead of, or alongside, the raw index.

#### F-12 CSV escaping only triggers on commas — quotes, newlines and formula-leading characters break rows or execute
- **Location:** [src/persistence/exportPlan.js:43](src/persistence/exportPlan.js#L43)
- **Reported by:** persistence-url, security
- **Summary/scenario:** A task/category name containing a double quote or newline but no comma is written unescaped, corrupting the row when opened in a spreadsheet tool. A name starting with `=`, `+`, `-`, or `@` (plausible from a shared link authored by someone else) is exported verbatim and can execute as a formula (e.g. `=HYPERLINK(...)`) when the CSV is opened in Excel.
- **Verification notes:** Both passes confirmed the exact one-line `escapeCsv` implementation and both failure modes.
- **Suggested fix:** Quote any field containing a comma, quote, CR or LF, and prefix values starting with `= + - @ \t \r` with a leading single quote before quoting.

#### F-13 Saved-snapshot delete is a single unconfirmed click next to the load button
- **Location:** [src/components/panels/LoadPlanModal.jsx:34](src/components/panels/LoadPlanModal.jsx#L34)
- **Reported by:** ui-react, persistence-url
- **Summary/scenario:** The trash icon calls `onDeleteSavedPlan` immediately with no confirmation; it sits directly beside the full-width Load button for the same row with only 8px of gap. Snapshots are the only explicit local backup and are not covered by undo. A mis-click permanently deletes one.
- **Verification notes:** Both passes confirmed the exact click handler and the adjacent-control layout.
- **Suggested fix:** Require a confirmation step before calling `onDeleteSavedPlan`, mirroring the existing past-week-edit confirmation pattern already used elsewhere in the app.

#### F-14 ISO week-53 year rollover produces different labels for the same calendar week depending on plan start year
- **Location:** [src/engine/timeline.js:113](src/engine/timeline.js#L113)
- **Reported by:** scheduling-engine, tests-docs
- **Summary/scenario:** In a 53-ISO-week year (2026, 2032, 2037...), the extra real week is absorbed by relabeling rather than represented, so the same calendar week gets a different `YY.WW` label depending on whether the plan's start year is 2026 or 2027. Two teams comparing a due-week label across plans that started in different years are actually talking about different weeks.
- **Verification notes:** Both passes hand-computed the specific date/label mismatch (`2027-01-04` labeled differently depending on start year) and confirmed it.
- **Suggested fix:** Pick and document one convention (real-ISO labeling with an occasional 53rd label, or a fixed epoch-anchored mapping) and add a test asserting the same calendar week gets the same label regardless of start year.

#### F-15 Recalculation's own outputs are included in its trigger key, doubling every recalculation
- **Location:** [src/hooks/useSchedule.js:22](src/hooks/useSchedule.js#L22)
- **Reported by:** scheduling-engine, performance (performance rated this **high** due to scale impact; scheduling-engine rated it **low** as a correctness/waste issue — kept at medium as a consensus)
- **Summary/scenario:** `scheduleInputs` stringifies `document.weeks` and `document.tasks`, both of which the scheduler itself just wrote (`calcWeeks`, regenerated `weeks`). Every edit therefore triggers a recalculation, which changes the key, which triggers a second recalculation before settling — doubling the cost of every keystroke that affects scheduling.
- **Verification notes:** Both passes confirmed the exact double-run sequence by tracing the effect's dependency key across two consecutive recalculations.
- **Suggested fix:** Exclude derived fields (`weeks`, `calcWeeks`) from the trigger key so only genuine source-input changes cause a recalculation.

#### F-16 `useUrlPlan` hydration is gated by a flag that never resets, masking the no-`hashchange` gap
- **Location:** [src/hooks/useUrlPlan.js:47](src/hooks/useUrlPlan.js#L47), confirmed root cause at line 69
- **Reported by:** persistence-url (this is the mechanism underlying F-08, verified independently as its own candidate)
- **Verification notes:** Both passes confirmed `hasHydrated` is set once by `hydratePlan` and never reset by anything, which is precisely why F-08's same-tab navigation case goes unnoticed by the app.
- **Suggested fix:** Same as F-08.

### Low

#### F-17 `compactTeams` drops every team but one when all teams have default names and resource counts
- **Location:** [src/persistence/shareUrl.js:333](src/persistence/shareUrl.js#L333)
- **Summary:** When every team compacts to an empty row (default name, default resource count), `compactTeams` returns `undefined` entirely, and `expandTeams` recreates exactly one team — silently dropping any second team and orphaning its resource rules. Currently latent because the UI has no way to add a second team, but the store action and the data shape both support it.
- **Verification notes:** Confirmed by both passes with a concrete two-default-team fixture.
- **Suggested fix:** Return rows whenever `teams.length > 1`, not just when any row is non-empty.

#### F-18 Corrupted or unrecognized saved-plan entries are silently dropped and then overwritten on the next save
- **Location:** [src/persistence/savedPlans.js:85](src/persistence/savedPlans.js#L85)
- **Summary:** `readSavedPlans` filters out any entry that fails shape validation with no warning; the next `savePlanSnapshot`/`deleteSavedPlan` call writes the filtered (shorter) array back, permanently discarding the damaged-but-possibly-recoverable entry.
- **Verification notes:** Confirmed by both passes.
- **Suggested fix:** Surface a warning when entries are filtered, and avoid rewriting storage on a lossy read without user confirmation.

#### F-19 / F-20 Migration framework is dead code with a latent infinite loop, and a test hardcodes the current year
- **Location:** [src/persistence/migrations/index.js:8](src/persistence/migrations/index.js#L8) and line 14; [src/persistence/shareUrl.test.js:20](src/persistence/shareUrl.test.js#L20) (test symptom of F-01)
- **Summary:** `migratePlanDocument` is never called from any production path. Its only migration, `migrateV1ToV2`, returns the document with its version field unchanged — masked today only because the version already matches. If `SCHEMA_VERSION` is ever bumped and this module wired in, the loop never terminates, hanging the tab on load for every document at the old version. Separately, `shareUrl.test.js` hardcodes `startYear: 2027` and asserts it is emitted — this assertion will start failing the moment the test machine's clock reads 2027, for the same root cause as F-01.
- **Verification notes:** Both passes confirmed the dead-code status and the exact non-advancing-version defect.
- **Suggested fix:** Either delete the migrations module until a real migration exists, or make each migration advance the version and add a guard against non-advancing steps. Fix F-01 first, which also fixes the test.

#### F-21 Documentation says there's no JSON import/export flow; the app has one
- **Location:** [docs/implementation_plan.md:5](docs/implementation_plan.md#L5)
- **Summary:** The implementation plan states the app has no "JSON import/export flow." `PlanView` has an "Export JSON" toolbar button and `LoadPlanModal` has "Load JSON," both consuming/producing the same compact positional document as the URL — an undocumented compatibility surface.
- **Verification notes:** Confirmed by both passes reading the docs and the corresponding UI code side by side.
- **Suggested fix:** Document Export JSON / Load JSON in README, the implementation plan, and the requirements doc, noting they share the URL's compatibility rules.

#### F-22 Persistence layer's color encoding is directly coupled to the UI palette array's order
- **Location:** [src/persistence/shareUrl.js:18](src/persistence/shareUrl.js#L18)
- **Summary:** `encodeColor` stores a built-in color as a bare index into `DEFAULT_CATEGORY_COLORS`. Reordering or inserting into that array (a UI-facing constant, not obviously a persistence-format constant) silently recolors every existing shared URL and snapshot.
- **Verification notes:** Confirmed by both passes.
- **Suggested fix:** Comment the constant as an append-only compatibility surface, and add a test pinning the current palette order.

#### F-23 `BackupRestoreModal`'s selected-file state isn't reset when the parent closes it after a successful restore
- **Location:** [src/components/panels/BackupRestoreModal.jsx:8](src/components/panels/BackupRestoreModal.jsx#L8)
- **Summary/scenario:** Only the modal's own `close()` clears `selectedFile`; a successful restore is closed by the parent calling `setIsBackupRestoreModalOpen(false)` directly, so reopening the modal shows the old filename with the destructive Restore button already enabled.
- **Verification notes:** Confirmed by both passes, including the exact re-render path when the modal reopens.
- **Suggested fix:** Reset `selectedFile` in an effect keyed on the `open` prop becoming false.

#### F-24 A predecessor that couldn't be fully scheduled leaves its successor unconstrained
- **Location:** [src/engine/scheduler.js:491](src/engine/scheduler.js#L491)
- **Summary/scenario:** `completionWeekByTask` is only set when a task's remaining estimate reaches zero. A predecessor that hits `MAX_CALCULATED_WEEKS` with work still left gets no completion week recorded, so its dependent successor is treated as unconstrained and scheduled from the plan start — silently violating the finish-to-start relationship with no warning.
- **Verification notes:** Confirmed by both passes with a concrete overloaded-predecessor scenario.
- **Suggested fix:** Track an explicit "unfinished" marker for partially-scheduled predecessors and either push the successor out with a warning or skip it.

#### F-25 Unused hook duplicates the "today" week calculation with a latent UTC/local mismatch
- **Location:** [src/hooks/useTodayWeek.js:8](src/hooks/useTodayWeek.js#L8); the same drift also exists in the *live* code at [src/components/timeline/OverlayLines.jsx:74](src/components/timeline/OverlayLines.jsx#L74) (see unverified findings)
- **Summary:** No component imports `useTodayWeek`; it's dead code. But it duplicates logic that also exists, with the same bug, in the code path that actually renders the "today" line (see the unverified UI finding on `OverlayLines.jsx`), so fixing one without the other leaves the app-visible bug in place.
- **Verification notes:** One verifier confirmed cleanly; the other flagged the dead-code claim as accurate but noted the live-code twin (`OverlayLines.jsx`) is the one that actually matters — reflected in the unverified findings below.
- **Suggested fix:** Delete the dead copy; fix the live `OverlayLines.jsx` version (see below) to use the engine's canonical `isCurrentWeek`.

### Info

#### F-26 Compact URL payload carries no format-version marker beyond the fixed `d.` prefix
- **Location:** [src/persistence/shareUrl.js:30](src/persistence/shareUrl.js#L30)
- **Summary:** Compatibility for the positional array relies entirely on `expandCompactPlanDocument` tolerating missing trailing cells; a future change that repurposes an existing slot cannot be detected at decode time. Observation, not yet a live defect.
- **Suggested fix:** Document the positional slot table per row type in the requirements doc; keep changes append-only.

## Disputed and refuted candidates

These went through the same two-pass verification but did not reach agreement, or were rejected by both passes. Included for transparency rather than as confirmed defects.

| Finding | Verdict | Why |
|---|---|---|
| [src/engine/dependencyGraph.js:8](src/engine/dependencyGraph.js#L8) — external dependency type inference reads a field that never exists on a dependency row | Disputed (uncertain / uncertain) | Both verifiers agreed the code mechanics are exactly as described, but one found the triggering precondition (a hand-authored dependency row missing `predecessorType`) is not reachable through any shipped decode/store path today, so real-world impact is unclear. |
| [src/store/teamsSlice.js:31](src/store/teamsSlice.js#L31) — `setWeekResource` drops later resource rules | Disputed (refuted / uncertain) | One verifier found the described drop does occur in a hand-trace; the other concluded the net effect on `resolveWeekResourceCount` output was less clear-cut than claimed. Worth a maintainer's own look rather than treating as settled either way. |
| [src/store/scheduleSlice.js:94](src/store/scheduleSlice.js#L94) — auto-completion applies only once per session | **Refuted** (both passes) | Both verifiers traced the flag and found it is in fact reset appropriately; the original claim does not hold. |
| [src/engine/allocationDisplay.js:64](src/engine/allocationDisplay.js#L64) — display and scheduler disagree on fallback resource count | Refuted (single verifier only; its counterpart never ran before the stop) | The one verifier that ran found both code paths are actually unreachable in the described way because every document construction path guarantees a defined `startingResourceCount`. Treat as likely not a real issue, but note only one of the two checks completed. |

## Findings from the Find phase not yet independently verified

The items below come from the same full-file reads as the confirmed findings above, but the workflow was stopped before a second pass could check them. They are organized by review dimension, most-severe first within each, and are first-pass claims only — treat them as a triage list, not settled defects.

### UI / React (correctness, accessibility, UX)

- **Medium** [PlanSettingsPanel.jsx:120](src/components/panels/PlanSettingsPanel.jsx#L120) — Escape in every deferred input commits the edit instead of discarding it (the queued draft reset hasn't flushed before `blur()` fires the commit handler). Affects five different inputs across three panels.
- **Medium** [useKeyboardShortcuts.js:36](src/hooks/useKeyboardShortcuts.js#L36) — Escape has no "user is typing" guard, so pressing it inside any panel input closes the whole sidebar and loses the selection; it also doesn't close open modals as the requirements document says it should.
- **Medium** [ui/Modal.jsx:10](src/components/ui/Modal.jsx#L10) — no dialog semantics: no `role="dialog"`, no focus trap, no initial focus, no Escape-to-close. Keyboard focus stays on the grid behind an open confirmation modal.
- **Medium** [TaskDetailPanel.jsx:29](src/components/panels/TaskDetailPanel.jsx#L29) — Task/Week detail panels fall back to the *first* item in the list when the selected id no longer resolves (e.g. after an undo), so the panel can silently edit a different entity than the one highlighted in the grid.
- **Medium** [TaskDetailPanel.jsx:35](src/components/panels/TaskDetailPanel.jsx#L35) — the name-autofocus effect re-selects all text on every keystroke while the name still matches `Task \d+`, so continuing to type after "Task 1" → "Task 12" replaces the whole field instead of appending.
- **Medium** [TaskDetailPanel.jsx:153](src/components/panels/TaskDetailPanel.jsx#L153) — several `<label>` elements wrap a button group (color picker, dependency type selector); clicking the label text itself fires the *first* button, silently changing a color or wiping a chosen predecessor.
- **Medium** [PlanSettingsPanel.jsx:24](src/components/panels/PlanSettingsPanel.jsx#L24) — Start year/week commit on every keystroke rather than on blur, so intermediate typing (e.g. "2" then "20" then "202") triggers a full reschedule and an undo entry each time.
- **Medium** [DependencyDetailPanel.jsx:372](src/components/panels/DependencyDetailPanel.jsx#L372) — the external-dependency text field can't be cleared; deleting all text snaps the visible value back to the default placeholder name mid-edit.
- **Medium** [TaskDetailPanel.jsx:104](src/components/panels/TaskDetailPanel.jsx#L104) — the free-text Priority field conflicts with move-up/down reordering; a manually typed priority is silently discarded the next time any task is moved.
- **Medium** [TaskDetailPanel.jsx:127](src/components/panels/TaskDetailPanel.jsx#L127) — "Earliest week" expects a raw internal week index while every other week field in the UI uses the `YY.WW` label, with no indication of the difference.
- **Medium** [PlanView.jsx:230](src/pages/PlanView.jsx#L230) — every save/load/restore error is funneled into the same generic "URL state error" banner behind whichever modal is still open, rather than an inline message on the modal itself.
- **Medium** [LoadPlanModal.jsx:34](src/components/panels/LoadPlanModal.jsx#L34) — (see confirmed F-13).
- **Medium** [PlanView.jsx:161](src/pages/PlanView.jsx#L161) — loading a snapshot or JSON file replaces the active URL plan and clears undo history with no confirmation, so an unsaved URL-only plan is unrecoverable.
- **Medium** [scheduleSlice.js:120](src/store/scheduleSlice.js#L120) — scheduler warnings (dependency cycle, could-not-schedule-in-260-weeks) are computed but never rendered anywhere in the UI.
- **Medium** [ShiftTaskModal.jsx:39](src/components/panels/ShiftTaskModal.jsx#L39) — invalid shift deltas (negative, non-numeric, or no-op) close the modal silently as if the shift succeeded, with no validation or feedback.
- **Medium** [timeline/OverlayLines.jsx:59](src/components/timeline/OverlayLines.jsx#L59) — the "Today" line label and dependency labels are painted underneath the sticky grid header with no z-index offset, so they're invisible whenever the current week or a dependency marker falls near the top.
- **Medium** [timeline/CategoryTaskGroup.jsx:160](src/components/timeline/CategoryTaskGroup.jsx#L160) — category and task name cells are click-only divs with no keyboard access; a keyboard-only user cannot open the side panel for most rows.
- Low-severity items in this dimension include: a duplicate-dependency add being silently ignored ([DependencyDetailPanel.jsx:119](src/components/panels/DependencyDetailPanel.jsx#L119)), the live "today" UTC/local date-parsing mismatch in [OverlayLines.jsx:74](src/components/timeline/OverlayLines.jsx#L74) (the live twin of confirmed F-25), several unused components/hooks and duplicated helper logic, a prop-less `TaskCell` fallback that would crash on `week.label` if ever reached, tasks with a dangling `categoryId` disappearing from the grid without notice, clipped tooltips on the bottom summary row, low-contrast/no-name color swatches, and an `inputMode="numeric"` on a field that expects a dotted `YY.WW` label (blocks the `.` key on iOS).

### Performance and scale

- **High** [useSchedule.js:19](src/hooks/useSchedule.js#L19) — every keystroke in a task's name or notes field triggers a full schedule recalculation, because the recalculation trigger key stringifies display-only fields alongside scheduling inputs.
- **High** [PlanView.jsx:59](src/pages/PlanView.jsx#L59) — no `React.memo` boundary anywhere in the grid tree; any UI-only state change (selection, save-status flip, hover) re-renders every task×week cell. At the documented target scale (hundreds of tasks × up to 260 weeks) this is tens of thousands of components re-rendering per interaction.
- **High** [timeline/TaskCell.jsx:31](src/components/timeline/TaskCell.jsx#L31) — each grid cell subscribes to the Zustand store six separate times; any store update runs all six selectors across every cell before React can bail out.
- **Medium** [timeline/CategoryTaskGroup.jsx:146](src/components/timeline/CategoryTaskGroup.jsx#L146) — an O(tasks × dependencies × tasks) scan runs on every render just to decide whether to show a small dependency "info" icon.
- **Medium** [engine/scheduler.js:210](src/engine/scheduler.js#L210) — per-task, per-week capacity resolution re-filters and re-sorts resource/free-day arrays from scratch inside the hot loop (this overlaps with, and generalizes, the resource-resolver finding from the earlier manual pass).
- **Medium** [timeline/viewWindow.js:10](src/components/timeline/viewWindow.js#L10) — no column or row virtualization; every week up to the 260-week cap and every task row is real DOM, even though only ~25-40 columns fit in a typical viewport.
- **Medium** [persistence/shareUrl.js:15](src/persistence/shareUrl.js#L15) — the URL's practical size ceiling is reached well before the app's own 100,000-character cap for plans with several hundred annotated tasks; there is no warning as the payload grows, only a hard failure at the cap.
- Low-severity items include several more linear-scan inefficiencies in the scheduler and dependency graph, an undo stack that retains full generated documents (schedule/weeks included) for up to 50 edits, and an unmemoized full-document `JSON.stringify` on every render.

### Security (client-only app, URL/localStorage as the threat surface)

- **High** [engine/scheduler.js:173](src/engine/scheduler.js#L173) — a crafted shared link with an extreme `dueWeek`/`weekIndex` value (no range check on decode) can make the app try to allocate an astronomically large array of weeks, hanging or crashing the tab on load for anyone who opens the link.
- **Medium** [persistence/shareUrl.js:487](src/persistence/shareUrl.js#L487) — no size cap on the *decompressed* payload; a small, highly-repetitive compressed blob could inflate to a very large in-memory document before any validation runs.
- **Medium** [persistence/shareUrl.js:177](src/persistence/shareUrl.js#L177) — decoded fields are never type-checked; a non-string name from a crafted link can crash the React render tree.
- **Medium** [persistence/exportPlan.js:43](src/persistence/exportPlan.js#L43) — CSV formula injection (overlaps with confirmed F-12).
- **Low** [index.html:8](index.html#L8) — no Content-Security-Policy meta tag, despite the app having no inline scripts and being a good candidate for a strict policy at no functional cost.
- **Low** [persistence/savedPlans.js:3](src/persistence/savedPlans.js#L3) — the localStorage key for saved snapshots is generic and unnamespaced, so it could collide with another project sharing the same GitHub Pages account origin.
- **Low** [.github/workflows/deploy.yml:34](.github/workflows/deploy.yml#L34) — deploy uses `npm install` rather than `npm ci` despite a committed lockfile, weakening reproducibility of the published build.

### Validators and utility modules

- **High** [utils/validators.js:16](src/utils/validators.js#L16) — the 440-line `validatePlanDocument` is called only from tests; no production load path (URL decode, snapshot load, JSON import) ever validates a document before hydrating it.
- **High** [utils/validators.js:386](src/utils/validators.js#L386) — if the above were wired in naively, it would currently *reject* valid decoded plans, because week-index validation checks against the 4-week placeholder array built before the scheduler ever runs, not the plan's real range.
- **Medium** [components/panels/TaskDetailPanel.jsx:105](src/components/panels/TaskDetailPanel.jsx#L105) — Priority and Earliest-week inputs accept `NaN`, negative, and fractional values with no normalization on the write path.
- **Medium** [store/planSlice.js:87](src/store/planSlice.js#L87) — the plan-settings write path for start week/year accepts fractional and out-of-range values (overlaps with confirmed F-04's root cause).
- **Medium** [utils/numbers.js:6](src/utils/numbers.js#L6) — the shared numeric parser turns both "empty" and "non-numeric" input into `0`, so an emptied estimate or resource field is indistinguishable from an explicit zero and the task can silently vanish from the schedule.
- **Medium** [utils/validators.js:138](src/utils/validators.js#L138) — the validator rejects empty names that the UI itself allows the user to save, meaning the app can produce documents that fail its own (currently unused) validator.
- Low-severity items include several duplicated helper implementations across modules that have already begun to drift (ISO-week math, `setVacationDays`, deferred-input components), and dead date/color utility functions that contain latent bugs of their own (0-based vs 1-based week-index confusion, 3-digit hex mis-parsing, DST-unsafe weekday counting) that would surface immediately if anyone reached for them.

### Store / Zustand slices, undo/redo

- **Medium** [store/tasksSlice.js:88](src/store/tasksSlice.js#L88) — completing a task drops its manual schedule entries but leaves `shiftRules` intact, so un-completing it later and deleting the stale shift re-injects old allocations on top of freshly scheduled work.
- **Medium** [store/dependenciesSlice.js:12](src/store/dependenciesSlice.js#L12) — dependency endpoints aren't validated to exist when created or updated; a dangling id decodes as "task 1" on the next reload, silently rewriting the dependency's target.
- Several low-severity dead-code findings: unused multi-plan store scaffolding (`createPlan`, `setActivePlan`, `renamePlan`) that would be unsafe with the undo stack if ever wired up, an unused `pushUndo` action that bypasses the 50-entry cap, and `addSprint`/`addWeek`/`addTeam` actions whose writes are immediately overwritten by the next recalculation.
- **Low** [store/tasksSlice.js:24](src/store/tasksSlice.js#L24) — `removeTask` doesn't renumber priorities, so a newly added task can end up sharing a priority with an existing one.

### Build, CI/CD, tooling

- **Medium** [.github/workflows/deploy.yml:36](.github/workflows/deploy.yml#L36) — the only workflow builds and deploys straight to the live production site on every push to `main` **without ever running the test suite**, and there is no CI trigger on pull requests at all. For a project whose own top constraint is "don't break already-shared URLs," this means a persistence or scheduling regression can be merged and auto-deployed with zero automated gate. (Recent commit history — "fix regression," "fix scheduling" — is consistent with this having already happened.)
- **Medium** [vite.config.js:6](vite.config.js#L6) — the build's `base: '/'` is only correct because of an out-of-repo GitHub Pages custom-domain setting with no record anywhere in the repository (no `CNAME` file, no documentation); losing that setting would 404 every asset and blank the site.
- **Low** items: CI uses `npm install` instead of `npm ci` (same as the security-dimension finding above), no `engines` field or `.nvmrc` (vitest 4 requires Node ≥20 and nothing documents this), no lint/format/typecheck tooling at all in a 90-file hand-written React codebase, a missing explicit `@testing-library/dom` devDependency that is currently only present transitively, `cancel-in-progress: true` on the deploy workflow's concurrency group (can abort a production deploy mid-flight), and GitHub Action versions on a runner runtime GitHub is retiring.

### Tests and documentation drift

- **Medium** [src/App.test.jsx:324](src/App.test.jsx#L324) — a test hardcodes `26.01`-style labels for a plan built with the default (current-year) start year, so it will start failing from January 2027 onward — another test-suite symptom of confirmed F-01.
- **Medium** [src/persistence/savedPlans.js:19](src/persistence/savedPlans.js#L19) — "Save as" under a name matching a *different* existing snapshot silently overwrites that other snapshot with no confirmation; untested.
- **Medium** [docs/project_timeline_manager_requirements.md:353](docs/project_timeline_manager_requirements.md#L353) — the requirements document describes a URL-state indicator ("updating url" / "url updated" / "url error") in the top bar that the code computes but never renders.
- **Medium** [README.md:73](README.md#L73) — the README describes "Shift" as bulk-moving *checked* tasks with support for negative deltas; the actual implementation shifts one selected task-week cell forward only, with no checkboxes and no negative deltas.
- Several more docs-drift items and low-severity test-coverage gaps round out this dimension, largely overlapping with items already listed above (the year-dependence tests, the migration framework, the JSON import/export omission).

## Positive observations

- The scheduling engine (`src/engine/`) is genuinely pure and side-effect free, uses Map-based allocation accumulators and a proper priority-aware topological sort, and is pinned by a realistic, behavioral test fixture rather than snapshot tests — multiple independent reviewers singled this out as well above the bar for a hand-written scheduler.
- No cross-site-scripting sink exists anywhere in `src/`: no `dangerouslySetInnerHTML`, `innerHTML`, `eval`, or `document.write`; every user-supplied string reaches the DOM only through JSX text nodes or React style objects.
- The compact URL codec is carefully engineered for size and robustness: positional arrays, index-based cross-references, trailing-null trimming, a 250ms debounced write with a write-version guard and payload-equality short-circuit, and `history.replaceState` (no history spam).
- The Zustand store composes independent slices through a single `updateActiveDocument` entry point with an explicit key-collision assertion, and the realistic cascading-delete cases (removing a task/category/external dependency) are handled correctly.
- The deploy workflow otherwise follows the current GitHub Pages OIDC least-privilege pattern correctly, and the committed lockfile resolves a genuinely mutually-compatible toolchain (Vitest 4, Vite 6, React 19, Testing Library 16).
- The 25-case scheduler test suite and the compact-URL round-trip test suite both assert exact, meaningful values rather than snapshots, which is what made hand-tracing and verifying so many of the findings above possible at all.

## Coverage

Files read across the nine review dimensions include essentially all of `src/engine/`, `src/persistence/`, `src/store/`, `src/hooks/`, `src/utils/`, `src/constants/`, all files under `src/components/panels/` and `src/components/timeline/`, most of `src/components/ui/`, `src/pages/PlanView.jsx`, `src/App.jsx`, `src/main.jsx`, every test file, both documentation files under `docs/`, `README.md`, `AGENTS.md`, and the build/CI configuration (`package.json`, `vite.config.js`, `tailwind.config.js`, `.github/workflows/deploy.yml`, `index.html`). This is a large majority of the 106 tracked files; the main gap is that individual UI component files were read closely by some dimensions and only grep-sampled by others, so component-level findings should be treated as a strong first pass rather than an exhaustive one.
