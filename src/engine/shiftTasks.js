export function shiftTasks(tasks = [], taskIds = [], weekDelta = 0, fallbackStartWeek = 1) {
  const selected = new Set(taskIds);

  return tasks.map((task) => {
    if (!selected.has(task.id)) {
      return task;
    }

    return {
      ...task,
      earliestStartWeek: Math.max(1, (task.earliestStartWeek ?? fallbackStartWeek) + weekDelta),
      resourceOverrides: (task.resourceOverrides ?? []).map((override) => ({
        ...override,
        weekIndex: Math.max(1, override.weekIndex + weekDelta),
      })),
    };
  });
}
