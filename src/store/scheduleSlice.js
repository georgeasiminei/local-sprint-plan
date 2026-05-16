import { recalculateSchedule } from '../engine/scheduler.js';
import {
  clearTaskCompletion,
  freezeTaskFromSchedule,
  isTaskCompletionAvailable,
  shouldAutoCompleteTask,
} from '../engine/taskCompletion.js';

export function createScheduleSlice(set, get) {
  return {
    scheduleWarnings: [],
    hasAppliedAutoCompletion: false,
    setManualAllocation: (taskId, weekIndex, allocatedUnits) => {
      get().updateActiveDocument((document) => {
        if (document.tasks.some((task) => task.id === taskId && task.completed)) {
          return document;
        }

        const nextSchedule = document.schedule.filter(
          (entry) => !(entry.taskId === taskId && entry.weekIndex === weekIndex),
        );
        const value = Number(allocatedUnits);

        if (Number.isFinite(value) && value > 0) {
          nextSchedule.push({
            taskId,
            weekIndex,
            allocatedUnits: Math.round(value * 100) / 100,
            isManual: true,
          });
        }

        return {
          ...document,
          schedule: nextSchedule,
        };
      });
    },
    setTaskResourceFromWeek: (taskId, weekIndex, allocatedUnits) => {
      get().updateActiveDocument((document) => {
        if (document.tasks.some((task) => task.id === taskId && task.completed)) {
          return document;
        }

        const value = Number(allocatedUnits);
        const hasValue = Number.isFinite(value) && value > 0;

        return {
          ...document,
          tasks: document.tasks.map((task) => {
            if (task.id !== taskId) {
              return task;
            }

            const previousOverrides = (task.resourceOverrides ?? []).filter(
              (override) => override.weekIndex !== weekIndex,
            );

            return {
              ...task,
              resourceOverrides: hasValue
                ? [
                    ...previousOverrides,
                    {
                      weekIndex,
                      allocatedUnits: Math.round(value * 100) / 100,
                    },
                  ].sort((a, b) => a.weekIndex - b.weekIndex)
                : previousOverrides,
            };
          }),
          schedule: document.schedule.filter(
            (entry) => !(entry.taskId === taskId && entry.weekIndex >= weekIndex && entry.isManual),
          ),
        };
      });
    },
    recalculateActiveSchedule: () => {
      const document = get().getActiveDocument();
      if (!document) {
        return;
      }

      let sourceDocument = document;
      let result = recalculateSchedule(sourceDocument);
      const maintenance = buildCompletionMaintenance(
        {
          ...sourceDocument,
          tasks: result.tasks ?? sourceDocument.tasks,
          weeks: result.weeks ?? sourceDocument.weeks,
          schedule: result.schedule,
        },
        !get().hasAppliedAutoCompletion,
      );

      if (maintenance.changed) {
        sourceDocument = {
          ...sourceDocument,
          tasks: maintenance.tasks,
          schedule: sourceDocument.schedule.filter(
            (entry) => !maintenance.newlyCompletedTaskIds.has(entry.taskId),
          ),
        };
        result = recalculateSchedule(sourceDocument);
      }

      get().updateActiveDocument(
        (current) => ({
          ...current,
          tasks: result.tasks ?? current.tasks,
          weeks: result.weeks ?? current.weeks,
          sprints: result.sprints ?? current.sprints,
          schedule: result.schedule,
        }),
        maintenance.changed
          ? { skipUndo: true }
          : { skipTouch: true, skipSaveStatus: true, skipUndo: true },
      );
      set({ scheduleWarnings: result.warnings, hasAppliedAutoCompletion: true });
    },
  };
}

function buildCompletionMaintenance(document, shouldAutoComplete) {
  const newlyCompletedTaskIds = new Set();
  let changed = false;
  const tasks = document.tasks.map((task) => {
    if (task.completed && !isTaskCompletionAvailable(document, task.id)) {
      changed = true;
      return clearTaskCompletion(task);
    }

    if (!task.completed && shouldAutoComplete && shouldAutoCompleteTask(document, task.id)) {
      const frozen = freezeTaskFromSchedule(task, document.schedule);
      if (frozen !== task) {
        changed = true;
        newlyCompletedTaskIds.add(task.id);
        return frozen;
      }
    }

    return task;
  });

  return { changed, tasks, newlyCompletedTaskIds };
}
