# Code Review: `zupermann/local-sprint-plan`

**Repository:** https://github.com/zupermann/local-sprint-plan  
**Stack:** React 19 · Zustand 5 · Vite 6 · Tailwind CSS 3 · Vitest  
**Review Date:** 2026-05-15  
**Scope:** Full source review covering architecture, correctness, performance, and maintainability

---

## Executive Summary

`local-sprint-plan` is a well-conceived, local-first sprint planning tool. The core scheduling engine is the strongest part of the codebase — it is pure, deterministic, and meaningfully tested. The persistence layer shows advanced thinking (multi-encoding URL compression). However, several structural issues accumulate risk as the codebase grows: a flat, untyped Zustand store that is vulnerable to key collisions, unbounded memory in the undo stack, a semantically broken dead-code branch in `updatePlanSettings`, and a JSON-stringify-based change detection pattern in `useSchedule` that is fragile and expensive. None of these are showstoppers today, but they compound.

---

## 1. Project Structure

```
src/
  engine/         — Pure scheduling logic (no React, no store)
  store/          — Zustand slices, composed at root
  persistence/    — URL encoding / schema / migrations
  hooks/          — React integration layer
  pages/          — Top-level page components
  components/     — UI components
  constants/      — Shared defaults and schema version
  utils/          — ID generation helpers
```

The separation of `engine/` from the React layer is excellent. The engine can be imported and tested in Node without any browser globals. This is the single most important architectural decision in the codebase and it is done correctly.

---

## 2. Scheduling Engine (`src/engine/`)

### 2.1 `dependencyGraph.js` — Kahn's Algorithm

The topological sort is implemented correctly using Kahn's BFS algorithm.

```js
// Correctly builds adjacency sets and detects cycles via length check
const hasCycle = sortedIds.length !== tasks.length;
```

**Issue — legacy field aliases are silently accepted:**  
The graph builder handles both `predecessorId`/`successorId` and the legacy `fromTaskId`/`toTaskId` field names:

```js
const predecessorId = dependency.predecessorId ?? dependency.fromTaskId;
const successorId = dependency.successorId ?? dependency.toTaskId;
```

This is a migration compatibility shim that lives permanently in hot-path code. The dual-alias logic should either be removed after a migration, or explicitly marked with a `// TODO: remove after migration-X` comment so it doesn't silently become a permanent API surface.

**Issue — no cycle identification:**  
When `hasCycle` is true, the scheduler surfaces the message `"Dependency cycle detected."` but never identifies *which* tasks form the cycle. This makes it extremely hard for users to resolve the problem. A simple DFS from any node not in `sortedIds` would identify the cycle members.

```js
// Suggested addition to topologicalSort return value
const cycleNodes = hasCycle
  ? tasks.filter((task) => !new Set(sortedIds).has(task.id)).map((t) => t.id)
  : [];
return { sortedIds, hasCycle, cycleNodes };
```

---

### 2.2 `scheduler.js` — Task Scheduling Loop

The main scheduler is clean and readable. Key observations:

**Good — retry logic is safe:**  
The `needsMoreWeeks` / `retry()` pattern correctly expands the week window and re-runs scheduling within a `MAX_CALCULATED_WEEKS` cap, preventing infinite loops.

**Issue — `retry()` is assigned as a side effect on `state`, not a pure return:**

```js
state.retry = (weeks) => {
  const retried = scheduleTask({ ...options, weeks });
  Object.assign(state, retried);   // mutates state in-place
};
```

This is an imperative mutation pattern inside an otherwise functional design. The retry should be expressed as a loop in the caller (`recalculateSchedule`) rather than a method attached to a result object. The current approach obscures control flow and makes the function harder to test in isolation.

**Issue — `allocatedByWeek` only tracks auto-scheduled allocations:**

