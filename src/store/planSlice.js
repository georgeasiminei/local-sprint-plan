import {
  DEFAULT_PLAN_NAME,
  DEFAULT_ROW_HEIGHT,
  DEFAULT_WEEK_COLUMN_WIDTH,
  MAX_VALID_START_YEAR,
  MIN_VALID_START_YEAR,
} from '../constants/defaults.js';
import { PLANNING_WEEKS_PER_YEAR } from '../engine/timeline.js';
import { createPlanDocument } from '../persistence/schema.js';
import { parseNonNegativeTenths } from '../utils/numbers.js';

const MAX_UNDO_STACK = 50;

// Fields the UI selects/edits/holds open. hydratePlan (loading a snapshot, a JSON file,
// or a fresh URL) must reset all of them - ids are re-derived positionally on every
// load, so a stale selection from the previous plan can otherwise point at a completely
// unrelated entity in the new one.
const SELECTION_RESET = {
  selectedTaskId: null,
  selectedTaskWeekIndex: null,
  selectedCategoryId: null,
  selectedDependencyId: null,
  selectedExternalDependencyId: null,
  hoveredExternalDependencyId: null,
  selectedWeekIndex: null,
  editingResourceCell: null,
  pendingPastWeekEdit: null,
  isShiftTaskOpen: false,
  isSidebarOpen: false,
};

