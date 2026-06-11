const PLANNING_WEEKS_PER_YEAR = 52;

export function createVisibleTimelineDocument(document, today = new Date()) {
  const viewStartWeekIndex = resolveViewStartWeekIndex(document, today);
  if (!viewStartWeekIndex) {
    return document;
  }

  const snappedStartWeekIndex = snapToSprintStart(document.sprints ?? [], viewStartWeekIndex);
  const weeks = (document.weeks ?? []).filter((week) => week.weekIndex >= snappedStartWeekIndex);

  if (weeks.length === 0) {
    return document;
  }

  const sprints = createVisibleSprints(document.sprints ?? [], weeks);
  return {
    ...document,
    weeks,
    sprints,
  };
}

export function resolveViewStartWeekIndex(document, today = new Date()) {
  const setting = String(document?.plan?.viewStartWeek ?? '').trim();
  if (!setting) {
    return null;
  }

  const relativeWeeks = parseRelativeWeeks(setting);
  if (relativeWeeks !== null) {
    return resolveRelativeViewStartWeekIndex(document, relativeWeeks, today);
  }

  return resolveAbsoluteViewStartWeekIndex(document, setting);
}

function parseRelativeWeeks(setting) {
  if (!/^\d+$/u.test(setting)) {
    return null;
  }

  return Math.max(0, Number(setting));
}

function resolveRelativeViewStartWeekIndex(document, previousWeekCount, today) {
  const weeks = document.weeks ?? [];
  if (weeks.length === 0) {
    return null;
  }

  const current = getCurrentPlanningWeekInfo(today);
  const first = weeks[0];
  const currentWeekIndex =
    first.weekIndex + planningWeekOrdinal(current.weekYear, current.weekNumber) - planningWeekOrdinal(first.weekYear, first.weekNumber);
  const requestedStartWeekIndex = currentWeekIndex - previousWeekCount;

  return clampWeekIndexToRange(weeks, requestedStartWeekIndex);
}

function resolveAbsoluteViewStartWeekIndex(document, setting) {
  const match = /^(\d{2}|\d{4})\.(\d{1,2})$/u.exec(setting);
  if (!match) {
    return null;
  }

  const year = Number(match[1].length === 2 ? `20${match[1]}` : match[1]);
  const weekNumber = Number(match[2]);
  if (!Number.isInteger(weekNumber) || weekNumber < 1 || weekNumber > PLANNING_WEEKS_PER_YEAR) {
    return null;
  }

  const weeks = document.weeks ?? [];
  const target = weeks.find((week) => week.weekYear === year && week.weekNumber === weekNumber);
  if (target) {
    return target.weekIndex;
  }

  if (weeks.length === 0) {
    return null;
  }

  const first = weeks[0];
  const requestedStartWeekIndex =
    first.weekIndex + planningWeekOrdinal(year, weekNumber) - planningWeekOrdinal(first.weekYear, first.weekNumber);

  return clampWeekIndexToRange(weeks, requestedStartWeekIndex);
}

function clampWeekIndexToRange(weeks, weekIndex) {
  const firstWeekIndex = weeks[0]?.weekIndex;
  const lastWeekIndex = weeks.at(-1)?.weekIndex;

  if (!Number.isFinite(weekIndex) || firstWeekIndex === undefined || lastWeekIndex === undefined) {
    return null;
  }

  if (weekIndex <= firstWeekIndex) {
    return firstWeekIndex;
  }

  if (weekIndex > lastWeekIndex) {
    return lastWeekIndex;
  }

  return weekIndex;
}

function snapToSprintStart(sprints, weekIndex) {
  const sprint = sprints.find((item) => item.startWeek <= weekIndex && item.endWeek >= weekIndex);
  return sprint?.startWeek ?? weekIndex;
}

function createVisibleSprints(sprints, weeks) {
  const visibleWeekIndexes = new Set(weeks.map((week) => week.weekIndex));
  const firstVisibleWeekIndex = weeks[0]?.weekIndex;

  return sprints
    .map((sprint) => {
      const visibleSprintWeeks = weeks.filter(
        (week) => week.weekIndex >= sprint.startWeek && week.weekIndex <= sprint.endWeek,
      );
      if (visibleSprintWeeks.length === 0) {
        return null;
      }

      const firstSprintWeek = visibleSprintWeeks[0];
      if (!visibleWeekIndexes.has(firstSprintWeek.weekIndex)) {
        return null;
      }

      return {
        ...sprint,
        columnStart: firstSprintWeek.weekIndex - firstVisibleWeekIndex + 1,
        columnSpan: visibleSprintWeeks.length,
      };
    })
    .filter(Boolean);
}

function getCurrentPlanningWeekInfo(date) {
  const weekStart = startOfPlanningWeek(date);
  const thursday = addDays(weekStart, 3);
  let weekYear = thursday.getFullYear();
  const firstWeekStart = getPlanningWeekStartDate(weekYear, 1);
  let weekNumber = Math.round((weekStart.getTime() - firstWeekStart.getTime()) / (7 * 24 * 60 * 60 * 1000)) + 1;

  if (weekNumber > PLANNING_WEEKS_PER_YEAR) {
    weekYear += 1;
    weekNumber = 1;
  }

  return { weekYear, weekNumber };
}

function planningWeekOrdinal(year, weekNumber) {
  return Number(year) * PLANNING_WEEKS_PER_YEAR + Number(weekNumber) - 1;
}

function getPlanningWeekStartDate(year, weekNumber) {
  const fourthOfJanuary = new Date(year, 0, 4);
  const firstWeekStart = startOfPlanningWeek(fourthOfJanuary);
  return addDays(firstWeekStart, (weekNumber - 1) * 7);
}

function startOfPlanningWeek(value) {
  const date = new Date(value);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setHours(0, 0, 0, 0);
  date.setDate(date.getDate() + diff);
  return date;
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}
