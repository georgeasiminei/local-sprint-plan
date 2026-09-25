import { MAX_CALCULATED_WEEKS, MIN_VISIBLE_WEEKS } from '../constants/defaults.js';
import { expandDependenciesToTaskEdges, getEffectiveTaskPriorities, topologicalSort } from './dependencyGraph.js';
import {
  applyFreeDays,
  applyVacationDays,
  countCategoryVacationDaysForWeek,
  countFreeDaysForWeek,
  countPlanVacationDaysForWeek,
  countTaskVacationDaysForWeek,
  resolveWeekResourceCount,
} from './resourceResolver.js';
import { buildCalculatedWeeks, buildFixedSprints } from './timeline.js';
import { expandCompletedIntervals } from './taskCompletion.js';
import { roundToTenths } from '../utils/numbers.js';

export function recalculateSchedule(document) {
  const dependencies = document.dependencies ?? [];
  const categories = document.categories ?? [];
  const sourceTasks = document.tasks ?? [];
  const taskIndex = new Map(sourceTasks.map((task, index) => [task.id, index]));
  const effectivePriorities = getEffectiveTaskPriorities(sourceTasks, dependencies, categories);
  const tasks = [...sourceTasks].sort((a, b) =>
    (effectivePriorities.get(a.id) ?? a.priority ?? 0) - (effectivePriorities.get(b.id) ?? b.priority ?? 0) ||
    (a.priority ?? 0) - (b.priority ?? 0) ||
    (taskIndex.get(a.id) ?? 0) - (taskIndex.get(b.id) ?? 0),
  );
  const externalDependencyById = new Map((document.externalDependencies ?? []).map((dependency) => [dependency.id, dependency]));
  const expandedDependencies = expandDependenciesToTaskEdges(tasks, categories, dependencies).map((dependency) => {
    if (dependency.predecessorType !== 'external') {
      return dependency;
    }

    const externalDependency = externalDependencyById.get(dependency.predecessorId);
    return {
      ...dependency,
      predecessorDueWeek:
        externalDependency?.dueWeek ?? externalDependency?.endWeek ?? externalDependency?.startWeek ?? null,
    };
  });
  const firstTeam = document.teams?.[0];
  const startWeek = Number(document.plan?.startWeek) || 1;
  const startYear = Number(document.plan?.startYear) || new Date().getFullYear();
  const sprintStartNumber = Number(document.plan?.sprintStartNumber) || 1;
  const sprintStartOrder = Number(document.plan?.sprintStartOrder) || 1;
  const startingResourceCount = Number(document.plan?.startingResourceCount) || 0;
  const { sortedIds, hasCycle, cycleNodes } = topologicalSort(tasks, dependencies, categories);
  // Computed up front (not just in the happy path) so a dependency cycle can still
  // preserve the plan's manual and completed allocations instead of wiping them.
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

  if (hasCycle) {
    const weeks = buildCalculatedWeeks(startWeek, document.weeks?.length || MIN_VISIBLE_WEEKS, startYear);
    return {
      tasks: document.tasks ?? [],
      weeks,
      sprints: buildFixedSprints(weeks, sprintStartNumber, sprintStartOrder),
      // Keep whatever was already committed to the plan (manual edits, frozen history)
      // instead of returning an empty schedule - a cycle should block *new* scheduling,
      // not silently delete every task's existing allocations from the document.
      schedule: [...manualEntries, ...completedEntries],
      warnings: [
        cycleNodes.length > 0
          ? `Dependency cycle detected involving ${cycleNodes.join(', ')}. Existing manual and completed allocations were kept, but nothing new will be scheduled until the cycle is resolved.`
          : 'Dependency cycle detected. Existing manual and completed allocations were kept, but nothing new will be scheduled until the cycle is resolved.',
      ],
    };
  }

  const taskById = new Map(tasks.map((task) => [task.id, task]));
  const categoryById = new Map(categories.map((category) => [category.id, category]));
  const dependenciesBySuccessor = groupDependenciesBySuccessor(expandedDependencies);
  const allocatedByWeek = createAllocationMap([...manualEntries, ...completedEntries], (entry) => entry.allocatedUnits);
  const rawAllocatedByWeek = createAllocationMap(
    [...manualEntries, ...completedEntries],
    (entry) => entry.rawAllocatedUnits ?? entry.allocatedUnits,
  );
  const manualEntriesByTask = groupManualEntriesByTask(manualEntries);
  const completionWeekByTask = new Map();
  // Tasks that hit the MAX_CALCULATED_WEEKS ceiling with work still remaining. A
  // dependent of one of these has no real completion week to start after, so it must
  // not be treated as unconstrained (see getEarliestStartWeek).
  const incompleteTaskIds = new Set();
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

    const earliestStartWeek = getEarliestStartWeek(
      task,
      dependenciesBySuccessor,
      completionWeekByTask,
      startWeek,
      incompleteTaskIds,
      warnings,
    );
    const scheduleOptions = {
      task,
      weeks,
      firstTeam,
      startingResourceCount,
      weekResources: document.weekResources ?? [],
      freedays: document.freedays ?? [],
      planVacations: document.plan?.vacations ?? [],
      categoryById,
      allocatedByWeek,
      rawAllocatedByWeek,
      earliestStartWeek,
      manualEntries: manualEntriesByTask.get(task.id) ?? [],
      warnings,
    };
    let result = scheduleTask(scheduleOptions);

    while (result.needsMoreWeeks && requiredWeekCount < MAX_CALCULATED_WEEKS) {
      requiredWeekCount = Math.min(MAX_CALCULATED_WEEKS, Math.max(requiredWeekCount + 4, result.requiredWeekCount));
      weeks = buildCalculatedWeeks(startWeek, requiredWeekCount, startYear);
      result = scheduleTask({ ...scheduleOptions, weeks });
    }

    schedule.push(...result.entries);

    for (const entry of result.entries) {
      if (entry.isManual) {
        continue;
      }
      allocatedByWeek.set(entry.weekIndex, (allocatedByWeek.get(entry.weekIndex) ?? 0) + entry.allocatedUnits);
      rawAllocatedByWeek.set(
        entry.weekIndex,
        roundAllocation(
          (rawAllocatedByWeek.get(entry.weekIndex) ?? 0) +
            (entry.rawAllocatedUnits ??
              getRawAllocationForScheduledEntry({
                entry,
                task,
                week: weeks.find((item) => item.weekIndex === entry.weekIndex),
                firstTeam,
                startingResourceCount,
                weekResources: document.weekResources ?? [],
                freedays: document.freedays ?? [],
                planVacations: document.plan?.vacations ?? [],
                category: categoryById.get(task.categoryId),
              })),
        ),
      );
    }

    if (result.remainingEstimate <= 0 && result.entries.length > 0) {
      completionWeekByTask.set(task.id, result.entries[result.entries.length - 1].weekIndex);
    }

    if (result.remainingEstimate > 0) {
      warnings.push(`${task.name} could not be fully scheduled within ${MAX_CALCULATED_WEEKS} weeks.`);
      incompleteTaskIds.add(task.id);
    }
  }

  const calculatedTasks = (document.tasks ?? []).map((task) => {
    const entries = schedule.filter((entry) => entry.taskId === task.id);
    const calcWeeks = entries.length > 0 ? entries[entries.length - 1].weekIndex - entries[0].weekIndex + 1 : 0;
    return { ...task, calcWeeks };
  });

  // A plain `Math.max(...values)` spread throws for very large arrays (call-stack /
  // argument-count limits) and gives no protection against absurd input values (e.g. a
  // corrupted or maliciously crafted dueWeek/weekIndex). safeMax avoids both, and the
  // Math.min clamp below is the single choke point that keeps buildCalculatedWeeks from
  // ever being asked to materialize an unbounded number of week objects.
  let lastScheduledWeek = safeMax(startWeek + MIN_VISIBLE_WEEKS - 1, schedule.map((entry) => entry.weekIndex));
  lastScheduledWeek = safeMax(
    lastScheduledWeek,
    expandedDependencies.map((dependency) =>
      dependency.successorId ? completionWeekByTask.get(dependency.successorId) ?? startWeek : startWeek,
    ),
  );
  lastScheduledWeek = safeMax(
    lastScheduledWeek,
    (document.externalDependencies ?? []).map(
      (dependency) => dependency.dueWeek ?? dependency.endWeek ?? dependency.startWeek ?? startWeek,
    ),
  );
  const finalWeekCount = Math.min(
    MAX_CALCULATED_WEEKS,
    Math.max(MIN_VISIBLE_WEEKS, lastScheduledWeek - startWeek + 1),
  );
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
  // Manual entries are kept even when their week falls before the task's (possibly
  // dependency-driven) earliest start week. They were already counted against this
  // task's estimate and against shared week capacity by the caller regardless of
  // timing, so silently dropping them here would delete user data from the document
  // while the capacity they consumed stayed spent for other tasks. Warn instead.
  const manualEntries = [...options.manualEntries].sort((a, b) => a.weekIndex - b.weekIndex);
  const earlyManualEntries = manualEntries.filter((entry) => entry.weekIndex < options.earliestStartWeek);
  if (earlyManualEntries.length > 0) {
    options.warnings.push(
      `${options.task.name} has a manual allocation before its earliest start week; it was kept as scheduled.`,
    );
  }
  const manualTotal = roundAllocation(manualEntries.reduce((total, entry) => total + (entry.allocatedUnits ?? 0), 0));
  const state = {
    entries: [...manualEntries],
    needsMoreWeeks: false,
    remainingEstimate: Math.max(0, roundAllocation((options.task.estimateWeeks ?? 0) - manualTotal)),
    requiredWeekCount: options.weeks.length,
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

    const capacity = getWeekCapacityContext({
      week,
      firstTeam: options.firstTeam,
      startingResourceCount: options.startingResourceCount,
      weekResources: options.weekResources,
      freedays: options.freedays,
      planVacations: options.planVacations,
      category: options.categoryById?.get(options.task.categoryId),
      task: options.task,
    });
    const alreadyAllocated = options.allocatedByWeek.get(week.weekIndex) ?? 0;
    const alreadyRawAllocated = options.rawAllocatedByWeek.get(week.weekIndex) ?? 0;
    const available = Math.max(0, capacity.effectiveCapacity - alreadyAllocated);
    const rawAvailable = Math.max(0, capacity.rawCapacity - alreadyRawAllocated);
    const taskCapacity = getTaskWeekCapacity(
      options.task,
      week.weekIndex,
      available,
      rawAvailable,
      capacity.productivityFactor,
      capacity.taskVacationResourceLoss,
    );
    const hasManualEntry = manualEntries.some((entry) => entry.weekIndex === week.weekIndex);
    if (hasManualEntry) {
      validateManualEntries(options, manualEntries.filter((entry) => entry.weekIndex === week.weekIndex));
      continue;
    }
    const allocation = Math.min(state.remainingEstimate, taskCapacity.effectiveCapacity);
    // Round before branching: a raw allocation as small as 0.04 rounds to 0 tenths of
    // a resource, and used to still push a schedule entry that showed zero effort but
    // consumed a week and inflated calcWeeks. Branching on the rounded value means a
    // negligible residual falls through to the "no real work this week" path below.
    const allocatedUnits = allocation > 0 ? roundAllocation(allocation) : 0;

    if (allocatedUnits > 0) {
      const rawAllocatedUnits = roundAllocation(
        getRawAllocationForEffectiveAllocation(
          allocatedUnits,
          taskCapacity,
          capacity.productivityFactor,
          capacity.taskVacationResourceLoss,
        ),
      );
      state.entries.push({
        taskId: options.task.id,
        weekIndex: week.weekIndex,
        allocatedUnits,
        ...(rawAllocatedUnits !== allocatedUnits ? { rawAllocatedUnits } : {}),
        isManual: false,
      });
      state.remainingEstimate = roundAllocation(state.remainingEstimate - allocatedUnits);
    } else {
      const rawAllocatedUnits = getRawAllocationForFullyVacationedTask(taskCapacity, capacity.taskVacationResourceLoss);
      if (rawAllocatedUnits > 0) {
        state.entries.push({
          taskId: options.task.id,
          weekIndex: week.weekIndex,
          allocatedUnits: 0,
          rawAllocatedUnits,
          isManual: false,
        });
      }
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

    const { effectiveCapacity, productivityFactor, taskVacationResourceLoss } = getWeekCapacityContext({
      week,
      firstTeam: options.firstTeam,
      startingResourceCount: options.startingResourceCount,
      weekResources: options.weekResources,
      freedays: options.freedays,
      planVacations: options.planVacations,
      category: options.categoryById?.get(options.task.categoryId),
      task: options.task,
    });
    const maxResources = options.task.maxResources === null || options.task.maxResources === undefined
      ? Number.POSITIVE_INFINITY
      : getEffectiveAllocationFromRaw(options.task.maxResources, productivityFactor, taskVacationResourceLoss);

    if (entry.allocatedUnits > maxResources) {
      options.warnings.push(`${options.task.name} has a manual allocation above its max resources in ${week.label}.`);
    }

    if (entry.allocatedUnits > effectiveCapacity) {
      options.warnings.push(`${options.task.name} has a manual allocation above available capacity in ${week.label}.`);
    }
  }
}

