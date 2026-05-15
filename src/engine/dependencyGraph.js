export function buildDependencyGraph(tasks = [], dependencies = []) {
  const taskIds = new Set(tasks.map((task) => task.id));
  const incoming = new Map(tasks.map((task) => [task.id, new Set()]));
  const outgoing = new Map(tasks.map((task) => [task.id, new Set()]));

  for (const dependency of dependencies) {
    const predecessorId = dependency.predecessorId ?? dependency.fromTaskId;
    const successorId = dependency.successorId ?? dependency.toTaskId;

    if (!taskIds.has(predecessorId) || !taskIds.has(successorId)) {
      continue;
    }

    incoming.get(successorId).add(predecessorId);
    outgoing.get(predecessorId).add(successorId);
  }

  return { incoming, outgoing };
}

export function topologicalSort(tasks = [], dependencies = []) {
  const { incoming, outgoing } = buildDependencyGraph(tasks, dependencies);
  const queue = tasks.filter((task) => incoming.get(task.id).size === 0).map((task) => task.id);
  const sortedIds = [];

  while (queue.length > 0) {
    const id = queue.shift();
    sortedIds.push(id);

    for (const nextId of outgoing.get(id) ?? []) {
      incoming.get(nextId).delete(id);
      if (incoming.get(nextId).size === 0) {
        queue.push(nextId);
      }
    }
  }

  const hasCycle = sortedIds.length !== tasks.length;
  return { sortedIds, hasCycle };
}