```js
// Manual entries are excluded from allocatedByWeek
for (const entry of result.entries) {
  if (entry.isManual) {
    continue;
  }
  allocatedByWeek.set(entry.weekIndex, ...);
}
```

This means manual allocations from one task do **not** reduce available capacity for auto-scheduled tasks in the same week. If a task is given a large manual allocation, subsequent tasks will over-allocate that week. The manual allocation map (`createManualAllocationMap`) is built upfront but only covers manual entries of tasks that were fully manual — it does not include partial-manual tasks. This is a correctness bug in multi-task plans with mixed manual/auto entries.

**Issue — `getTaskWeekCapacity` re-sorts `resourceOverrides` on every week iteration:**

```js
const override = [...(task.resourceOverrides ?? [])]
  .filter((item) => item.weekIndex <= weekIndex)
  .sort((a, b) => b.weekIndex - a.weekIndex)[0];
```

For a task with N overrides scheduled across W weeks, this is O(N·W) per task. For large plans this accumulates. `resourceOverrides` should be pre-sorted once before the week loop, then binary-searched or walked with a pointer.

---

### 2.3 `resourceResolver.js`

`resolveWeekResourceCount` correctly implements "use most recent resource count at or before this week" — a step-function interpolation. It re-sorts on every call, however:

```js
const sortedResources = weekResources
  .filter((item) => item.teamId === teamId && item.weekIndex <= weekIndex)
  .sort((a, b) => b.weekIndex - a.weekIndex);
```

This is called once per week per task from inside `scheduleTask`. Pre-sorting `weekResources` once per scheduler run would eliminate redundant work.

**Minor issue — `countCategoryVacationDaysForWeek` has a no-op clamp:**

```js
return Math.max(0, Math.min(Number(entry?.dayCount) || 0, Number.MAX_SAFE_INTEGER)) || 0;
```

`Math.min(..., Number.MAX_SAFE_INTEGER)` does nothing useful — `Number.MAX_SAFE_INTEGER` is effectively infinity for this domain. The intent was probably to clamp to a maximum of 5 workdays per week. This should be `Math.min(..., workdays)` (the `workdays` parameter already exists on the function signature but is unused).

---

### 2.4 `timeline.js`

ISO week arithmetic is implemented from scratch without a date library. The logic is correct and well-tested, but there is one edge case:

**Issue — `isPastWeek` uses a hardcoded time of `T23:59:59` with no timezone:**

```js
const end = new Date(`${week.endDate}T23:59:59`);
return end < today;
```

`new Date("2026-05-15T23:59:59")` is parsed as **local time** in browsers, while `new Date()` is also local time. This is actually consistent, but it means a plan opened in a different timezone will compute "past weeks" differently. For a purely local tool this is acceptable, but it should be documented. If UTC consistency is ever needed, both sides should use `T23:59:59Z`.

---

## 3. State Management (`src/store/`)

### 3.1 Flat Namespace — Risk of Silent Key Collisions

All slices are spread into one flat Zustand store:

```js
// src/store/index.js
export const useTimelineStore = create((set, get) => ({
  ...createPlanSlice(set, get),
  ...createTasksSlice(set, get),
  ...createCategoriesSlice(set, get),
  ...createDependenciesSlice(set, get),
  ...createSprintsSlice(set, get),
  ...createWeeksSlice(set, get),
  ...createTeamsSlice(set, get),
  ...createScheduleSlice(set, get),
  ...createUiSlice(set, get),    // ← undoStack and redoStack defined here
}));
```

`undoStack` and `redoStack` are defined in `uiSlice.js` but consumed by `planSlice.js`. This cross-slice dependency is invisible — there is no contract between slices. If a future slice defines a key named `saveStatus` or `plans`, it silently overwrites the existing value and the bug will be non-obvious to debug.

**Recommended fix:** Add a dev-mode assertion on startup:

