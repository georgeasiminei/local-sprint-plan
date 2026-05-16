import { SCHEMA_VERSION } from '../../constants/schemaVersion.js';

export function createPlanFixture(overrides = {}) {
  const planId = overrides.plan?.id ?? 'plan-1';

  return {
    version: SCHEMA_VERSION,
    plan: {
      id: planId,
      name: 'Fixture plan',
      description: '',
      startYear: 2026,
      startWeek: 1,
      sprintStartNumber: 1,
      sprintStartOrder: 1,
      startingResourceCount: 5,
      rowHeight: 19,
      weekColumnWidth: 48,
      showInternalDependencyLines: true,
      vacations: [],
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      ...overrides.plan,
    },
    categories: overrides.categories ?? [],
    tasks: overrides.tasks ?? [],
    dependencies: overrides.dependencies ?? [],
    externalDependencies: overrides.externalDependencies ?? [],
    sprints: overrides.sprints ?? [],
    weeks: overrides.weeks ?? [],
    teams: overrides.teams ?? [],
    freedays: overrides.freedays ?? [],
    weekResources: overrides.weekResources ?? [],
    schedule: overrides.schedule ?? [],
  };
}
