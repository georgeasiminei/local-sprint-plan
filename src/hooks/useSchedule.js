import { useEffect } from 'react';
import { useTimelineStore } from '../store/index.js';

export function useSchedule() {
  const activePlanId = useTimelineStore((state) => state.activePlanId);
  const document = useTimelineStore((state) => state.getActiveDocument());
  const recalculateActiveSchedule = useTimelineStore((state) => state.recalculateActiveSchedule);
  const scheduleInputs = document
    ? JSON.stringify({
        plan: {
          startYear: document.plan?.startYear,
          startWeek: document.plan?.startWeek,
          sprintStartNumber: document.plan?.sprintStartNumber,
          sprintStartOrder: document.plan?.sprintStartOrder,
          startingResourceCount: document.plan?.startingResourceCount,
          vacations: document.plan?.vacations,
        },
        categories: document.categories,
        tasks: document.tasks,
        dependencies: document.dependencies,
        externalDependencies: document.externalDependencies,
        weeks: document.weeks,
        teams: document.teams,
        freedays: document.freedays,
        weekResources: document.weekResources,
      })
    : '';

  useEffect(() => {
    if (activePlanId) {
      recalculateActiveSchedule();
    }
  }, [activePlanId, scheduleInputs, recalculateActiveSchedule]);
}