```js
function assertNoKeyCollisions(...slices) {
  const keys = slices.flatMap(Object.keys);
  const seen = new Set();
  for (const key of keys) {
    if (seen.has(key)) throw new Error(`Store key collision: "${key}"`);
    seen.add(key);
  }
}
```

Or migrate to TypeScript with a typed combined interface.

---

### 3.2 `planSlice.js` — Dead Code in `updatePlanSettings`

```js
const startingResourceCount =
  patch.startingResourceCount !== undefined
    ? Math.max(0, Number(patch.startingResourceCount) || 0)
    : (document.plan.startingResourceCount ?? document.weekResources[0]?.resourceCount ?? 0);

// ... many lines later ...
const weekResources =
  startingResourceCount === undefined || !firstTeamId   // ← ALWAYS FALSE
    ? shiftedWeekResources
    : [...];
```

`startingResourceCount` is resolved to a number (possibly `0`) in all branches above — it is **never** `undefined` at this point. The `=== undefined` check is dead code and the `shiftedWeekResources` branch is unreachable. This means the resource-update block always runs, even when the caller did not pass `startingResourceCount` in `patch`. The original intent was almost certainly:

```js
const weekResources =
  patch.startingResourceCount === undefined || !firstTeamId
    ? shiftedWeekResources
    : [...];
```

This is a correctness bug — resource entries are being rewritten on every plan settings update, even when only `rowHeight` or `weekColumnWidth` was changed.

---

### 3.3 Undo Stack — No Size Cap

```js
undoStack: [...state.undoStack, state.plans.find(...)].filter(Boolean),
```

The undo stack stores full document snapshots with no eviction policy. A document with 200 tasks, 500 schedule entries, and 100 week resources can easily be several hundred KB. After 50 mutations the stack holds ~25 MB of duplicated data in memory. Most plan-management tools cap undo at 50–100 entries.

**Recommended fix:**

```js
const MAX_UNDO_STACK = 50;
undoStack: [...state.undoStack, currentDocument].filter(Boolean).slice(-MAX_UNDO_STACK),
```

---

### 3.4 `uiSlice.js` — `undoStack`/`redoStack` Ownership Confusion

`undoStack` and `redoStack` are initialized in `uiSlice.js` but read and mutated by `planSlice.js`. This is an implicit coupling between two slices. `uiSlice` also exposes a `pushUndo` action that pushes raw entries (not documents), which is inconsistent with how `updateActiveDocument` in `planSlice` pushes full document snapshots. It is unclear whether `pushUndo` is used anywhere or is vestigial.

---

### 3.5 `tasksSlice.js` — `applyTransforms` Pattern

```js
function applyTransforms(document, transforms) {
  return Object.entries(transforms).reduce(
    (next, [key, transform]) => ({ ...next, [key]: transform(next[key] ?? []) }),
    document,
  );
}
```

This is a clever mini-combinator for applying multiple field transforms in one pass. However, it silently passes `[]` as fallback for any missing key, including `plan`, which is an object — not an array. If a transform were accidentally applied to `plan`, it would receive `[]` and silently corrupt the document. The fallback should be typed per-key, or this pattern should be restricted to array-only fields.

---

## 4. Persistence Layer (`src/persistence/`)

### 4.1 `shareUrl.js` — Encoding Strategy

The multi-encoding approach is sophisticated: try plain JSON, Base91, and deflate+Base91, then pick the shortest result. The custom `encodeBase91`/`decodeBase91` is a correct implementation of the Base91 algorithm with a URL-safe alphabet that deliberately excludes `%` to avoid double-encoding issues.

**Issue — all three encodings are computed eagerly:**

```js
const jsonPayload    = `j.${encodeURIComponent(json)}`;
const base91Payload  = `b.${encodeURIComponent(encodeBase91(new TextEncoder().encode(json)))}`;
const compressedPayload = `d.${encodeURIComponent(encodeBase91(await compressBytes(...)))}`;
const payload = [jsonPayload, base91Payload, compressedPayload].sort(...)[0];
```

