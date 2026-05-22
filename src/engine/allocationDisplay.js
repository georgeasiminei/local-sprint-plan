import {
  applyFreeDays,
  applyVacationDays,
  countCategoryVacationDaysForWeek,
  countFreeDaysForWeek,
  countPlanVacationDaysForWeek,
  countTaskVacationDaysForWeek,
  resolveWeekResourceCount,
} from './resourceResolver.js';
import { roundToTenths } from '../utils/numbers.js';

const RAW_CAP_SNAP_TOLERANCE = 0.15;

export function getResourceAllocationForEntry(document, task, week, entry) {
  if (!document || !task || !week || !entry) {
    return null;
  }

  if (entry.rawAllocatedUnits !== null && entry.rawAllocatedUnits !== undefined) {
    return roundToTenths(entry.rawAllocatedUnits);
  }

  const context = getDisplayCapacityContext(document, task, week);
  const effectiveAllocation = Number(entry.allocatedUnits) || 0;

  if (context.productivityFactor <= 0) {
    return roundToTenths(effectiveAllocation);
  }

  const rawLimit = getTaskRawResourceLimit(task, week.weekIndex);
  if (rawLimit !== null) {
    const effectiveLimit = getEffectiveAllocationFromRaw(
      rawLimit,
      context.productivityFactor,
      context.taskVacationResourceLoss,
    );
    if (Math.abs(effectiveAllocation - effectiveLimit) <= RAW_CAP_SNAP_TOLERANCE) {
      return roundToTenths(rawLimit);
    }
  }

  return roundToTenths((effectiveAllocation + context.taskVacationResourceLoss) / context.productivityFactor);
}

export function getEffectiveAllocationForEntry(entry) {
  if (!entry) {
    return null;
  }

  return roundToTenths(entry.allocatedUnits ?? 0);
}

function getDisplayCapacityContext(document, task, week) {
  const firstTeam = document.teams?.[0];
  if (!firstTeam) {
    return { productivityFactor: 1, taskVacationResourceLoss: 0 };
  }

  const category = (document.categories ?? []).find((item) => item.id === task.categoryId);
  const startingResourceCount = document.plan?.startingResourceCount ?? document.weekResources?.[0]?.resourceCount ?? 0;
  const resourceCount = resolveWeekResourceCount(
    week.weekIndex,
    firstTeam.id,
    document.weekResources ?? [],
    startingResourceCount,
  );
  const freeDays = countFreeDaysForWeek(week, document.freedays ?? [], firstTeam.id);
  const workingDayAdjusted = applyFreeDays(resourceCount, freeDays);
  const planVacationDays = countPlanVacationDaysForWeek(week, document.plan?.vacations ?? []);
  const planVacationAdjusted = applyVacationDays(workingDayAdjusted, planVacationDays);
  const categoryVacationDays = countCategoryVacationDaysForWeek(week, category);
  const categoryVacationAdjusted = applyVacationDays(planVacationAdjusted, categoryVacationDays);
  const taskVacationDays = countTaskVacationDaysForWeek(week, task);

  return {
    productivityFactor: resourceCount > 0 ? categoryVacationAdjusted / resourceCount : 1,
    taskVacationResourceLoss: taskVacationDays / 5,
  };
}

function getTaskRawResourceLimit(task, weekIndex) {
  const rawLimits = [];
  const override = [...(task.resourceOverrides ?? [])]
    .filter((item) => item.weekIndex <= weekIndex)
    .sort((a, b) => b.weekIndex - a.weekIndex)[0];

  if (override) {
    rawLimits.push(Math.max(0, Number(override.allocatedUnits) || 0));
  }

  if (task.maxResources !== null && task.maxResources !== undefined) {
    rawLimits.push(Math.max(0, Number(task.maxResources) || 0));
  }

  if (rawLimits.length === 0) {
    return null;
  }

  return Math.min(...rawLimits);
}

function getEffectiveAllocationFromRaw(rawAllocation, productivityFactor = 1, taskVacationResourceLoss = 0) {
  return Math.max(0, (Number(rawAllocation) || 0) * productivityFactor - taskVacationResourceLoss);
}
