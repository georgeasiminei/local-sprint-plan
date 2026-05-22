import { roundToTenths } from '../utils/numbers.js';

export function shiftTaskRemainder(document, taskId, anchorWeekIndex, weekDelta = 0, shiftId = null) {
  const task = (document.tasks ?? []).find((item) => item.id === taskId);
  const delta = Math.max(0, roundToTenths(Number(weekDelta) || 0));
  const anchor = Number(anchorWeekIndex);

  if (!task || task.completed || !Number.isFinite(anchor) || delta <= 0) {
    return document;
  }

  const existingShift = shiftId ? (task.shiftRules ?? []).find((shift) => shift.id === shiftId) : null;
  const taskEntries = getTaskEntries(document, taskId);
  const beforeEntries = taskEntries.filter((entry) => entry.weekIndex < anchor);
  const remainingEntries = existingShift ? normalizeShiftEntries(existingShift.sourceEntries) : taskEntries.filter((entry) => entry.weekIndex >= anchor);

  if (remainingEntries.length === 0) {
    return document;
  }

  const shiftedEntries = shiftEntriesByWeeks(remainingEntries, delta);
  const nextShift = {
    id: existingShift?.id ?? createShiftId(task.shiftRules ?? [], anchor),
    anchorWeekIndex: anchor,
    weekDelta: delta,
    firstShiftedWeek: shiftedEntries[0]?.weekIndex ?? getFirstShiftedWeek(anchor, delta),
    sourceEntries: normalizeShiftEntries(remainingEntries),
  };
  const nextShiftRules = [
    ...(task.shiftRules ?? []).filter((shift) => shift.id !== nextShift.id),
    nextShift,
  ].sort((a, b) => a.anchorWeekIndex - b.anchorWeekIndex);
  const nextTaskEntries = [
    ...beforeEntries.map((entry) => toManualEntry(entry, taskId)),
    ...shiftedEntries.map((entry) => toManualEntry(entry, taskId)),
  ];

  return {
    ...document,
    tasks: (document.tasks ?? []).map((item) => (item.id === taskId ? { ...item, shiftRules: nextShiftRules } : item)),
    schedule: sortSchedule([
      ...(document.schedule ?? []).filter((entry) => entry.taskId !== taskId),
      ...nextTaskEntries,
    ]),
  };
}

export function deleteTaskShift(document, taskId, shiftId) {
  const task = (document.tasks ?? []).find((item) => item.id === taskId);
  const shift = (task?.shiftRules ?? []).find((item) => item.id === shiftId);

  if (!task || !shift) {
    return document;
  }

  const taskEntries = getTaskEntries(document, taskId);
  const beforeEntries = taskEntries.filter((entry) => entry.weekIndex < shift.anchorWeekIndex);
  const restoredEntries = [
    ...beforeEntries.map((entry) => toManualEntry(entry, taskId)),
    ...normalizeShiftEntries(shift.sourceEntries).map((entry) => toManualEntry(entry, taskId)),
  ];
  const nextShiftRules = (task.shiftRules ?? []).filter((item) => item.id !== shift.id);

  return {
    ...document,
    tasks: (document.tasks ?? []).map((item) =>
      item.id === taskId
        ? {
            ...item,
            ...(nextShiftRules.length > 0 ? { shiftRules: nextShiftRules } : { shiftRules: undefined }),
          }
        : item,
    ),
    schedule: sortSchedule([
      ...(document.schedule ?? []).filter((entry) => entry.taskId !== taskId),
      ...restoredEntries,
    ]),
  };
}

export function findTaskShiftAtWeek(task, weekIndex) {
  return (task?.shiftRules ?? []).find((shift) => shift.firstShiftedWeek === weekIndex) ?? null;
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
    shiftRules: undefined,
  };
  const firstTask = {
    ...task,
    estimateWeeks: firstEstimate,
    calcWeeks: 0,
    completed: undefined,
    completedIntervals: undefined,
    shiftRules: undefined,
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
  const allocatedUnits = roundToTenths(entry.allocatedUnits);
  const rawAllocatedUnits = entry.rawAllocatedUnits === null || entry.rawAllocatedUnits === undefined
    ? allocatedUnits
    : roundToTenths(entry.rawAllocatedUnits);

  return {
    taskId,
    weekIndex: entry.weekIndex,
    allocatedUnits,
    ...(rawAllocatedUnits !== allocatedUnits ? { rawAllocatedUnits } : {}),
    isManual: true,
  };
}

function normalizeShiftEntries(entries = []) {
  return entries
    .map((entry) => {
      const allocatedUnits = roundToTenths(entry.allocatedUnits);
      const rawAllocatedUnits = entry.rawAllocatedUnits === null || entry.rawAllocatedUnits === undefined
        ? allocatedUnits
        : roundToTenths(entry.rawAllocatedUnits);

      return {
        weekIndex: Number(entry.weekIndex),
        allocatedUnits,
        ...(rawAllocatedUnits !== allocatedUnits ? { rawAllocatedUnits } : {}),
      };
    })
    .filter((entry) => Number.isFinite(entry.weekIndex) && entry.allocatedUnits > 0)
    .sort((a, b) => a.weekIndex - b.weekIndex);
}

function getFirstShiftedWeek(anchor, delta) {
  return Math.floor(anchor + delta);
}

function createShiftId(shifts, anchor) {
  const baseId = `shift-${anchor}`;
  const existingIds = new Set(shifts.map((shift) => shift.id));
  if (!existingIds.has(baseId)) {
    return baseId;
  }

  let suffix = 2;
  while (existingIds.has(`${baseId}-${suffix}`)) {
    suffix += 1;
  }

  return `${baseId}-${suffix}`;
}

function sumAllocations(entries) {
  return roundToTenths(entries.reduce((total, entry) => total + (Number(entry.allocatedUnits) || 0), 0));
}

function sortSchedule(schedule) {
  return schedule.sort((a, b) => a.weekIndex - b.weekIndex || String(a.taskId).localeCompare(String(b.taskId)));
}