Compression (`compressBytes`) is called unconditionally, even for a plan with 2 tasks. For small plans, deflate + Base91 will almost never beat raw JSON, making this work wasteful. Use a size threshold:

```js
// Only try compression if JSON payload exceeds a threshold
const compressedPayload = json.length > 2000
  ? `d.${encodeURIComponent(encodeBase91(await compressBytes(...)))}`
  : null;
```

**Issue — `SHARE_URL_MAX_PAYLOAD_LENGTH = 100_000` is very generous:**

Most browsers support URL lengths up to ~2 MB, but server-side proxies and tools commonly truncate at 8 KB. The 100K limit means sharing a large plan URL through a proxy, Slack, or Jira comment may silently truncate the hash. A lower default (e.g. 32 KB) with a warning, or documented guidance, would be safer.

**Issue — `CompressionStream` browser error message is outdated:**

```js
throw new Error('URL state compression requires CompressionStream support in Chrome or Edge.');
```

`CompressionStream` is supported in Firefox ≥ 113 and Safari ≥ 16.4. Naming Chrome/Edge specifically will mislead users on modern Firefox and Safari. Change to: `"URL state compression is not supported in your browser."`.

---

### 4.2 `shareUrl.js` — `expandPairs` Field Name Mismatch

```js
function expandPairs(rows = []) {
  return rows.map((row = []) => ({
    weekIndex: row[0],
    dayCount: row[1] ?? 0,   // ← wrong semantic name for resource overrides
  }));
}
```

This function is used for both vacation day pairs (`{ weekIndex, dayCount }`) and resource override pairs (`{ weekIndex, allocatedUnits }`). The vacation use is correct, but for resource overrides the field is immediately renamed:

```js
resourceOverrides: expandPairs(task[8]).map(({ weekIndex, dayCount }) => ({
  weekIndex,
  allocatedUnits: dayCount,   // ← rename to fix misleading name
})),
```

This indicates `expandPairs` is serving double duty with the wrong shape for one of its usages. Either rename to `expandWeekValuePairs` with a neutral second field name (`value`), or create two separate functions.

---

### 4.3 `shareUrl.js` — `compactPairs` is a No-Op Wrapper

```js
function compactPairs(items = [], mapper) {
  const rows = compactRows(items, mapper);
  return rows;  // literally just calls compactRows
}
```

`compactPairs` adds no logic over `compactRows`. It appears to be an abstraction that was started but never differentiated. Either remove it or give it distinct behavior (e.g., enforce the 2-element tuple shape).

---

### 4.4 `schema.js` — `emptyPlanDocument.plan = null`

```js
export const emptyPlanDocument = {
  version: PLAN_SCHEMA_VERSION,
  plan: null,    // ← null, not an object
  categories: [],
  ...
};
```

Every consumer of a document does `document.plan?.startWeek` with optional chaining, which suggests code has been written defensively because `plan` can be null. But a null `plan` is not a valid document state — it should be a required field. The spread `{ ...emptyPlanDocument, plan, ... }` in `createPlanDocument` is fine, but `emptyPlanDocument` itself exported as a valid document template misleads callers into thinking a null plan is acceptable. Consider making `emptyPlanDocument` a private constant or adding a runtime assertion.

---

## 5. React Hooks (`src/hooks/`)

### 5.1 `useSchedule.js` — `JSON.stringify` as Change Detector

```js
const scheduleInputs = document
  ? JSON.stringify({
      plan: { startYear, startWeek, ... },
      categories: document.categories,
      tasks: document.tasks,
      dependencies: document.dependencies,
      ...
    })
  : '';

useEffect(() => {
  if (activePlanId) {
    recalculateActiveSchedule();
  }
}, [activePlanId, scheduleInputs, recalculateActiveSchedule]);
```

