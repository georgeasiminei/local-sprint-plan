import { createId } from '../utils/uuid.js';
import { shiftTask } from '../engine/shiftTask.js';
import {
  clearTaskCompletion,
  freezeTaskFromSchedule,
  isTaskCompletionAvailable,
} from '../engine/taskCompletion.js';

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
        isSidebarOpen: true,
      });
      return id;
    },
    updateTask: (taskId, patch) =>
      updateDocument(get, {
        tasks: (tasks) => tasks.map((task) => (task.id === taskId ? { ...task, ...patch } : task)),
      }),
    setTaskCompleted: (taskId, completed) =>
      get().updateActiveDocument((document) => ({
        ...document,
        tasks: document.tasks.map((task) => {
          if (task.id !== taskId) {
            return task;
          }

          if (!completed) {
            return clearTaskCompletion(task);
          }

          if (!isTaskCompletionAvailable(document, taskId)) {
            return task;
          }

          return freezeTaskFromSchedule(task, document.schedule);
        }),
        schedule: completed
          ? document.schedule.filter((entry) => !(entry.taskId === taskId && entry.isManual))
          : document.schedule,
      })),
    removeTask: (taskId) =>
      updateDocument(get, {
        tasks: (tasks) => tasks.filter((task) => task.id !== taskId),
        dependencies: (dependencies) =>
          dependencies.filter(
            (item) =>
              !((item.predecessorType ?? 'task') === 'task' && item.predecessorId === taskId) &&
              !((item.successorType ?? 'task') === 'task' && item.successorId === taskId),
          ),
        schedule: (schedule) => schedule.filter((item) => item.taskId !== taskId),
      }),
    shiftTask: (taskId, weekDelta) =>
      get().updateActiveDocument((document) => ({
        ...document,
        tasks: shiftTask(document.tasks, taskId, Number(weekDelta) || 0, document.plan.startWeek ?? 1),
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
