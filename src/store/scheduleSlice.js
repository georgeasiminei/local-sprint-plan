import { recalculateSchedule } from '../engine/scheduler.js';

export function createScheduleSlice(set, get) {
  return {
    scheduleWarnings: [],
    setManualAllocation: (taskId, weekIndex, allocatedUnits) => {
      get().updateActiveDocument((document) => {
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

      const result = recalculateSchedule(document);
      get().updateActiveDocument(
        (current) => ({
          ...current,
          tasks: result.tasks ?? current.tasks,
          weeks: result.weeks ?? current.weeks,
          sprints: result.sprints ?? current.sprints,
          schedule: result.schedule,
        }),
        { skipTouch: true, skipSaveStatus: true, skipUndo: true },
      );
      set({ scheduleWarnings: result.warnings });
    },
  };
}
