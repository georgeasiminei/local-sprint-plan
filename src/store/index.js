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

export const useTimelineStore = create((set, get) => ({
  ...createPlanSlice(set, get),
  ...createTasksSlice(set, get),
  ...createCategoriesSlice(set, get),
  ...createDependenciesSlice(set, get),
  ...createSprintsSlice(set, get),
  ...createWeeksSlice(set, get),
  ...createTeamsSlice(set, get),
  ...createScheduleSlice(set, get),
  ...createUiSlice(set, get),
}));