function getWeekCapacityContext({ week, firstTeam, startingResourceCount, weekResources, freedays, planVacations, category, task }) {
  if (!firstTeam) {
    return { rawCapacity: 0, effectiveCapacity: 0, productivityFactor: 0, taskVacationResourceLoss: 0 };
  }

  const resourceCount = resolveWeekResourceCount(week.weekIndex, firstTeam.id, weekResources, startingResourceCount);
  const freeDays = countFreeDaysForWeek(week, freedays, firstTeam.id);
  const workingDayAdjusted = applyFreeDays(resourceCount, freeDays);
  const planVacationDays = countPlanVacationDaysForWeek(week, planVacations);
  const planVacationAdjusted = applyVacationDays(workingDayAdjusted, planVacationDays);
  const vacationDays = countCategoryVacationDaysForWeek(week, category);
  const categoryVacationAdjusted = applyVacationDays(planVacationAdjusted, vacationDays);
  const taskVacationDays = countTaskVacationDaysForWeek(week, task);

  return {
    rawCapacity: resourceCount,
    effectiveCapacity: categoryVacationAdjusted,
    productivityFactor: resourceCount > 0 ? categoryVacationAdjusted / resourceCount : 0,
    taskVacationResourceLoss: taskVacationDays / 5,
  };
}

