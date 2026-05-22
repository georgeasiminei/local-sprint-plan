import { SCHEMA_VERSION } from '../constants/schemaVersion.js';

const ROOT_ARRAY_KEYS = [
  'categories',
  'tasks',
  'dependencies',
  'externalDependencies',
  'sprints',
  'weeks',
  'teams',
  'freedays',
  'weekResources',
  'schedule',
];

export function validatePlanDocument(document) {
  const errors = [];

  if (!document || typeof document !== 'object') {
    return { valid: false, errors: ['Import must be a JSON object.'] };
  }

  if (!document.version) {
    errors.push('Missing schema version.');
  }

  if (document.version && document.version !== SCHEMA_VERSION) {
    errors.push(`Unsupported schema version: ${document.version}.`);
  }

  if (!document.plan?.id || !document.plan?.name) {
    errors.push('Plan metadata must include id and name.');
  }

  if (document.plan?.startWeek !== undefined && !isIntegerAtLeast(document.plan.startWeek, 1)) {
    errors.push('Plan startWeek must be a positive integer.');
  }

  if (document.plan?.startYear !== undefined && !isIntegerAtLeast(document.plan.startYear, 1)) {
    errors.push('Plan startYear must be a positive integer.');
  }

  if (document.plan?.sprintStartNumber !== undefined && !isIntegerAtLeast(document.plan.sprintStartNumber, 1)) {
    errors.push('Plan sprintStartNumber must be a positive integer.');
  }

  if (document.plan?.sprintStartOrder !== undefined && !isIntegerAtLeast(document.plan.sprintStartOrder, 1)) {
    errors.push('Plan sprintStartOrder must be a positive integer.');
  }

  if (document.plan?.startingResourceCount !== undefined && !isNumberAtLeast(document.plan.startingResourceCount, 0)) {
    errors.push('Plan startingResourceCount must be a non-negative number.');
  }

  if (document.plan?.rowHeight !== undefined && !isNumberBetween(document.plan.rowHeight, 16, 48)) {
    errors.push('Plan rowHeight must be between 16 and 48.');
  }

  if (document.plan?.weekColumnWidth !== undefined && !isNumberBetween(document.plan.weekColumnWidth, 24, 120)) {
    errors.push('Plan weekColumnWidth must be between 24 and 120.');
  }

  if (
    document.plan?.showInternalDependencyLines !== undefined &&
    typeof document.plan.showInternalDependencyLines !== 'boolean'
  ) {
    errors.push('Plan showInternalDependencyLines must be a boolean.');
  }

  for (const key of ROOT_ARRAY_KEYS) {
    if (!Array.isArray(document[key])) {
      errors.push(`${key} must be an array.`);
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors };
  }

  validateCollectionIds('categories', document.categories, errors);
  validateCollectionIds('tasks', document.tasks, errors);
  validateCollectionIds('dependencies', document.dependencies, errors);
  validateCollectionIds('externalDependencies', document.externalDependencies, errors);
  validateCollectionIds('sprints', document.sprints, errors);
  validateCollectionIds('weeks', document.weeks, errors);
  validateCollectionIds('teams', document.teams, errors);
  validateCollectionIds('freedays', document.freedays, errors);
  validateCollectionIds('weekResources', document.weekResources, errors);

  const categoryIds = new Set(document.categories.map((category) => category.id));
  const taskIds = new Set(document.tasks.map((task) => task.id));
  const teamIds = new Set(document.teams.map((team) => team.id));
  const weekIndexes = new Set(document.weeks.map((week) => week.weekIndex));

  validateTasks(document.tasks, categoryIds, errors);
  validateDependencies(document.dependencies, taskIds, categoryIds, errors);
  validateExternalDependencies(document.externalDependencies, errors);
  validateWeeks(document.weeks, errors);
  validateSprints(document.sprints, weekIndexes, errors);
  validateTeams(document.teams, errors);
  validateFreeDays(document.freedays, teamIds, errors);
  validateWeekResources(document.weekResources, teamIds, weekIndexes, errors);
  validateInitialWeekResources(document.teams, document.weeks, document.weekResources, errors);
  validateSchedule(document.schedule, taskIds, weekIndexes, errors);

  return { valid: errors.length === 0, errors };
}

function validateCollectionIds(name, items, errors) {
  const ids = new Set();

  for (const item of items) {
    if (!item?.id) {
      errors.push(`${name} entries must include id.`);
      continue;
    }

    if (ids.has(item.id)) {
      errors.push(`${name} contains duplicate id: ${item.id}.`);
    }

    ids.add(item.id);
  }
}

