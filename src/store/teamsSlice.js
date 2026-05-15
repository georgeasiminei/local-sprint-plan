import { createId } from '../utils/uuid.js';
import { resolveWeekResourceCount } from '../engine/resourceResolver.js';

export function createTeamsSlice(set, get) {
  return {
    addTeam: (team = {}) =>
      get().updateActiveDocument((document) => ({
        ...document,
        teams: [
          ...document.teams,
          {
            id: createId('team', document.teams.map((team) => team.id)),
            name: `Team ${document.teams.length + 1}`,
            ...team,
          },
        ],
      })),
    setWeekResource: (weekResource) =>
      get().updateActiveDocument((document) => {
        const resource = {
          id: weekResource.id ?? `week-resource-${weekResource.teamId}-${weekResource.weekIndex}`,
          ...weekResource,
          resourceCount: Math.max(0, Number(weekResource.resourceCount) || 0),
        };

        return {
          ...document,
          weekResources: [
            ...document.weekResources.filter(
              (item) => item.teamId !== resource.teamId || item.weekIndex < resource.weekIndex,
            ),
            resource,
          ],
        };
      }),
    setWeekResourceForSingleWeek: (weekResource) =>
      get().updateActiveDocument((document) => {
        const resource = {
          id: weekResource.id ?? `week-resource-${weekResource.teamId}-${weekResource.weekIndex}`,
          ...weekResource,
          resourceCount: Math.max(0, Number(weekResource.resourceCount) || 0),
        };
        const nextWeekIndex = resource.weekIndex + 1;
        const fallbackCount = document.plan?.startingResourceCount ?? 0;
        const restoreCount = resolveWeekResourceCount(
          nextWeekIndex,
          resource.teamId,
          document.weekResources,
          fallbackCount,
        );
        const retainedResources = document.weekResources.filter(
          (item) =>
            item.teamId !== resource.teamId ||
            (item.weekIndex !== resource.weekIndex && item.weekIndex !== nextWeekIndex),
        );

        return {
          ...document,
          weekResources: [
            ...retainedResources,
            resource,
            {
              id: `week-resource-${resource.teamId}-${nextWeekIndex}`,
              teamId: resource.teamId,
              weekIndex: nextWeekIndex,
              resourceCount: restoreCount,
            },
          ],
        };
      }),
    setWeekFreeDays: (teamId, weekIndex, freeDayCount) =>
      get().updateActiveDocument((document) => {
        const count = Math.max(0, Math.min(5, Math.floor(Number(freeDayCount) || 0)));
        const retainedFreeDays = document.freedays.filter(
          (freeday) => freeday.teamId !== teamId || freeday.weekIndex !== weekIndex,
        );
        const newFreeDays = Array.from({ length: count }, (_, index) => ({
          id: `freeday-${teamId}-${weekIndex}-${index + 1}`,
          teamId,
          weekIndex,
          date: null,
          reason: 'Week capacity adjustment',
        }));

        return {
          ...document,
          freedays: [...retainedFreeDays, ...newFreeDays],
        };
      }),
  };
}
