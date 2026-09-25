import { useEffect, useMemo } from 'react';
import { useTimelineStore } from '../store/index.js';

export function useSchedule() {
  const activePlanId = useTimelineStore((state) => state.activePlanId);
  const document = useTimelineStore((state) => state.getActiveDocument());
  const recalculateActiveSchedule = useTimelineStore((state) => state.recalculateActiveSchedule);
  const scheduleInputs = useMemo(() => (document ? JSON.stringify(buildScheduleInputs(document)) : ''), [document]);

  useEffect(() => {
    if (activePlanId) {
      recalculateActiveSchedule();
    }
  }, [activePlanId, scheduleInputs, recalculateActiveSchedule]);
}

// Projects a document down to exactly the fields src/engine/scheduler.js reads, so the
// effect above only re-runs when a scheduling *input* actually changed. Two mistakes
// this fixes:
//  - Display-only fields (task name/notes/highlightColor/status, category
//    name/color/order/collapsed) used to be included wholesale, so every keystroke in
//    a task's name or notes field triggered a full schedule recalculation.
//  - Scheduler *outputs* (document.weeks, task.calcWeeks) used to be included too, so
//    every edit ran the scheduler twice: the first run wrote new weeks/calcWeeks, which
//    changed this key, which re-ran the effect a second time for the same edit.
// One thing the previous version silently got wrong in the other direction: manual
// (isManual) schedule entries were not represented here at all, so setting a manual
// allocation in one week did not re-trigger recalculation of the *other* tasks
// competing for that same week's capacity until some unrelated field also changed.
function buildScheduleInputs(document) {
  return {
    plan: {
      startYear: document.plan?.startYear,
      startWeek: document.plan?.startWeek,
      sprintStartNumber: document.plan?.sprintStartNumber,
      sprintStartOrder: document.plan?.sprintStartOrder,
      startingResourceCount: document.plan?.startingResourceCount,
      vacations: document.plan?.vacations,
    },
    categories: (document.categories ?? []).map((category) => ({
      id: category.id,
      vacations: category.vacations,
    })),
    tasks: (document.tasks ?? []).map((task) => ({
      id: task.id,
      categoryId: task.categoryId,
      priority: task.priority,
      estimateWeeks: task.estimateWeeks,
      earliestStartWeek: task.earliestStartWeek,
      maxResources: task.maxResources,
      completed: task.completed,
      completedIntervals: task.completedIntervals,
      resourceOverrides: task.resourceOverrides,
      vacations: task.vacations,
      shiftRules: task.shiftRules,
    })),
    dependencies: document.dependencies,
    externalDependencies: (document.externalDependencies ?? []).map((dependency) => ({
      id: dependency.id,
      dueWeek: dependency.dueWeek,
      endWeek: dependency.endWeek,
      startWeek: dependency.startWeek,
    })),
    teams: (document.teams ?? []).map((team) => ({ id: team.id })),
    freedays: document.freedays,
    weekResources: document.weekResources,
    manualSchedule: (document.schedule ?? [])
      .filter((entry) => entry.isManual)
      .map((entry) => ({
        taskId: entry.taskId,
        weekIndex: entry.weekIndex,
        allocatedUnits: entry.allocatedUnits,
        rawAllocatedUnits: entry.rawAllocatedUnits,
      })),
  };
}