`JSON.stringify` of the entire document is computed on **every render** to serve as a change-detection key for `useEffect`. This is O(N) work per render where N is the total document size. For a plan with 100 tasks and 1000 schedule entries, this runs on every keystroke in any input field connected to the store. 

The correct approach is to use Zustand's selector with `shallow` equality, or compute a dedicated "inputs hash" only from the fields that actually affect scheduling — not the full document including `schedule` itself (which changes as a result of recalculation, creating a potential trigger loop if not guarded).

**Recommended fix:**

```js
import { shallow } from 'zustand/shallow';

const scheduleInputs = useTimelineStore(
  (state) => {
    const doc = state.getActiveDocument();
    return {
      tasks: doc?.tasks,
      dependencies: doc?.dependencies,
      weekResources: doc?.weekResources,
      // ... only the fields that feed the scheduler
    };
  },
  shallow
);
```

---

### 5.2 `useUrlPlan.js` — `getActiveDocument()` as Selector

```js
const activeDocument = useTimelineStore((state) => state.getActiveDocument());
```

`state.getActiveDocument()` is a function defined inside the store as `() => get().plans.find(...)`. When passed as a selector to `useTimelineStore`, it returns a new reference on every call (since `find()` returns a new object reference each time). Zustand uses `Object.is` equality by default, so this will cause the component to re-render on every store update, even if the document content hasn't changed. 

The selector should be inlined to allow Zustand's equality check to work:

```js
const activeDocument = useTimelineStore(
  (state) => state.plans.find((d) => d.plan.id === state.activePlanId)
);
```

---

### 5.3 `useUrlPlan.js` — `debounce` Re-implemented Inline

The hook contains a hand-rolled `debounce` function rather than using a shared utility. The implementation is correct, but since debouncing is used elsewhere (or likely will be), it should live in `src/utils/debounce.js`. The `useMemo` wrapping `debounce(...)` is also unusual — since `debounce` captures the callbacks in its closure, dependency changes won't update the inner callback without recreating the debounced function. This is currently safe because `setImportError` and `setSaveStatus` are stable store references, but it's a fragile pattern.

---

## 6. Dependencies & Build (`package.json`)

```json
"dependencies": {
  "react": "^19.0.0",
  "zustand": "^5.0.2",
  "lucide-react": "^0.468.0"
},
"devDependencies": {
  "vitest": "^4.1.6"
}
```

- No TypeScript — given the store's flat namespace and the cross-slice dependencies, TypeScript would catch a significant class of bugs that are currently invisible.
- `vite` and `@vitejs/plugin-react` are listed under `dependencies` instead of `devDependencies`. Vite is a build tool and should not be in production dependencies.
- Tailwind CSS 3.x is used, while Tailwind CSS 4 (with significant API changes) is available. No migration risk today, but worth tracking.
- No ESLint configuration is present in the root (not in the files listed). Code quality enforcement is entirely reliant on developer discipline.

---

## 7. Test Coverage

| Module | Test File | Coverage Assessment |
|---|---|---|
| `engine/scheduler.js` | `scheduler.test.js` | Core paths covered |
| `engine/timeline.js` | `timeline.test.js` | Basic week building tested |
| `persistence/shareUrl.js` | `shareUrl.test.js` | Encode/decode round-trips present |
| `store/` (all slices) | None | No tests |
| `hooks/` | None | No tests |
| `components/`, `pages/` | `App.test.jsx` | Unclear — file exists but not reviewed |

The engine and persistence layers are meaningfully tested. The store layer — where most of the application logic lives — has no test coverage. Specifically, `updatePlanSettings`, undo/redo, and the schedule recalculation trigger would benefit from unit tests.

---

## 8. Summary of Actionable Issues

