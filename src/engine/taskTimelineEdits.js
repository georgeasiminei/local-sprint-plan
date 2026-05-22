import { roundToTenths } from '../utils/numbers.js';

export function shiftTaskRemainder(document, taskId, anchorWeekIndex, weekDelta = 0) {
  const task = (document.tasks ?? []).find((item) => item.id === taskId);
  const delta = Math.max(0, roundToTenths(Number(weekDelta) || 0));
  const anchor = Number(anchorWeekIndex);

  if (!task || task.completed || !Number.isFinite(anchor) || delta <= 0) {
    return document;
  }

  const taskEntries = getTaskEntries(document, taskId);
  const beforeEntries = taskEntries.filter((entry) => entry.weekIndex < anchor);
  const remainingEntries = taskEntries.filter((entry) => entry.weekIndex >= anchor);

  if (remainingEntries.length === 0) {
    return document;
  }

  const nextTaskEntries = [
    ...beforeEntries.map((entry) => toManualEntry(entry, taskId)),
    ...shiftEntriesByWeeks(remainingEntries, delta).map((entry) => toManualEntry(entry, taskId)),
  ];

  return {
    ...document,
    schedule: sortSchedule([
      ...(document.schedule ?? []).filter((entry) => entry.taskId !== taskId),
      ...nextTaskEntries,
    ]),
  };
}

export function splitTaskAtWeek(document, taskId, anchorWeekIndex, newTaskId) {
  const taskIndex = (document.tasks ?? []).findIndex((item) => item.id === taskId);
  const task = document.tasks?.[taskIndex];
  const anchor = Number(anchorWeekIndex);

  if (!task || task.completed || !newTaskId || !Number.isFinite(anchor)) {
    return document;
  }

  const taskEntries = getTaskEntries(document, taskId);
  const beforeEntries = taskEntries.filter((entry) => entry.weekIndex < anchor);
  const nextEntries = taskEntries.filter((entry) => entry.weekIndex >= anchor);

  if (nextEntries.length === 0) {
    return document;
  }

  const firstEstimate = sumAllocations(beforeEntries);
  const secondEstimate = sumAllocations(nextEntries);
  const nextTask = {
    ...task,
    id: newTaskId,
    name: `${task.name} (split)`,
    estimateWeeks: secondEstimate,
    calcWeeks: 0,
    earliestStartWeek: anchor,
    completed: undefined,
    completedIntervals: undefined,
  };
  const firstTask = {
    ...task,
    estimateWeeks: firstEstimate,
    calcWeeks: 0,
    completed: undefined,
    completedIntervals: undefined,
  };
  const nextTasks = [
    ...document.tasks.slice(0, taskIndex),
    firstTask,
    nextTask,
    ...document.tasks.slice(taskIndex + 1),
  ].map((item, index) => ({ ...item, priority: index + 1 }));

  return {
    ...document,
    tasks: nextTasks,
    schedule: sortSchedule([
      ...(document.schedule ?? []).filter((entry) => entry.taskId !== taskId),
      ...beforeEntries.map((entry) => toManualEntry(entry, taskId)),
      ...nextEntries.map((entry) => toManualEntry(entry, newTaskId)),
    ]),
  };
}

function getTaskEntries(document, taskId) {
  return (document.schedule ?? [])
    .filter((entry) => entry.taskId === taskId && Number(entry.allocatedUnits) > 0)
    .sort((a, b) => a.weekIndex - b.weekIndex);
}

function shiftEntriesByWeeks(entries, weekDelta) {
  const allocationsByWeek = new Map();

  for (const entry of entries) {
    const allocation = Number(entry.allocatedUnits) || 0;
    const start = Number(entry.weekIndex) + weekDelta;
    const end = start + 1;
    const firstWeek = Math.floor(start);
    const lastWeek = Math.floor(end - Number.EPSILON);

    for (let weekIndex = firstWeek; weekIndex <= lastWeek; weekIndex += 1) {
      const overlap = Math.max(0, Math.min(end, weekIndex + 1) - Math.max(start, weekIndex));
      if (overlap > 0) {
        allocationsByWeek.set(weekIndex, (allocationsByWeek.get(weekIndex) ?? 0) + allocation * overlap);
      }
    }
  }

  const shiftedEntries = [...allocationsByWeek.entries()]
    .map(([weekIndex, allocatedUnits]) => ({ weekIndex, allocatedUnits: roundToTenths(allocatedUnits) }))
    .filter((entry) => entry.allocatedUnits > 0)
    .sort((a, b) => a.weekIndex - b.weekIndex);
  const originalTotal = sumAllocations(entries);
  const shiftedTotal = sumAllocations(shiftedEntries);
  const roundingDelta = roundToTenths(originalTotal - shiftedTotal);

  if (roundingDelta !== 0 && shiftedEntries.length > 0) {
    const lastEntry = shiftedEntries[shiftedEntries.length - 1];
    shiftedEntries[shiftedEntries.length - 1] = {
      ...lastEntry,
      allocatedUnits: roundToTenths(Math.max(0, lastEntry.allocatedUnits + roundingDelta)),
    };
  }

  return shiftedEntries.filter((entry) => entry.allocatedUnits > 0);
}

function toManualEntry(entry, taskId) {
  return {
    taskId,
    weekIndex: entry.weekIndex,
    allocatedUnits: roundToTenths(entry.allocatedUnits),
    isManual: true,
  };
}

function sumAllocations(entries) {
  return roundToTenths(entries.reduce((total, entry) => total + (Number(entry.allocatedUnits) || 0), 0));
}

function sortSchedule(schedule) {
  return schedule.sort((a, b) => a.weekIndex - b.weekIndex || String(a.taskId).localeCompare(String(b.taskId)));
}
