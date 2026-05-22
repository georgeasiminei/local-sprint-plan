const DAY_MS = 24 * 60 * 60 * 1000;

export function compressScheduleToIntervals(entries = []) {
  const positiveEntries = [...entries]
    .filter((entry) => Number(entry.allocatedUnits) > 0)
    .sort((a, b) => a.weekIndex - b.weekIndex);

  return positiveEntries.reduce((intervals, entry) => {
    const last = intervals.at(-1);
    const allocatedUnits = roundAllocation(entry.allocatedUnits);
    const rawAllocatedUnits = roundAllocation(entry.rawAllocatedUnits ?? entry.allocatedUnits);

    if (
      last &&
      last.endWeek + 1 === entry.weekIndex &&
      last.allocatedUnits === allocatedUnits &&
      (last.rawAllocatedUnits ?? last.allocatedUnits) === rawAllocatedUnits
    ) {
      last.endWeek = entry.weekIndex;
      return intervals;
    }

    intervals.push({
      startWeek: entry.weekIndex,
      endWeek: entry.weekIndex,
      allocatedUnits,
      ...(rawAllocatedUnits !== allocatedUnits ? { rawAllocatedUnits } : {}),
    });
    return intervals;
  }, []);
}

export function expandCompletedIntervals(taskId, intervals = []) {
  return intervals.flatMap((interval) => {
    const startWeek = interval.startWeek;
    const endWeek = interval.endWeek ?? interval.startWeek;
    const entries = [];

    for (let weekIndex = startWeek; weekIndex <= endWeek; weekIndex += 1) {
      entries.push({
        taskId,
        weekIndex,
        allocatedUnits: roundAllocation(interval.allocatedUnits),
        ...(interval.rawAllocatedUnits !== null && interval.rawAllocatedUnits !== undefined
          ? { rawAllocatedUnits: roundAllocation(interval.rawAllocatedUnits) }
          : {}),
        isManual: false,
        isCompleted: true,
      });
    }

    return entries;
  });
}

export function getTaskScheduleEntries(schedule = [], taskId) {
  return schedule
    .filter((entry) => entry.taskId === taskId && Number(entry.allocatedUnits) > 0)
    .sort((a, b) => a.weekIndex - b.weekIndex);
}

export function isTaskCompletionAvailable(document, taskId, today = new Date()) {
  const window = getTaskExecutionWindow(document, taskId);
  if (!window) {
    return false;
  }

  return today >= new Date(`${window.lastWeek.startDate}T00:00:00`);
}

export function shouldAutoCompleteTask(document, taskId, today = new Date()) {
  const window = getTaskExecutionWindow(document, taskId);
  if (!window) {
    return false;
  }

  const lastWeekEnd = new Date(`${window.lastWeek.endDate}T23:59:59`);
  return today.getTime() - lastWeekEnd.getTime() > 21 * DAY_MS;
}

export function getTaskExecutionWindow(document, taskId) {
  const entries = getTaskScheduleEntries(document.schedule ?? [], taskId);
  const lastEntry = entries.at(-1);
  if (!lastEntry) {
    return null;
  }

  const weekByIndex = new Map((document.weeks ?? []).map((week) => [week.weekIndex, week]));
  const firstWeek = weekByIndex.get(entries[0].weekIndex);
  const lastWeek = weekByIndex.get(lastEntry.weekIndex);
  if (!firstWeek?.startDate || !lastWeek?.startDate || !lastWeek?.endDate) {
    return null;
  }

  return { entries, firstWeek, lastWeek };
}

export function freezeTaskFromSchedule(task, schedule = []) {
  const completedIntervals = compressScheduleToIntervals(getTaskScheduleEntries(schedule, task.id));
  if (completedIntervals.length === 0) {
    return task;
  }

  return {
    ...task,
    completed: true,
    completedIntervals,
  };
}

export function clearTaskCompletion(task) {
  const { completed, completedIntervals, ...rest } = task;
  return rest;
}

function roundAllocation(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}
