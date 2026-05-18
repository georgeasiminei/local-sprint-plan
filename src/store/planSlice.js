import { DEFAULT_PLAN_NAME, DEFAULT_ROW_HEIGHT, DEFAULT_WEEK_COLUMN_WIDTH } from '../constants/defaults.js';
import { createPlanDocument } from '../persistence/schema.js';

const MAX_UNDO_STACK = 50;

export function createPlanSlice(set, get) {
  return {
    activePlanId: null,
    plans: [],
    saveStatus: 'saved',
    importError: null,
    hasHydrated: false,
    savedPlanId: null,
    savedPlanName: null,

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
      });
    },

    createPlan: (name = DEFAULT_PLAN_NAME, options = {}) => {
      const document = createPlanDocument({ name, ...options });

      set(() => ({
        activePlanId: document.plan.id,
        plans: [document],
        saveStatus: 'unsaved',
        hasAppliedAutoCompletion: false,
        savedPlanId: null,
        savedPlanName: null,
      }));

      return document.plan.id;
    },

    setActivePlan: (planId) => {
      if (planId === null) {
        return;
      }

      if (!get().plans.some((document) => document.plan.id === planId)) {
        return;
      }

      set({ activePlanId: planId, saveStatus: 'unsaved' });
    },

    renamePlan: (planId, name) => {
      const nextName = name.trim();
      if (!nextName) {
        return;
      }

      set((state) => ({
        plans: state.plans.map((document) =>
          document.plan.id === planId
            ? touchDocument({ ...document, plan: { ...document.plan, name: nextName } })
            : document,
        ),
        saveStatus: 'unsaved',
      }));
    },

    renameActivePlan: (name) => {
      const activePlanId = get().activePlanId;
      if (activePlanId) {
        get().renamePlan(activePlanId, name);
      }
    },

    updatePlanSettings: (patch) => {
      get().updateActiveDocument((document) => {
        const currentStartWeek = document.plan.startWeek ?? document.weeks[0]?.weekIndex ?? 1;
        const currentStartYear = document.plan.startYear ?? document.weeks[0]?.weekYear ?? new Date().getFullYear();
        const nextStartWeek =
          patch.startWeek !== undefined ? Math.max(1, Number(patch.startWeek) || currentStartWeek) : currentStartWeek;
        const nextStartYear =
          patch.startYear !== undefined ? Math.max(1, Number(patch.startYear) || currentStartYear) : currentStartYear;
        const startWeekDelta = nextStartWeek - currentStartWeek;
        const startingResourceCount =
          patch.startingResourceCount !== undefined
            ? Math.max(0, Number(patch.startingResourceCount) || 0)
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
          },
          tasks:
            startWeekDelta === 0
              ? document.tasks
              : document.tasks.map((task) => ({
                  ...task,
                  earliestStartWeek: task.earliestStartWeek ? task.earliestStartWeek + startWeekDelta : task.earliestStartWeek,
                  resourceOverrides: (task.resourceOverrides ?? []).map((override) => ({
                    ...override,
                    weekIndex: Math.max(1, override.weekIndex + startWeekDelta),
                  })),
                  completedIntervals: (task.completedIntervals ?? []).map((interval) => ({
                    ...interval,
                    startWeek: Math.max(1, interval.startWeek + startWeekDelta),
                    endWeek: Math.max(1, (interval.endWeek ?? interval.startWeek) + startWeekDelta),
                  })),
                })),
          externalDependencies:
            startWeekDelta === 0
              ? (document.externalDependencies ?? [])
              : (document.externalDependencies ?? []).map((dependency) => ({
                  ...dependency,
                  dueWeek: Math.max(1, (dependency.dueWeek ?? dependency.endWeek ?? dependency.startWeek) + startWeekDelta),
                })),
          freedays:
            startWeekDelta === 0
              ? document.freedays
              : document.freedays.map((freeday) => ({
                  ...freeday,
                  weekIndex: freeday.weekIndex ? freeday.weekIndex + startWeekDelta : freeday.weekIndex,
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
        };
      });
    },

    updateActiveDocument: (updater, options = {}) => {
      const activePlanId = get().activePlanId;
      set((state) => ({
        ...state,
        plans: state.plans.map((document) => {
          if (document.plan.id !== activePlanId) {
            return document;
          }

          const updated = updater(document);
          return options.skipTouch ? updated : touchDocument(updated);
        }),
        undoStack:
          options.skipUndo || options.skipSaveStatus
            ? state.undoStack
            : [...state.undoStack, state.plans.find((document) => document.plan.id === activePlanId)]
                .filter(Boolean)
                .slice(-MAX_UNDO_STACK),
        redoStack: options.skipUndo || options.skipSaveStatus ? state.redoStack : [],
        saveStatus: options.skipSaveStatus ? state.saveStatus : 'unsaved',
      }));
    },
  };
}

function setVacationDays(vacations = [], weekIndex, dayCount) {
  const normalizedDayCount = Math.max(0, Math.floor(Number(dayCount) || 0));
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