| # | Severity | File | Issue | Fix |
|---|---|---|---|---|
| 1 | 🔴 Bug | `store/planSlice.js` | `startingResourceCount === undefined` is dead code; resources rewritten on every settings update | Check `patch.startingResourceCount === undefined` instead |
| 2 | 🔴 Bug | `engine/scheduler.js` | Manual allocations not counted toward `allocatedByWeek`; auto-scheduled tasks over-allocate weeks with manual entries | Include manual entries in `allocatedByWeek` map |
| 3 | 🟠 Performance | `hooks/useSchedule.js` | `JSON.stringify` of full document on every render | Use Zustand `shallow` selector on scheduling-input fields only |
| 4 | 🟠 Performance | `hooks/useUrlPlan.js` | `getActiveDocument()` as selector defeats Zustand equality check | Inline the `plans.find()` expression in the selector |
| 5 | 🟠 Performance | `engine/scheduler.js` | `resourceOverrides` re-sorted on every week iteration per task | Pre-sort once before the week loop |
| 6 | 🟠 Performance | `engine/resourceResolver.js` | `weekResources` re-filtered and re-sorted on every call | Pre-sort once before the scheduling loop |
| 7 | 🟠 Performance | `persistence/shareUrl.js` | Compression computed eagerly for all plans | Skip compression for small payloads (e.g., `json.length < 2000`) |
| 8 | 🟡 Risk | `store/index.js` | Flat store namespace; silent key collision possible | Add dev-mode collision assertion or migrate to TypeScript |
| 9 | 🟡 Risk | `store/uiSlice.js` | Undo stack has no size cap; grows unboundedly in memory | Cap at `MAX_UNDO_STACK = 50` |
| 10 | 🟡 Maintainability | `engine/dependencyGraph.js` | No cycle identification beyond boolean flag | Return `cycleNodes` array for user-facing error messages |
| 11 | 🟡 Maintainability | `persistence/shareUrl.js` | `expandPairs` field name `dayCount` is wrong for resource overrides | Rename to `expandWeekValuePairs` with neutral `value` field |
| 12 | 🟡 Maintainability | `persistence/shareUrl.js` | `compactPairs` is a no-op wrapper over `compactRows` | Remove or differentiate |
| 13 | 🟡 Maintainability | `store/uiSlice.js` | `undoStack`/`redoStack` owned by uiSlice but used by planSlice | Move ownership to planSlice or create a dedicated historySlice |
| 14 | 🟢 Minor | `engine/timeline.js` | `isPastWeek` parses local time, inconsistent across timezones | Document the timezone assumption; use UTC if needed |
| 15 | 🟢 Minor | `persistence/shareUrl.js` | Outdated error message names Chrome/Edge for CompressionStream | Change to "your current browser" |
| 16 | 🟢 Minor | `App.jsx` | No loading state during hydration; no error boundary | Add a loading skeleton and a React Error Boundary |
| 17 | 🟢 Minor | `package.json` | `vite` and `@vitejs/plugin-react` in `dependencies` not `devDependencies` | Move to `devDependencies` |
| 18 | 🟢 Minor | `engine/resourceResolver.js` | `countCategoryVacationDaysForWeek` clamps to `MAX_SAFE_INTEGER` instead of `workdays` | Replace with `Math.min(..., workdays)` |

---

## 9. Recommended Refactors (Priority Order)

1. **Fix the `startingResourceCount` dead-code check** in `updatePlanSettings` — this is a silent correctness bug that rewrites resource data on every settings save.
2. **Fix manual allocation capacity accounting** in `scheduler.js` — mixed manual/auto plans can silently over-schedule weeks.
3. **Replace `JSON.stringify` in `useSchedule`** with a proper Zustand shallow selector — this is the main unnecessary performance cost on every render.
4. **Cap the undo stack** at a fixed size — simple one-liner, prevents long-session memory bloat.
5. **Add dev-mode key collision detection** to the store — prevents future slice authors from introducing silent bugs.
6. **Move `vite` to `devDependencies`** in `package.json` — no behavioral impact but a correctness issue for any downstream tooling.

