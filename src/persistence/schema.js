import { SCHEMA_VERSION } from '../constants/schemaVersion.js';
import { DEFAULT_PLAN_NAME, DEFAULT_RESOURCE_COUNT, DEFAULT_ROW_HEIGHT, DEFAULT_START_WEEK, DEFAULT_START_YEAR, DEFAULT_WEEK_COLUMN_WIDTH, MIN_VISIBLE_WEEKS } from '../constants/defaults.js';
import { buildCalculatedWeeks, buildFixedSprints } from '../engine/timeline.js';
import { createId } from '../utils/uuid.js';

export const PLAN_SCHEMA_VERSION = SCHEMA_VERSION;

export const emptyPlanDocument = {
  version: PLAN_SCHEMA_VERSION,
  plan: null,
  categories: [],
  tasks: [],
  dependencies: [],
  externalDependencies: [],
  sprints: [],
  weeks: [],
  teams: [],
  freedays: [],
  weekResources: [],
  schedule: [],
};

export function createPlanDocument({
  name = DEFAULT_PLAN_NAME,
  description = '',
  startYear = DEFAULT_START_YEAR,
  startWeek = DEFAULT_START_WEEK,
  sprintStartNumber = 1,
  sprintStartOrder = 1,
  startingResourceCount = DEFAULT_RESOURCE_COUNT,
  rowHeight = DEFAULT_ROW_HEIGHT,
  weekColumnWidth = DEFAULT_WEEK_COLUMN_WIDTH,
  now = new Date().toISOString(),
} = {}) {
  const plan = {
    id: createId('plan'),
    name,
    description,
    startYear,
    startWeek,
    sprintStartNumber,
    sprintStartOrder,
    startingResourceCount,
    rowHeight,
    weekColumnWidth,
    vacations: [],
    createdAt: now,
    updatedAt: now,
  };

  const weeks = buildCalculatedWeeks(startWeek, MIN_VISIBLE_WEEKS, startYear);
  const sprints = buildFixedSprints(weeks, sprintStartNumber, sprintStartOrder);
  const teams = [{ id: createId('team'), name: 'Team 1' }];

  return {
    ...emptyPlanDocument,
    plan,
    weeks,
    sprints,
    teams,
    weekResources:
      weeks.length > 0
        ? [
            {
              id: createId('week-resource'),
              teamId: teams[0].id,
              weekIndex: weeks[0].weekIndex,
              resourceCount: startingResourceCount,
            },
          ]
        : [],
  };
}
