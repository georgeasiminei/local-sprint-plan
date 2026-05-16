import { MAX_CALCULATED_WEEKS, MIN_VISIBLE_WEEKS } from '../constants/defaults.js';
import { expandDependenciesToTaskEdges, topologicalSort } from './dependencyGraph.js';
import {
  applyFreeDays,
  applyVacationDays,
  countCategoryVacationDaysForWeek,
  countFreeDaysForWeek,
  countPlanVacationDaysForWeek,
  resolveWeekResourceCount,
} from './resourceResolver.js';
import { buildCalculatedWeeks, buildFixedSprints } from './timeline.js';
import { expandCompletedIntervals } from './taskCompletion.js';

export function recalculateSchedule(document) {
  const tasks = [...(document.tasks ?? [])].sort((a, b) => (a.priority ?? 0) - (b.priority ?? 0));
  const dependencies = document.dependencies ?? [];
  const categories = document.categories ?? [];
  const expandedDependencies = expandDependenciesToTaskEdges(tasks, categories, dependencies);
  const firstTeam = document.teams?.[0];
  const startWeek = Number(document.plan?.startWeek) || 1;
  const startYear = Number(document.plan?.startYear) || new Date().getFullYear();
  const sprintStartNumber = Number(document.plan?.sprintStartNumber) || 1;
  const sprintStartOrder = Number(document.plan?.sprintStartOrder) || 1;
  const startingResourceCount = Number(document.plan?.startingResourceCount) || 0;
  const { sortedIds, hasCycle, cycleNodes } = topologicalSort(tasks, dependencies, categories);

  if (hasCycle) {
    const weeks = buildCalculatedWeeks(startWeek, document.weeks?.length || MIN_VISIBLE_WEEKS, startYear);
    return {
      tasks: document.tasks ?? [],
      weeks,
      sprints: buildFixedSprints(weeks, sprintStartNumber, sprintStartOrder),
      schedule: [],
      warnings: [
        cycleNodes.length > 0
          ? `Dependency cycle detected involving ${cycleNodes.join(', ')}.`
          : 'Dependency cycle detected.',
      ],
    };
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const dependenciesBySuccessor = groupDependenciesBySuccessor(expandedDependencies);
  const completedTaskIds = new Set(tasks.filter((task) => task.completed).map((task) => task.id));
  const completedEntries = tasks.flatMap((task) =>
    task.completed ? expandCompletedIntervals(task.id, task.completedIntervals ?? []) : [],
  );
  const manualEntries = (document.schedule ?? []).filter(
    (entry) =>
      entry.isManual &&
      !completedTaskIds.has(entry.taskId) &&
      tasks.some((task) => task.id === entry.taskId),
  );
  const allocatedByWeek = createManualAllocationMap([...manualEntries, ...completedEntries]);
  const manualEntriesByTask = groupManualEntriesByTask(manualEntries);
  const completionWeekByTask = new Map();
  const schedule = [];
  const warnings = [];
  let requiredWeekCount = document.weeks?.length || MIN_VISIBLE_WEEKS;
  let weeks = buildCalculatedWeeks(startWeek, requiredWeekCount, startYear);

  for (const taskId of sortedIds) {
    const task = taskById.get(taskId);
    if (task.completed) {
      const entries = completedEntries.filter((entry) => entry.taskId === task.id);
      schedule.push(...entries);
      if (entries.length > 0) {
        completionWeekByTask.set(task.id, entries.at(-1).weekIndex);
      }
      continue;
    }

    const earliestStartWeek = getEarliestStartWeek(task, dependenciesBySuccessor, completionWeekByTask, startWeek);
    const result = scheduleTask({
      task,
      weeks,
      firstTeam,
      startingResourceCount,
      weekResources: document.weekResources ?? [],
      freedays: document.freedays ?? [],
      planVacations: document.plan?.vacations ?? [],
      categoryById,
      allocatedByWeek,
      earliestStartWeek,
      manualEntries: manualEntriesByTask.get(task.id) ?? [],
      warnings,
    });

    while (result.needsMoreWeeks && requiredWeekCount < MAX_CALCULATED_WEEKS) {
      requiredWeekCount = Math.min(MAX_CALCULATED_WEEKS, Math.max(requiredWeekCount + 4, result.requiredWeekCount));
      weeks = buildCalculatedWeeks(startWeek, requiredWeekCount, startYear);
      result.retry(weeks);
    }

    schedule.push(...result.entries);

    for (const entry of result.entries) {
      if (entry.isManual) {
        continue;
      }
      allocatedByWeek.set(entry.weekIndex, (allocatedByWeek.get(entry.weekIndex) ?? 0) + entry.allocatedUnits);
    }

    if (result.entries.length > 0) {
      completionWeekByTask.set(task.id, result.entries[result.entries.length - 1].weekIndex);
    }

    if (result.remainingEstimate > 0) {
      warnings.push(`${task.name} could not be fully scheduled within ${MAX_CALCULATED_WEEKS} weeks.`);
    }
  }

  const calculatedTasks = (document.tasks ?? []).map((task) => {
    const entries = schedule.filter((entry) => entry.taskId === task.id);
    const calcWeeks = entries.length > 0 ? entries[entries.length - 1].weekIndex - entries[0].weekIndex + 1 : 0;
    return { ...task, calcWeeks };
  });

  const lastScheduledWeek = Math.max(
    startWeek + MIN_VISIBLE_WEEKS - 1,
    ...schedule.map((entry) => entry.weekIndex),
    ...expandedDependencies.map((dependency) =>
      dependency.successorId ? completionWeekByTask.get(dependency.successorId) ?? startWeek : startWeek,
    ),
    ...(document.externalDependencies ?? []).map((dependency) => dependency.dueWeek ?? dependency.endWeek ?? dependency.startWeek ?? startWeek),
  );
  const finalWeekCount = Math.max(MIN_VISIBLE_WEEKS, lastScheduledWeek - startWeek + 1);
  const finalWeeks = buildCalculatedWeeks(startWeek, finalWeekCount, startYear);

  return {
    tasks: calculatedTasks,
    weeks: finalWeeks,
    sprints: buildFixedSprints(finalWeeks, sprintStartNumber, sprintStartOrder),
    schedule,
    warnings,
  };
}

function scheduleTask(options) {
  const manualEntries = options.manualEntries
    .filter((entry) => entry.weekIndex >= options.earliestStartWeek)
    .sort((a, b) => a.weekIndex - b.weekIndex);
  const manualTotal = roundAllocation(manualEntries.reduce((total, entry) => total + (entry.allocatedUnits ?? 0), 0));
  const state = {
    entries: [...manualEntries],
    needsMoreWeeks: false,
    remainingEstimate: Math.max(0, roundAllocation((options.task.estimateWeeks ?? 0) - manualTotal)),
    requiredWeekCount: options.weeks.length,
  };

  state.retry = (weeks) => {
    const retried = scheduleTask({ ...options, weeks });
    Object.assign(state, retried);
  };

  if (!options.task || state.remainingEstimate <= 0) {
    validateManualEntries(options, manualEntries);
    state.remainingEstimate = 0;
    return state;
  }

  const firstWeekIndex = options.weeks[0]?.weekIndex ?? options.earliestStartWeek;

  for (const week of options.weeks) {
    if (week.weekIndex < options.earliestStartWeek) {
      continue;
    }

    const effectiveCapacity = getEffectiveWeekCapacity({
      week,
      firstTeam: options.firstTeam,
      startingResourceCount: options.startingResourceCount,
      weekResources: options.weekResources,
      freedays: options.freedays,
      planVacations: options.planVacations,
      category: options.categoryById?.get(options.task.categoryId),
    });
    const alreadyAllocated = options.allocatedByWeek.get(week.weekIndex) ?? 0;
    const available = Math.max(0, effectiveCapacity - alreadyAllocated);
    const taskCapacity = getTaskWeekCapacity(options.task, week.weekIndex, available);
    const hasManualEntry = manualEntries.some((entry) => entry.weekIndex === week.weekIndex);
    if (hasManualEntry) {
      validateManualEntries(options, manualEntries.filter((entry) => entry.weekIndex === week.weekIndex));
      continue;
    }
    const allocation = Math.min(state.remainingEstimate, taskCapacity);

    if (allocation > 0) {
      state.entries.push({
        taskId: options.task.id,
        weekIndex: week.weekIndex,
        allocatedUnits: roundAllocation(allocation),
        isManual: false,
      });
      state.remainingEstimate = roundAllocation(state.remainingEstimate - allocation);
    }

    if (state.remainingEstimate <= 0) {
      state.remainingEstimate = 0;
      state.entries.sort((a, b) => a.weekIndex - b.weekIndex);
      return state;
    }
  }

  state.needsMoreWeeks = true;
  state.entries.sort((a, b) => a.weekIndex - b.weekIndex);
  state.requiredWeekCount = Math.max(options.weeks.length + 4, options.earliestStartWeek - firstWeekIndex + options.weeks.length + 1);
  return state;
}

function validateManualEntries(options, manualEntries) {
  for (const entry of manualEntries) {
    const week = options.weeks.find((item) => item.weekIndex === entry.weekIndex);
    if (!week) {
      continue;
    }

    const effectiveCapacity = getEffectiveWeekCapacity({
      week,
      firstTeam: options.firstTeam,
      startingResourceCount: options.startingResourceCount,
      weekResources: options.weekResources,
      freedays: options.freedays,
      planVacations: options.planVacations,
      category: options.categoryById?.get(options.task.categoryId),
    });
    const maxResources = options.task.maxResources ?? Number.POSITIVE_INFINITY;

    if (entry.allocatedUnits > maxResources) {
      options.warnings.push(`${options.task.name} has a manual allocation above its max resources in ${week.label}.`);
    }

    if (entry.allocatedUnits > effectiveCapacity) {
      options.warnings.push(`${options.task.name} has a manual allocation above available capacity in ${week.label}.`);
    }
  }
}

function getEffectiveWeekCapacity({ week, firstTeam, startingResourceCount, weekResources, freedays, planVacations, category }) {
  if (!firstTeam) {
    return 0;
  }

  const resourceCount = resolveWeekResourceCount(week.weekIndex, firstTeam.id, weekResources, startingResourceCount);
  const freeDays = countFreeDaysForWeek(week, freedays, firstTeam.id);
  const workingDayAdjusted = applyFreeDays(resourceCount, freeDays);
  const planVacationDays = countPlanVacationDaysForWeek(week, planVacations);
  const planVacationAdjusted = applyVacationDays(workingDayAdjusted, planVacationDays);
  const vacationDays = countCategoryVacationDaysForWeek(week, category);
  return applyVacationDays(planVacationAdjusted, vacationDays);
}

function getTaskWeekCapacity(task, weekIndex, available) {
  const maxResourceCap = task.maxResources === null || task.maxResources === undefined
    ? available
    : Math.min(available, task.maxResources);
  const override = [...(task.resourceOverrides ?? [])]
    .filter((item) => item.weekIndex <= weekIndex)
    .sort((a, b) => b.weekIndex - a.weekIndex)[0];

  if (!override) {
    return maxResourceCap;
  }

  return Math.min(maxResourceCap, Math.max(0, Number(override.allocatedUnits) || 0));
}

function getEarliestStartWeek(task, dependenciesBySuccessor, completionWeekByTask, fallbackStartWeek) {
  const taskStartWeek = task.earliestStartWeek ?? fallbackStartWeek;
  const dependencyStartWeek = (dependenciesBySuccessor.get(task.id) ?? []).reduce((latestWeek, dependency) => {
    const predecessorCompletionWeek = completionWeekByTask.get(dependency.predecessorId);
    if (!predecessorCompletionWeek) {
      return latestWeek;
    }

    return Math.max(latestWeek, predecessorCompletionWeek + (dependency.lagWeeks ?? 0) + 1);
  }, fallbackStartWeek);

  return Math.max(taskStartWeek, dependencyStartWeek);
}

function groupDependenciesBySuccessor(dependencies) {
  return dependencies.reduce((groups, dependency) => {
    const items = groups.get(dependency.successorId) ?? [];
    items.push(dependency);
    groups.set(dependency.successorId, items);
    return groups;
  }, new Map());
}

function groupManualEntriesByTask(entries) {
  return entries.reduce((groups, entry) => {
    const taskEntries = groups.get(entry.taskId) ?? [];
    taskEntries.push(entry);
    groups.set(entry.taskId, taskEntries);
    return groups;
  }, new Map());
}

function createManualAllocationMap(entries) {
  return entries.reduce((map, entry) => {
    map.set(entry.weekIndex, (map.get(entry.weekIndex) ?? 0) + (entry.allocatedUnits ?? 0));
    return map;
  }, new Map());
}

function roundAllocation(value) {
  return Math.round(value * 100) / 100;
}
