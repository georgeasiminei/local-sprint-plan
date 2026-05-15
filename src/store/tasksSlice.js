import { createId } from '../utils/uuid.js';
import { shiftTasks } from '../engine/shiftTasks.js';

export function createTasksSlice(set, get) {
  return {
    addTask: (task = {}) => {
      const document = get().getActiveDocument();
      const id = createId('task', (document?.tasks ?? []).map((taskItem) => taskItem.id));

      updateDocument(get, {
        tasks: (tasks) => [
            ...tasks,
            {
            id,
            categoryId: null,
            name: 'Untitled task',
            priority: tasks.length + 1,
            estimateWeeks: 1,
            calcWeeks: 0,
            highlightColor: null,
            notes: '',
            earliestStartWeek: null,
            maxResources: null,
            resourceOverrides: [],
            ...task,
          },
        ],
      });

      set({
        selectedTaskId: id,
        selectedCategoryId: null,
        selectedDependencyId: null,
        selectedExternalDependencyId: null,
        selectedWeekIndex: null,
        activePanel: 'task',
        isSettingsOpen: false,
        isSidebarOpen: true,
      });
      return id;
    },
    updateTask: (taskId, patch) =>
      updateDocument(get, {
        tasks: (tasks) => tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
      }),
    removeTask: (taskId) =>
      updateDocument(get, {
        tasks: (tasks) => tasks.filter((task) => task.id !== taskId),
        dependencies: (dependencies) =>
          dependencies.filter((item) => item.predecessorId !== taskId && item.successorId !== taskId),
        schedule: (schedule) => schedule.filter((item) => item.taskId !== taskId),
      }),
    bulkShiftTasks: (taskIds, weekDelta) =>
      get().updateActiveDocument((document) => ({
        ...document,
        tasks: shiftTasks(document.tasks, taskIds, Number(weekDelta) || 0, document.plan.startWeek ?? 1),
      })),
  };
}

function updateDocument(get, transforms) {
  get().updateActiveDocument((document) => applyTransforms(document, transforms));
}

function applyTransforms(document, transforms) {
  return Object.entries(transforms).reduce(
    (next, [key, transform]) => ({ ...next, [key]: transform(next[key] ?? []) }),
    document,
  );
}