function getTaskWeekCapacity(task, weekIndex, available, rawAvailable, productivityFactor = 1, taskVacationResourceLoss = 0) {
  const rawResourceCap = getTaskRawResourceCap(task, weekIndex, rawAvailable);
  const effectiveFromRawCap = getEffectiveAllocationFromRaw(rawResourceCap, productivityFactor, taskVacationResourceLoss);
  const effectiveCapacity = Math.min(available, effectiveFromRawCap);
  if (rawResourceCap <= 0) {
    return {
      effectiveCapacity: 0,
      available,
      effectiveFromRawCap: 0,
      rawAvailable,
      rawResourceCap,
    };
  }

  if (task.maxResources === null || task.maxResources === undefined) {
    return {
      effectiveCapacity,
      available,
      effectiveFromRawCap,
      rawAvailable,
      rawResourceCap,
    };
  }

  const override = [...(task.resourceOverrides ?? [])]
    .filter((item) => item.weekIndex <= weekIndex)
    .sort((a, b) => b.weekIndex - a.weekIndex)[0];

  if (!override) {
    return {
      effectiveCapacity,
      available,
      effectiveFromRawCap,
      rawAvailable,
      rawResourceCap,
    };
  }

  const overrideEffectiveCapacity = Math.min(
    effectiveCapacity,
    getEffectiveAllocationFromRaw(Math.max(0, Number(override.allocatedUnits) || 0), productivityFactor, taskVacationResourceLoss),
  );

  return {
    effectiveCapacity: overrideEffectiveCapacity,
    available,
    effectiveFromRawCap,
    rawAvailable,
    rawResourceCap,
  };
}