function validateTasks(tasks, categoryIds, errors) {
  for (const task of tasks) {
    if (!task.name) {
      errors.push(`Task ${task.id} must include a name.`);
    }

    if (task.categoryId && !categoryIds.has(task.categoryId)) {
      errors.push(`Task ${task.id} references a missing category.`);
    }

    if (!isNumberAtLeast(task.priority, 0)) {
      errors.push(`Task ${task.id} priority must be a non-negative number.`);
    }

    if (!isNumberAtLeast(task.estimateWeeks, 0)) {
      errors.push(`Task ${task.id} estimateWeeks must be a non-negative number.`);
    }

    if (task.earliestStartWeek !== null && task.earliestStartWeek !== undefined && !isIntegerAtLeast(task.earliestStartWeek, 1)) {
      errors.push(`Task ${task.id} earliestStartWeek must be null or a positive integer.`);
    }

    if (task.maxResources !== null && task.maxResources !== undefined && !isNumberAtLeast(task.maxResources, 0)) {
      errors.push(`Task ${task.id} maxResources must be null or a non-negative number.`);
    }

    for (const override of task.resourceOverrides ?? []) {
      if (!isIntegerAtLeast(override.weekIndex, 1)) {
        errors.push(`Task ${task.id} resource override weekIndex must be a positive integer.`);
      }

      if (!isNumberAtLeast(override.allocatedUnits, 0)) {
        errors.push(`Task ${task.id} resource override allocatedUnits must be a non-negative number.`);
      }
    }

    for (const vacation of task.vacations ?? []) {
      if (!isIntegerAtLeast(vacation.weekIndex, 1)) {
        errors.push(`Task ${task.id} vacation weekIndex must be a positive integer.`);
      }

      if (!isNumberAtLeast(vacation.dayCount, 0)) {
        errors.push(`Task ${task.id} vacation dayCount must be a non-negative number.`);
      }
    }

    if (task.completed !== undefined && typeof task.completed !== 'boolean') {
      errors.push(`Task ${task.id} completed must be a boolean.`);
    }

    for (const interval of task.completedIntervals ?? []) {
      if (!isIntegerAtLeast(interval.startWeek, 1)) {
        errors.push(`Task ${task.id} completed interval startWeek must be a positive integer.`);
      }

      if (!isIntegerAtLeast(interval.endWeek, interval.startWeek ?? 1)) {
        errors.push(`Task ${task.id} completed interval endWeek must be on or after startWeek.`);
      }

      if (!isNumberAtLeast(interval.allocatedUnits, 0)) {
        errors.push(`Task ${task.id} completed interval allocatedUnits must be a non-negative number.`);
      }

      if (
        interval.rawAllocatedUnits !== null &&
        interval.rawAllocatedUnits !== undefined &&
        !isNumberAtLeast(interval.rawAllocatedUnits, 0)
      ) {
        errors.push(`Task ${task.id} completed interval rawAllocatedUnits must be a non-negative number.`);
      }
    }
  }
}

function validateDependencies(dependencies, taskIds, categoryIds, errors) {
  for (const dependency of dependencies) {
    const predecessorType = dependency.predecessorType ?? 'task';
    const successorType = dependency.successorType ?? 'task';

    if (!isKnownDependencyType(predecessorType)) {
      errors.push(`Dependency ${dependency.id} predecessorType must be task or category.`);
    }

    if (!isKnownDependencyType(successorType)) {
      errors.push(`Dependency ${dependency.id} successorType must be task or category.`);
    }

    if (!hasEntity(predecessorType, dependency.predecessorId, taskIds, categoryIds)) {
      errors.push(`Dependency ${dependency.id} references a missing predecessor ${predecessorType ?? 'entity'}.`);
    }

    if (!hasEntity(successorType, dependency.successorId, taskIds, categoryIds)) {
      errors.push(`Dependency ${dependency.id} references a missing successor ${successorType ?? 'entity'}.`);
    }

    if (predecessorType === successorType && dependency.predecessorId === dependency.successorId) {
      errors.push(`Dependency ${dependency.id} cannot point an item at itself.`);
    }

    if (dependency.lagWeeks !== undefined && !isNumberAtLeast(dependency.lagWeeks, 0)) {
      errors.push(`Dependency ${dependency.id} lagWeeks must be a non-negative number.`);
    }
  }
}

function hasEntity(type, id, taskIds, categoryIds) {
  return type === 'category' ? categoryIds.has(id) : taskIds.has(id);
}

function isKnownDependencyType(type) {
  return type === 'task' || type === 'category';
}

