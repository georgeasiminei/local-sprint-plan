import { DEFAULT_SPRINT_LENGTH_WEEKS, DEFAULT_START_WEEK, DEFAULT_START_YEAR, MIN_VISIBLE_WEEKS } from '../constants/defaults.js';

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEK_MS = 7 * DAY_MS;

export function buildCalculatedWeeks(startWeek = DEFAULT_START_WEEK, weekCount = MIN_VISIBLE_WEEKS, startYear = DEFAULT_START_YEAR) {
  const firstWeek = Number(startWeek) || DEFAULT_START_WEEK;
  const firstYear = Number(startYear) || DEFAULT_START_YEAR;
  const count = Math.max(MIN_VISIBLE_WEEKS, Math.ceil(Number(weekCount) || 0));

  return Array.from({ length: count }, (_, index) => {
    const weekIndex = firstWeek + index;
    const { weekYear, weekNumber } = normalizeIsoWeek(firstYear, firstWeek + index);
    const startDate = getIsoWeekStartDate(weekYear, weekNumber);
    const endDate = addDays(startDate, 6);

    return {
      id: `week-${weekIndex}`,
      weekIndex,
      weekYear,
      weekNumber,
      label: formatWeekLabel(weekYear, weekNumber),
      startDate: formatDate(startDate),
      endDate: formatDate(endDate),
    };
  });
}

export function buildFixedSprints(weeks = [], sprintStartNumber = 1, sprintStartOrder = 1) {
  const sprints = [];
  const firstSprintNumber = Number(sprintStartNumber) || 1;
  const firstSprintOrder = Number(sprintStartOrder) || 1;

  for (let index = 0; index < weeks.length; index += DEFAULT_SPRINT_LENGTH_WEEKS) {
    const sprintWeeks = weeks.slice(index, index + DEFAULT_SPRINT_LENGTH_WEEKS);
    if (sprintWeeks.length === 0) {
      continue;
    }

    const order = sprints.length + 1;
    const number = order < firstSprintOrder ? order : firstSprintNumber + order - firstSprintOrder;

    sprints.push({
      id: `sprint-${sprints.length + 1}`,
      name: `Sprint ${number}`,
      startWeek: sprintWeeks[0].weekIndex,
      endWeek: sprintWeeks[sprintWeeks.length - 1].weekIndex,
      order,
      number,
      columnStart: index + 1,
      columnSpan: sprintWeeks.length,
    });
  }

  return sprints;
}

export function getCurrentIsoWeekInfo(date = new Date()) {
  const weekStart = startOfIsoWeek(date);
  const thursday = addDays(weekStart, 3);
  const weekYear = thursday.getFullYear();
  const firstWeekStart = getIsoWeekStartDate(weekYear, 1);
  const weekNumber = Math.round((weekStart.getTime() - firstWeekStart.getTime()) / WEEK_MS) + 1;

  return { weekYear, weekNumber };
}

export function isPastWeek(week, today = new Date()) {
  if (!week?.endDate) {
    return false;
  }

  const end = new Date(`${week.endDate}T23:59:59`);
  return end < today;
}

function normalizeIsoWeek(year, weekNumber) {
  let normalizedYear = Number(year) || DEFAULT_START_YEAR;
  let normalizedWeek = Number(weekNumber) || DEFAULT_START_WEEK;

  while (normalizedWeek < 1) {
    normalizedYear -= 1;
    normalizedWeek += getIsoWeeksInYear(normalizedYear);
  }

  while (normalizedWeek > getIsoWeeksInYear(normalizedYear)) {
    normalizedWeek -= getIsoWeeksInYear(normalizedYear);
    normalizedYear += 1;
  }

  return { weekYear: normalizedYear, weekNumber: normalizedWeek };
}

function getIsoWeeksInYear(year) {
  return getCurrentIsoWeekInfo(new Date(year, 11, 28)).weekNumber;
}

function getIsoWeekStartDate(year, weekNumber) {
  const fourthOfJanuary = new Date(year, 0, 4);
  const firstWeekStart = startOfIsoWeek(fourthOfJanuary);
  return addDays(firstWeekStart, (weekNumber - 1) * 7);
}

function startOfIsoWeek(value) {
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

function formatWeekLabel(year, weekNumber) {
  return `${String(year).slice(-2)}.${String(weekNumber).padStart(2, '0')}`;
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
