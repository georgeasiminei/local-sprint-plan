export function shiftTask(tasks = [], taskId, weekDelta = 0, fallbackStartWeek = 1) {
  return tasks.map((task) => {
    if (task.id !== taskId) {
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