function getTaskRawResourceCap(task, weekIndex, rawAvailable = Number.POSITIVE_INFINITY) {
  const rawLimits = [Math.max(0, Number(rawAvailable) || 0)];
  const override = [...(task.resourceOverrides ?? [])]
    .filter((item) => item.weekIndex <= weekIndex)
    .sort((a, b) => b.weekIndex - a.weekIndex)[0];

  if (override) {
    rawLimits.push(Math.max(0, Number(override.allocatedUnits) || 0));
  }

  if (task.maxResources !== null && task.maxResources !== undefined) {
    rawLimits.push(Math.max(0, Number(task.maxResources) || 0));
  }

  return Math.min(...rawLimits);
}

function getRawAllocationForFullyVacationedTask(taskCapacity, taskVacationResourceLoss = 0) {
  if (taskVacationResourceLoss <= 0 || taskCapacity.effectiveFromRawCap > 0) {
    return 0;
  }

  return roundAllocation(Math.max(0, taskCapacity.rawResourceCap ?? 0));
}

function getRawAllocationForScheduledEntry({
  entry,
  task,
  week,
  firstTeam,
  startingResourceCount,
  weekResources,
  freedays,
  planVacations,
  category,
}) {
  if (!week || !task || entry.isCompleted) {
    return roundAllocation(entry.allocatedUnits ?? 0);
  }

  const capacity = getWeekCapacityContext({
    week,
    firstTeam,
    startingResourceCount,
    weekResources,
    freedays,
    planVacations,
    category,
    task,
  });
  const effectiveAllocation = Number(entry.allocatedUnits) || 0;

  if (capacity.productivityFactor <= 0) {
    return roundAllocation(effectiveAllocation);
  }

  const rawLimit = getTaskRawResourceCap(task, week.weekIndex);
  const effectiveLimit = getEffectiveAllocationFromRaw(
    rawLimit,
    capacity.productivityFactor,
    capacity.taskVacationResourceLoss,
  );
  if (Number.isFinite(rawLimit) && Math.abs(effectiveAllocation - effectiveLimit) <= 0.15) {
    return roundAllocation(rawLimit);
  }

  return roundAllocation((effectiveAllocation + capacity.taskVacationResourceLoss) / capacity.productivityFactor);
}