function validateExternalDependencies(externalDependencies, errors) {
  for (const dependency of externalDependencies) {
    if (!dependency.name) {
      errors.push(`External dependency ${dependency.id} must include a name.`);
    }

    const dueWeek = dependency.dueWeek ?? dependency.endWeek ?? dependency.startWeek;
    if (!isIntegerAtLeast(dueWeek, 1)) {
      errors.push(`External dependency ${dependency.id} dueWeek must be a positive integer.`);
    }

    if (dependency.status !== undefined && !['yes', 'partial', 'no'].includes(dependency.status)) {
      errors.push(`External dependency ${dependency.id} status must be yes, partial, or no.`);
    }
  }
}

function validateWeeks(weeks, errors) {
  const seenIndexes = new Set();

  for (const week of weeks) {
    if (!isIntegerAtLeast(week.weekIndex, 1)) {
      errors.push(`Week ${week.id} weekIndex must be a positive integer.`);
    }

    if (seenIndexes.has(week.weekIndex)) {
      errors.push(`weeks contains duplicate weekIndex: ${week.weekIndex}.`);
    }

    seenIndexes.add(week.weekIndex);
  }
}

function validateSprints(sprints, weekIndexes, errors) {
  for (const sprint of sprints) {
    if (!sprint.name) {
      errors.push(`Sprint ${sprint.id} must include a name.`);
    }

    if (!weekIndexes.has(sprint.startWeek) || !weekIndexes.has(sprint.endWeek)) {
      errors.push(`Sprint ${sprint.id} must start and end on existing weeks.`);
    }

    if (sprint.startWeek > sprint.endWeek) {
      errors.push(`Sprint ${sprint.id} startWeek cannot be after endWeek.`);
    }
  }
}

function validateTeams(teams, errors) {
  for (const team of teams) {
    if (!team.name) {
      errors.push(`Team ${team.id} must include a name.`);
    }
  }
}

function validateFreeDays(freedays, teamIds, errors) {
  for (const freeday of freedays) {
    if (!teamIds.has(freeday.teamId)) {
      errors.push(`Free day ${freeday.id} references a missing team.`);
    }

    if (!freeday.date && !freeday.weekIndex) {
      errors.push(`Free day ${freeday.id} must include a date or weekIndex.`);
    }

    if (freeday.weekIndex !== undefined && freeday.weekIndex !== null && !isIntegerAtLeast(freeday.weekIndex, 1)) {
      errors.push(`Free day ${freeday.id} weekIndex must be a positive integer.`);
    }
  }
}

function validateWeekResources(weekResources, teamIds, weekIndexes, errors) {
  const keys = new Set();

  for (const resource of weekResources) {
    if (!teamIds.has(resource.teamId)) {
      errors.push(`Week resource ${resource.id} references a missing team.`);
    }

    if (!weekIndexes.has(resource.weekIndex)) {
      errors.push(`Week resource ${resource.id} references a missing week.`);
    }

    if (!isNumberAtLeast(resource.resourceCount, 0)) {
      errors.push(`Week resource ${resource.id} resourceCount must be a non-negative number.`);
    }

    const key = `${resource.teamId}:${resource.weekIndex}`;
    if (keys.has(key)) {
      errors.push(`weekResources contains duplicate team/week entry: ${key}.`);
    }
    keys.add(key);
  }
}

function validateInitialWeekResources(teams, weeks, weekResources, errors) {
  if (teams.length === 0 || weeks.length === 0) {
    return;
  }

  const firstWeekIndex = Math.min(...weeks.map((week) => week.weekIndex));
  const resourceKeys = new Set(weekResources.map((resource) => `${resource.teamId}:${resource.weekIndex}`));

  for (const team of teams) {
    if (!resourceKeys.has(`${team.id}:${firstWeekIndex}`)) {
      errors.push(`Team ${team.id} must have an explicit resource entry for week ${firstWeekIndex}.`);
    }
  }
}

function validateSchedule(schedule, taskIds, weekIndexes, errors) {
  for (const item of schedule) {
    if (!taskIds.has(item.taskId)) {
      errors.push('Schedule entry references a missing task.');
    }

    if (!weekIndexes.has(item.weekIndex)) {
      errors.push(`Schedule entry for task ${item.taskId} references a missing week.`);
    }

    if (!isNumberAtLeast(item.allocatedUnits, 0)) {
      errors.push(`Schedule entry for task ${item.taskId} allocatedUnits must be a non-negative number.`);
    }
  }
}

function isNumberAtLeast(value, minimum) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum;
}

function isIntegerAtLeast(value, minimum) {
  return Number.isInteger(value) && value >= minimum;
}

function isNumberBetween(value, minimum, maximum) {
  return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
}
