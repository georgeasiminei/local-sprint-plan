import { DEFAULT_RESOURCE_COUNT } from '../constants/defaults.js';

export function resolveWeekResourceCount(weekIndex, teamId, weekResources = [], fallbackCount = DEFAULT_RESOURCE_COUNT) {
  const sortedResources = weekResources
    .filter((item) => item.teamId === teamId && item.weekIndex <= weekIndex)
    .sort((a, b) => b.weekIndex - a.weekIndex);

  const explicit = sortedResources[0];
  if (explicit?.resourceCount !== undefined) {
    return explicit.resourceCount;
  }

  return fallbackCount;
}

export function applyFreeDays(resourceCount, freeDays = 0, workdays = 5) {
  if (workdays <= 0) {
    return resourceCount;
  }

  return Math.max(0, resourceCount * ((workdays - freeDays) / workdays));
}

export function resolveWorkingDaysForWeek(week, freedays = [], teamId = null, defaultWorkdays = 5) {
  return Math.max(0, defaultWorkdays - countFreeDaysForWeek(week, freedays, teamId));
}

export function applyVacationDays(resourceCount, vacationDays = 0, workdays = 5) {
  if (workdays <= 0) {
    return resourceCount;
  }

  return Math.max(0, resourceCount - vacationDays / workdays);
}

export function countFreeDaysForWeek(week, freedays = [], teamId = null) {
  return freedays.filter((freeday) => {
    if (teamId && freeday.teamId !== teamId) {
      return false;
    }

    if (freeday.weekIndex === week.weekIndex) {
      return true;
    }

    if (!freeday.date || !week.startDate) {
      return false;
    }

    const date = new Date(freeday.date);
    const start = new Date(week.startDate);
    const end = week.endDate ? new Date(week.endDate) : new Date(start);
    if (!week.endDate) {
      end.setDate(start.getDate() + 6);
    }

    return date >= start && date <= end;
  }).length;
}

export function countCategoryVacationDaysForWeek(week, category, workdays = 5) {
  const entry = (category?.vacations ?? []).find((vacation) => vacation.weekIndex === week.weekIndex);
  return Math.max(0, Math.min(Number(entry?.dayCount) || 0, Number.MAX_SAFE_INTEGER)) || 0;
}

export function countPlanVacationDaysForWeek(week, vacations = []) {
  const entry = vacations.find((vacation) => vacation.weekIndex === week.weekIndex);
  return Math.max(0, Math.min(Number(entry?.dayCount) || 0, Number.MAX_SAFE_INTEGER)) || 0;
}