export function createPlanSlice(set, get) {
  return {
    activePlanId: null,
    plans: [],
    saveStatus: 'saved',
    importError: null,
    hasHydrated: false,
    savedPlanId: null,
    savedPlanName: null,
    // Owned here alongside undo()/redo()/updateActiveDocument() - previously this
    // initial state lived in uiSlice.js while all the logic that reads and writes it
    // lived here, which is exactly the kind of state/logic split that lets a
    // uiSlice-local action (the old pushUndo) bypass the 50-entry cap.
    undoStack: [],
    redoStack: [],

    hydratePlan: (document, options = {}) => {
      set({
        plans: [document],
        activePlanId: document.plan.id,
        saveStatus: 'url updated',
        importError: null,
        hasHydrated: true,
        hasAppliedAutoCompletion: false,
        savedPlanId: options.savedPlanId ?? null,
        savedPlanName: options.savedPlanName ?? null,
        undoStack: [],
        redoStack: [],
        ...SELECTION_RESET,
      });
    },

    createPlan: (name = DEFAULT_PLAN_NAME, options = {}) => {
      const document = createPlanDocument({ name, ...options });

      // Reset undo/redo and selection exactly like hydratePlan: this replaces the
      // active document with a different plan.id, and stale undo/redo entries or a
      // selection from the previous plan would otherwise reference an id that no
      // longer resolves under the new one.
      set(() => ({
        activePlanId: document.plan.id,
        plans: [document],
        saveStatus: 'unsaved',
        hasAppliedAutoCompletion: false,
        savedPlanId: null,
        savedPlanName: null,
        undoStack: [],
        redoStack: [],
        ...SELECTION_RESET,
      }));

      return document.plan.id;
    },

    updatePlanSettings: (patch) => {
      get().updateActiveDocument((document) => {
        const currentStartWeek = document.plan.startWeek ?? document.weeks[0]?.weekIndex ?? 1;
        const currentStartYear = document.plan.startYear ?? document.weeks[0]?.weekYear ?? new Date().getFullYear();
        const nextStartWeek =
          patch.startWeek !== undefined
            ? clampInteger(patch.startWeek, 1, PLANNING_WEEKS_PER_YEAR, currentStartWeek)
            : currentStartWeek;
        const nextStartYear =
          patch.startYear !== undefined
            ? clampInteger(patch.startYear, MIN_VALID_START_YEAR, MAX_VALID_START_YEAR, currentStartYear)
            : currentStartYear;
        const startWeekDelta = nextStartWeek - currentStartWeek;
        const startingResourceCount =
          patch.startingResourceCount !== undefined
            ? parseNonNegativeTenths(patch.startingResourceCount)
            : (document.plan.startingResourceCount ?? document.weekResources[0]?.resourceCount ?? 0);
        const firstTeamId = document.teams[0]?.id;
        const shiftedWeekResources =
          startWeekDelta === 0
            ? document.weekResources
            : document.weekResources.map((resource) => ({
                ...resource,
                weekIndex: resource.weekIndex + startWeekDelta,
              }));
        const weekResources =
          patch.startingResourceCount === undefined || !firstTeamId
            ? shiftedWeekResources
            : [
                ...shiftedWeekResources.filter(
                  (resource) => resource.teamId !== firstTeamId || resource.weekIndex !== nextStartWeek,
                ),
                {
                  id:
                    shiftedWeekResources.find(
                      (resource) => resource.teamId === firstTeamId && resource.weekIndex === nextStartWeek,
                    )?.id ?? `week-resource-${firstTeamId}-${nextStartWeek}`,
                  teamId: firstTeamId,
                  weekIndex: nextStartWeek,
                  resourceCount: startingResourceCount,
                },
              ];

        return {
          ...document,
          plan: {
            ...document.plan,
            ...patch,
            startYear: nextStartYear,
            startWeek: nextStartWeek,
            sprintStartNumber:
              patch.sprintStartNumber === undefined
                ? (document.plan.sprintStartNumber ?? 1)
                : Math.max(1, Number(patch.sprintStartNumber) || 1),
            sprintStartOrder:
              patch.sprintStartOrder === undefined
                ? (document.plan.sprintStartOrder ?? 1)
                : Math.max(1, Number(patch.sprintStartOrder) || 1),
            startingResourceCount,
            rowHeight:
              patch.rowHeight === undefined
                ? (document.plan.rowHeight ?? DEFAULT_ROW_HEIGHT)
                : Math.max(16, Math.min(48, Math.round(Number(patch.rowHeight) || DEFAULT_ROW_HEIGHT))),
            weekColumnWidth:
              patch.weekColumnWidth === undefined
                ? (document.plan.weekColumnWidth ?? DEFAULT_WEEK_COLUMN_WIDTH)
                : Math.max(24, Math.min(120, Math.round(Number(patch.weekColumnWidth) || DEFAULT_WEEK_COLUMN_WIDTH))),
            vacations:
              startWeekDelta === 0
                ? (document.plan.vacations ?? [])
                : (document.plan.vacations ?? []).map((vacation) => ({
                    ...vacation,
                    weekIndex: shiftWeekIndex(vacation.weekIndex, startWeekDelta),
                  })),
          },
          // Every week-indexed collection in the document shifts together. Previously
          // only some of these moved (resource overrides, completed intervals, external
          // due weeks, week resources, free days) while task/category/plan vacations,
          // shift-rule anchors, and manual schedule rows stayed at their old absolute
          // week index - silently detaching them from the rest of the plan.
          tasks:
            startWeekDelta === 0
              ? document.tasks
              : document.tasks.map((task) => ({
                  ...task,
                  earliestStartWeek: task.earliestStartWeek ? task.earliestStartWeek + startWeekDelta : task.earliestStartWeek,
                  resourceOverrides: (task.resourceOverrides ?? []).map((override) => ({
                    ...override,
                    weekIndex: shiftWeekIndex(override.weekIndex, startWeekDelta),
                  })),
                  completedIntervals: (task.completedIntervals ?? []).map((interval) => ({
                    ...interval,
                    startWeek: shiftWeekIndex(interval.startWeek, startWeekDelta),
                    endWeek: shiftWeekIndex(interval.endWeek ?? interval.startWeek, startWeekDelta),
                  })),
                  vacations: (task.vacations ?? []).map((vacation) => ({
                    ...vacation,
                    weekIndex: shiftWeekIndex(vacation.weekIndex, startWeekDelta),
                  })),
                  shiftRules: (task.shiftRules ?? []).map((rule) => ({
                    ...rule,
                    anchorWeekIndex: shiftWeekIndex(rule.anchorWeekIndex, startWeekDelta),
                    firstShiftedWeek: shiftWeekIndex(rule.firstShiftedWeek, startWeekDelta),
                    sourceEntries: (rule.sourceEntries ?? []).map((entry) => ({
                      ...entry,
                      weekIndex: shiftWeekIndex(entry.weekIndex, startWeekDelta),
                    })),
                  })),
                })),
          categories:
            startWeekDelta === 0
              ? document.categories
              : document.categories.map((category) => ({
                  ...category,
                  vacations: (category.vacations ?? []).map((vacation) => ({
                    ...vacation,
                    weekIndex: shiftWeekIndex(vacation.weekIndex, startWeekDelta),
                  })),
                })),
          externalDependencies:
            startWeekDelta === 0
              ? (document.externalDependencies ?? [])
              : (document.externalDependencies ?? []).map((dependency) => ({
                  ...dependency,
                  dueWeek: shiftWeekIndex(dependency.dueWeek ?? dependency.endWeek ?? dependency.startWeek, startWeekDelta),
                })),
          freedays:
            startWeekDelta === 0
              ? document.freedays
              : document.freedays.map((freeday) => ({
                  ...freeday,
                  weekIndex: freeday.weekIndex ? shiftWeekIndex(freeday.weekIndex, startWeekDelta) : freeday.weekIndex,
                })),
          schedule:
            startWeekDelta === 0
              ? document.schedule
              : (document.schedule ?? []).map((entry) => ({
                  ...entry,
                  weekIndex: shiftWeekIndex(entry.weekIndex, startWeekDelta),
                })),
          weekResources,
        };
      });
    },

    setPlanVacationDays: (weekIndex, dayCount) =>
      get().updateActiveDocument((document) => ({
        ...document,
        plan: {
          ...document.plan,
          vacations: setVacationDays(document.plan?.vacations, weekIndex, dayCount),
        },
      })),

    setSprintNumber: (sprintOrder, sprintNumber) =>
      get().updatePlanSettings({
        sprintStartOrder: Math.max(1, Number(sprintOrder) || 1),
        sprintStartNumber: Math.max(1, Number(sprintNumber) || 1),
      }),

    setImportError: (message) => set({ importError: message }),
    setSaveStatus: (saveStatus) => set({ saveStatus }),
    setSavedPlan: ({ id, name }) => set({ savedPlanId: id, savedPlanName: name }),

    getActiveDocument: () => get().plans.find((document) => document.plan.id === get().activePlanId),

    undo: () => {
      const activePlanId = get().activePlanId;
      set((state) => {
        const previousDocument = state.undoStack[state.undoStack.length - 1];
        const currentDocument = state.plans.find((document) => document.plan.id === activePlanId);
        if (!previousDocument || !currentDocument) {
          return state;
        }

        return {
          plans: state.plans.map((document) =>
            document.plan.id === activePlanId ? previousDocument : document,
          ),
          undoStack: state.undoStack.slice(0, -1),
          redoStack: [...state.redoStack, currentDocument],
          saveStatus: 'unsaved',
          // The restored document can be missing whatever the undone action added
          // (e.g. undoing "add task" while that task's panel is open) - clear only the
          // selection fields that no longer resolve, rather than the whole selection.
          ...sanitizeSelectionForDocument(state, previousDocument),
        };
      });
    },

    redo: () => {
      const activePlanId = get().activePlanId;
      set((state) => {
        const nextDocument = state.redoStack[state.redoStack.length - 1];
        const currentDocument = state.plans.find((document) => document.plan.id === activePlanId);
        if (!nextDocument || !currentDocument) {
          return state;
        }

        return {
          plans: state.plans.map((document) =>
            document.plan.id === activePlanId ? nextDocument : document,
          ),
          redoStack: state.redoStack.slice(0, -1),
          undoStack: [...state.undoStack, currentDocument].slice(-MAX_UNDO_STACK),
          saveStatus: 'unsaved',
          ...sanitizeSelectionForDocument(state, nextDocument),
        };
      });
    },

    updateActiveDocument: (updater, options = {}) => {
      const activePlanId = get().activePlanId;
      set((state) => {
        const previousDocument = state.plans.find((document) => document.plan.id === activePlanId);
        const updatedDocument = previousDocument ? updater(previousDocument) : previousDocument;
        // A no-op edit (a rejected duplicate dependency, a boundary-clamped move, a
        // manual allocation on a completed task, ...) must not push an undo entry or
        // wipe the redo stack - otherwise a rejected action silently destroys whatever
        // the user had just un-done.
        if (!previousDocument || updatedDocument === previousDocument) {
          return state;
        }

        return updateActiveDocumentState(state, activePlanId, updatedDocument, options);
      });
    },
  };
}

