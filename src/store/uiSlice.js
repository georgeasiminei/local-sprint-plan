import { isPastWeek } from '../engine/timeline.js';

export function createUiSlice(set, get) {
  return {
    selectedTaskId: null,
    selectedCategoryId: null,
    selectedDependencyId: null,
    selectedExternalDependencyId: null,
    selectedWeekIndex: null,
    selectedTaskIds: [],
    activePanel: 'task',
    isSettingsOpen: false,
    isBulkShiftOpen: false,
    isSidebarOpen: false,
    pendingPastWeekEdit: null,
    undoStack: [],
    redoStack: [],
    selectTask: (taskId) =>
      set({
        selectedTaskId: taskId,
        selectedCategoryId: null,
        selectedDependencyId: null,
        selectedExternalDependencyId: null,
        selectedWeekIndex: null,
        activePanel: 'task',
        isSettingsOpen: false,
        isSidebarOpen: true,
      }),
    selectCategory: (categoryId) =>
      set({
        selectedCategoryId: categoryId,
        selectedTaskId: null,
        selectedDependencyId: null,
        selectedExternalDependencyId: null,
        selectedWeekIndex: null,
        activePanel: 'category',
        isSettingsOpen: false,
        isSidebarOpen: true,
      }),
    selectDependency: (dependencyId) =>
      set({
        selectedDependencyId: dependencyId,
        selectedExternalDependencyId: null,
        selectedTaskId: null,
        selectedCategoryId: null,
        selectedWeekIndex: null,
        activePanel: 'dependency',
        isSettingsOpen: false,
        isSidebarOpen: true,
      }),
    selectExternalDependency: (dependencyId) =>
      set({
        selectedExternalDependencyId: dependencyId,
        selectedDependencyId: null,
        selectedTaskId: null,
        selectedCategoryId: null,
        selectedWeekIndex: null,
        activePanel: 'dependency',
        isSettingsOpen: false,
        isSidebarOpen: true,
      }),
    toggleTaskSelection: (taskId) =>
      set((state) => ({
        selectedTaskIds: state.selectedTaskIds.includes(taskId)
          ? state.selectedTaskIds.filter((id) => id !== taskId)
          : [...state.selectedTaskIds, taskId],
      })),
    clearTaskSelection: () => set({ selectedTaskIds: [] }),
    toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),
    showSettingsPanel: () => set({ activePanel: 'settings', isSettingsOpen: true, isSidebarOpen: true }),
    showTaskPanel: () => set({ activePanel: 'task', isSettingsOpen: false, isSidebarOpen: true }),
    selectWeek: (weekIndex) =>
      set({
        selectedWeekIndex: weekIndex,
        selectedTaskId: null,
        selectedCategoryId: null,
        selectedDependencyId: null,
        selectedExternalDependencyId: null,
        activePanel: 'week',
        isSettingsOpen: false,
        isSidebarOpen: true,
      }),
    showDependencyPanel: () =>
      set({
        activePanel: 'dependency',
        isSettingsOpen: false,
        isSidebarOpen: true,
        selectedDependencyId: null,
        selectedExternalDependencyId: null,
        selectedTaskId: null,
        selectedCategoryId: null,
        selectedWeekIndex: null,
      }),
    openBulkShift: () => set({ isBulkShiftOpen: true }),
    closeBulkShift: () => set({ isBulkShiftOpen: false }),
    toggleSidebar: () => set((state) => ({ isSidebarOpen: !state.isSidebarOpen })),
    closeSidebar: () => set({ isSidebarOpen: false, isSettingsOpen: false }),
    deleteTaskWithGuard: (taskId) => {
      const document = get().getActiveDocument();
      const week = findPastWeekForTask(document, taskId);
      const action = () => {
        get().removeTask(taskId);
        set((state) => ({
          selectedTaskId: state.selectedTaskId === taskId ? null : state.selectedTaskId,
          selectedTaskIds: state.selectedTaskIds.filter((id) => id !== taskId),
          isSidebarOpen: state.selectedTaskId === taskId ? false : state.isSidebarOpen,
        }));
      };

      get().requestWeekEdit(week, action);
    },
    deleteCategoryWithGuard: (categoryId) => {
      const document = get().getActiveDocument();
      const taskIds = new Set((document?.tasks ?? []).filter((task) => task.categoryId === categoryId).map((task) => task.id));
      const week = findPastWeekForTaskIds(document, taskIds);
      const action = () => {
        get().removeCategory(categoryId);
        set((state) => ({
          selectedCategoryId: state.selectedCategoryId === categoryId ? null : state.selectedCategoryId,
          isSidebarOpen: state.selectedCategoryId === categoryId ? false : state.isSidebarOpen,
        }));
      };

      get().requestWeekEdit(week, action);
    },
    deleteExternalDependencyWithGuard: (dependencyId) => {
      const document = get().getActiveDocument();
      const dependency = (document?.externalDependencies ?? []).find((item) => item.id === dependencyId);
      const week = dependency ? findWeekByIndex(document, dependency.dueWeek ?? dependency.endWeek ?? dependency.startWeek) : null;
      const action = () => {
        get().removeExternalDependency(dependencyId);
        set((state) => ({
          selectedExternalDependencyId:
            state.selectedExternalDependencyId === dependencyId ? null : state.selectedExternalDependencyId,
          isSidebarOpen: state.selectedExternalDependencyId === dependencyId ? false : state.isSidebarOpen,
        }));
      };

      get().requestWeekEdit(week, action);
    },
    deleteDependency: (dependencyId) => {
      get().removeDependency(dependencyId);
      set((state) => ({
        selectedDependencyId: state.selectedDependencyId === dependencyId ? null : state.selectedDependencyId,
        isSidebarOpen: state.selectedDependencyId === dependencyId ? false : state.isSidebarOpen,
      }));
    },
    deleteSelectedItem: () => {
      const state = get();
      if (state.selectedTaskId) {
        state.deleteTaskWithGuard(state.selectedTaskId);
        return;
      }

      if (state.selectedCategoryId) {
        state.deleteCategoryWithGuard(state.selectedCategoryId);
        return;
      }

      if (state.selectedExternalDependencyId) {
        state.deleteExternalDependencyWithGuard(state.selectedExternalDependencyId);
        return;
      }

      if (state.selectedDependencyId) {
        state.deleteDependency(state.selectedDependencyId);
      }
    },
    requestWeekEdit: (week, action) => {
      if (isPastWeek(week)) {
        set({ pendingPastWeekEdit: { week, action } });
        return;
      }

      action();
    },
    confirmPastWeekEdit: () => {
      const action = get().pendingPastWeekEdit?.action;
      set({ pendingPastWeekEdit: null });
      action?.();
    },
    cancelPastWeekEdit: () => set({ pendingPastWeekEdit: null }),
    pushUndo: (entry) => set((state) => ({ undoStack: [...state.undoStack, entry], redoStack: [] })),
  };
}

function findPastWeekForTask(document, taskId) {
  return findPastWeekForTaskIds(document, new Set([taskId]));
}

function findPastWeekForTaskIds(document, taskIds) {
  if (!document || taskIds.size === 0) {
    return null;
  }

  const impactedWeekIndexes = [
    ...(document.schedule ?? [])
      .filter((entry) => taskIds.has(entry.taskId))
      .map((entry) => entry.weekIndex),
    ...(document.tasks ?? [])
      .filter((task) => taskIds.has(task.id))
      .flatMap((task) => (task.resourceOverrides ?? []).map((override) => override.weekIndex)),
    ...(document.tasks ?? [])
      .filter((task) => taskIds.has(task.id))
      .map((task) => task.earliestStartWeek ?? document.plan?.startWeek)
      .filter(Boolean),
  ];

  return impactedWeekIndexes
    .map((weekIndex) => findWeekByIndex(document, weekIndex))
    .filter((week) => isPastWeek(week))
    .sort((a, b) => a.weekIndex - b.weekIndex)[0] ?? null;
}

function findWeekByIndex(document, weekIndex) {
  return (document?.weeks ?? []).find((week) => week.weekIndex === weekIndex) ?? null;
}
