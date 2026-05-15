import { create } from 'zustand';
import { createPlanSlice } from './planSlice.js';
import { createTasksSlice } from './tasksSlice.js';
import { createCategoriesSlice } from './categoriesSlice.js';
import { createDependenciesSlice } from './dependenciesSlice.js';
import { createSprintsSlice } from './sprintsSlice.js';
import { createWeeksSlice } from './weeksSlice.js';
import { createTeamsSlice } from './teamsSlice.js';
import { createScheduleSlice } from './scheduleSlice.js';
import { createUiSlice } from './uiSlice.js';

export const useTimelineStore = create((set, get) => {
  const slices = [
    createPlanSlice(set, get),
    createTasksSlice(set, get),
    createCategoriesSlice(set, get),
    createDependenciesSlice(set, get),
    createSprintsSlice(set, get),
    createWeeksSlice(set, get),
    createTeamsSlice(set, get),
    createScheduleSlice(set, get),
    createUiSlice(set, get),
  ];

  assertNoKeyCollisions(slices);
  return Object.assign({}, ...slices);
});

function assertNoKeyCollisions(slices) {
  const seen = new Set();

  for (const slice of slices) {
    for (const key of Object.keys(slice)) {
      if (seen.has(key)) {
        throw new Error(`Store key collision: "${key}"`);
      }
      seen.add(key);
    }
  }
}
