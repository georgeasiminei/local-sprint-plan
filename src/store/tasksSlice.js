import { createId } from '../utils/uuid.js';
import { shiftTask } from '../engine/shiftTask.js';
import {
  clearTaskCompletion,
  freezeTaskFromSchedule,
  isTaskCompletionAvailable,
} from '../engine/taskCompletion.js';
import { parseNonNegativeTenths } from '../utils/numbers.js';

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
            vacations: [],
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
        tasks: (tasks) => tasks.map((task) => (task.id === taskId ? { ...task, ...normalizeTaskPatch(patch) } : task)),
      }),
    moveTask: (taskId, direction) =>
      updateDocument(get, {
        tasks: (tasks) => moveTaskInCategory(tasks, taskId, direction),
      }),
    setTaskVacationDays: (taskId, weekIndex, dayCount) =>
      get().updateActiveDocument((document) => ({
        ...document,
        tasks: document.tasks.map((task) =>
          task.id === taskId
            ? {
                ...task,
                vacations: setVacationDays(task.vacations, weekIndex, dayCount),
              }
            : task,
        ),
      })),
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

function setVacationDays(vacations = [], weekIndex, dayCount) {
  const normalizedDayCount = Math.max(0, Math.floor(Number(dayCount) || 0));
  const retained = vacations.filter((vacation) => vacation.weekIndex !== weekIndex);

  if (normalizedDayCount === 0) {
    return retained;
  }

  return [...retained, { weekIndex, dayCount: normalizedDayCount }].sort((a, b) => a.weekIndex - b.weekIndex);
}

function normalizeTaskPatch(patch) {
  const nextPatch = { ...patch };

  if (Object.prototype.hasOwnProperty.call(nextPatch, 'estimateWeeks')) {
    nextPatch.estimateWeeks = parseNonNegativeTenths(nextPatch.estimateWeeks);
  }

  if (Object.prototype.hasOwnProperty.call(nextPatch, 'maxResources') && nextPatch.maxResources !== null) {
    nextPatch.maxResources = parseNonNegativeTenths(nextPatch.maxResources);
  }

  return nextPatch;
}

function moveTaskInCategory(tasks, taskId, direction) {
  const task = tasks.find((item) => item.id === taskId);
  if (!task) {
    return tasks;
  }

  const categoryId = task.categoryId ?? null;
  const siblings = tasks.filter((item) => (item.categoryId ?? null) === categoryId);
  const siblingIndex = siblings.findIndex((item) => item.id === taskId);
  const targetSiblingIndex = siblingIndex + (direction === 'up' ? -1 : 1);

  if (siblingIndex < 0 || targetSiblingIndex < 0 || targetSiblingIndex >= siblings.length) {
    return tasks;
  }

  const targetTask = siblings[targetSiblingIndex];
  const nextTasks = [...tasks];
  const sourceIndex = nextTasks.findIndex((item) => item.id === task.id);
  const targetIndex = nextTasks.findIndex((item) => item.id === targetTask.id);
  nextTasks[sourceIndex] = targetTask;
  nextTasks[targetIndex] = task;

  return nextTasks.map((item, index) => ({ ...item, priority: index + 1 }));
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