function updateActiveDocumentState(state, activePlanId, updatedDocument, options) {
  return {
    ...state,
    plans: state.plans.map((document) =>
      document.plan.id === activePlanId
        ? options.skipTouch
          ? updatedDocument
          : touchDocument(updatedDocument)
        : document,
    ),
    undoStack:
      options.skipUndo || options.skipSaveStatus
        ? state.undoStack
        : [...state.undoStack, state.plans.find((document) => document.plan.id === activePlanId)]
            .filter(Boolean)
            .slice(-MAX_UNDO_STACK),
    redoStack: options.skipUndo || options.skipSaveStatus ? state.redoStack : [],
    saveStatus: options.skipSaveStatus ? state.saveStatus : 'unsaved',
  };
}

// Nulls out only the selection fields that no longer resolve against `document` -
// used after undo/redo swaps in a different document version. Deliberately narrower
// than hydratePlan's full SELECTION_RESET: undo/redo should not clear a selection that
// is still valid just because something else changed.
function sanitizeSelectionForDocument(state, document) {
  if (!document) {
    return {};
  }

  const taskIds = new Set((document.tasks ?? []).map((task) => task.id));
  const categoryIds = new Set((document.categories ?? []).map((category) => category.id));
  const dependencyIds = new Set((document.dependencies ?? []).map((dependency) => dependency.id));
  const externalDependencyIds = new Set(
    (document.externalDependencies ?? []).map((dependency) => dependency.id),
  );
  const patch = {};

  if (state.selectedTaskId && !taskIds.has(state.selectedTaskId)) {
    patch.selectedTaskId = null;
    patch.selectedTaskWeekIndex = null;
  }

  if (state.selectedCategoryId && !categoryIds.has(state.selectedCategoryId)) {
    patch.selectedCategoryId = null;
  }

  if (state.selectedDependencyId && !dependencyIds.has(state.selectedDependencyId)) {
    patch.selectedDependencyId = null;
  }

  if (state.selectedExternalDependencyId && !externalDependencyIds.has(state.selectedExternalDependencyId)) {
    patch.selectedExternalDependencyId = null;
  }

  if (state.editingResourceCell && !taskIds.has(state.editingResourceCell.taskId)) {
    patch.editingResourceCell = null;
  }

  return patch;
}

function clampInteger(value, min, max, fallback) {
  const parsed = Math.round(Number(value));
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(max, Math.max(min, parsed));
}

function shiftWeekIndex(weekIndex, delta) {
  return Math.max(1, weekIndex + delta);
}

function setVacationDays(vacations = [], weekIndex, dayCount) {
  const normalizedDayCount = parseNonNegativeTenths(dayCount);
  const retained = vacations.filter((vacation) => vacation.weekIndex !== weekIndex);

  if (normalizedDayCount === 0) {
    return retained;
  }

  return [...retained, { weekIndex, dayCount: normalizedDayCount }].sort((a, b) => a.weekIndex - b.weekIndex);
}

function touchDocument(document) {
  return {
    ...document,
    plan: {
      ...document.plan,
      updatedAt: new Date().toISOString(),
    },
  };
}