function getEffectiveAllocationFromRaw(rawAllocation, productivityFactor = 1, taskVacationResourceLoss = 0) {
  return Math.max(0, (Number(rawAllocation) || 0) * productivityFactor - taskVacationResourceLoss);
}

function getRawAllocationForEffectiveAllocation(
  effectiveAllocation,
  taskCapacity,
  productivityFactor = 1,
  taskVacationResourceLoss = 0,
) {
  if (productivityFactor <= 0) {
    return effectiveAllocation;
  }

  if (Math.abs(effectiveAllocation - taskCapacity.effectiveCapacity) <= 0.05) {
    if (Number.isFinite(taskCapacity.rawResourceCap) && taskCapacity.rawResourceCap < taskCapacity.rawAvailable - 0.05) {
      return taskCapacity.rawResourceCap;
    }

    if (taskCapacity.available <= taskCapacity.effectiveFromRawCap + 0.05) {
      return taskCapacity.rawAvailable;
    }

    return taskCapacity.rawResourceCap;
  }

  return (effectiveAllocation + taskVacationResourceLoss) / productivityFactor;
}

function getEarliestStartWeek(
  task,
  dependenciesBySuccessor,
  completionWeekByTask,
  fallbackStartWeek,
  incompleteTaskIds = new Set(),
  warnings = [],
) {
  const taskStartWeek = task.earliestStartWeek ?? fallbackStartWeek;
  const dependencyStartWeek = (dependenciesBySuccessor.get(task.id) ?? []).reduce((latestWeek, dependency) => {
    if (dependency.predecessorType === 'external') {
      return dependency.predecessorDueWeek
        ? Math.max(latestWeek, dependency.predecessorDueWeek + (dependency.lagWeeks ?? 0) + 1)
        : latestWeek;
    }

    // A predecessor that ran out of the scheduling horizon with work still left has no
    // real completion week. Treating that as "unconstrained" would start the successor
    // alongside its still-running predecessor instead of after it, so push it out past
    // the horizon too (which surfaces via the same "could not be fully scheduled"
    // warning) rather than silently ignoring the dependency.
    if (incompleteTaskIds.has(dependency.predecessorId)) {
      warnings.push(
        `${task.name} depends on a task that could not be fully scheduled within ${MAX_CALCULATED_WEEKS} weeks, so its own start could not be constrained by that dependency.`,
      );
      return Math.max(latestWeek, fallbackStartWeek + MAX_CALCULATED_WEEKS);
    }

    const predecessorCompletionWeek = completionWeekByTask.get(dependency.predecessorId);
    if (!predecessorCompletionWeek) {
      return latestWeek;
    }

    return Math.max(latestWeek, predecessorCompletionWeek + (dependency.lagWeeks ?? 0) + 1);
  }, fallbackStartWeek);

  return Math.max(taskStartWeek, dependencyStartWeek);
}

function safeMax(initial, values) {
  let max = initial;
  for (const value of values) {
    if (Number.isFinite(value) && value > max) {
      max = value;
    }
  }
  return max;
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

function createAllocationMap(entries, getValue) {
  return entries.reduce((map, entry) => {
    map.set(entry.weekIndex, (map.get(entry.weekIndex) ?? 0) + (getValue(entry) ?? 0));
    return map;
  }, new Map());
}

function roundAllocation(value) {
  return roundToTenths(value);
}
