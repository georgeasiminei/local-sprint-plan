import { getEntityTasks, normalizeDependencyEndpointType } from '../utils/dependencies.js';

export function expandDependenciesToTaskEdges(tasks = [], categories = [], dependencies = []) {
  return dependencies.flatMap((dependency) => {
    const predecessorType = normalizeDependencyEndpointType(
      { tasks, categories },
      dependency.predecessorId ?? dependency.fromTaskId,
      dependency.predecessorType,
    );
    const successorType = normalizeDependencyEndpointType(
      { tasks, categories },
      dependency.successorId ?? dependency.toTaskId,
      dependency.successorType,
    );
    const predecessorId = dependency.predecessorId ?? dependency.fromTaskId;
    const successorId = dependency.successorId ?? dependency.toTaskId;
    const predecessorTasks = getEntityTasks(tasks, categories, predecessorType, predecessorId);
    const successorTasks = getEntityTasks(tasks, categories, successorType, successorId);

    return predecessorTasks.flatMap((predecessorTask) =>
      successorTasks.map((successorTask) => ({
        ...dependency,
        predecessorId: predecessorTask.id,
        successorId: successorTask.id,
      })),
    );
  });
}

export function buildDependencyGraph(tasks = [], dependencies = [], categories = []) {
  const taskIds = new Set(tasks.map((task) => task.id));
  const incoming = new Map(tasks.map((task) => [task.id, new Set()]));
  const outgoing = new Map(tasks.map((task) => [task.id, new Set()]));

  for (const dependency of expandDependenciesToTaskEdges(tasks, categories, dependencies)) {
    const predecessorId = dependency.predecessorId;
    const successorId = dependency.successorId;

    if (!taskIds.has(predecessorId) || !taskIds.has(successorId)) {
      continue;
    }

    incoming.get(successorId).add(predecessorId);
    outgoing.get(predecessorId).add(successorId);
  }

  return { incoming, outgoing };
}

export function topologicalSort(tasks = [], dependencies = [], categories = []) {
  const { incoming, outgoing } = buildDependencyGraph(tasks, dependencies, categories);
  const taskOrder = new Map(tasks.map((task, index) => [task.id, index]));
  const queue = tasks.filter((task) => incoming.get(task.id).size === 0).map((task) => task.id);
  const sortedIds = [];

  while (queue.length > 0) {
    const id = queue.shift();
    sortedIds.push(id);

    for (const nextId of outgoing.get(id) ?? []) {
      incoming.get(nextId).delete(id);
      if (incoming.get(nextId).size === 0) {
        queue.push(nextId);
        queue.sort((leftId, rightId) => (taskOrder.get(leftId) ?? 0) - (taskOrder.get(rightId) ?? 0));
      }
    }
  }

  const hasCycle = sortedIds.length !== tasks.length;
  const sortedIdSet = new Set(sortedIds);
  const cycleNodes = hasCycle ? tasks.filter((task) => !sortedIdSet.has(task.id)).map((task) => task.id) : [];
  return { sortedIds, hasCycle, cycleNodes };
}

export function hasDependencyCycle(tasks = [], categories = [], dependencies = []) {
  return topologicalSort(tasks, dependencies, categories).hasCycle || hasEndpointCycle(tasks, categories, dependencies);
}

export function wouldCreateDependencyCycle(document, candidateDependency, replacedDependencyId = null) {
  const dependencies =
    replacedDependencyId === null
      ? [...(document.dependencies ?? []), candidateDependency]
      : (document.dependencies ?? []).map((dependency) =>
          dependency.id === replacedDependencyId ? candidateDependency : dependency,
        );

  return hasDependencyCycle(document.tasks ?? [], document.categories ?? [], dependencies);
}

function hasEndpointCycle(tasks = [], categories = [], dependencies = []) {
  const nodeKeys = [
    ...tasks.map((task) => getNodeKey('task', task.id)),
    ...categories.map((category) => getNodeKey('category', category.id)),
  ];
  const knownNodes = new Set(nodeKeys);
  const incoming = new Map(nodeKeys.map((key) => [key, new Set()]));
  const outgoing = new Map(nodeKeys.map((key) => [key, new Set()]));

  for (const dependency of dependencies) {
    const predecessorType = normalizeDependencyEndpointType(
      { tasks, categories },
      dependency.predecessorId ?? dependency.fromTaskId,
      dependency.predecessorType,
    );
    const successorType = normalizeDependencyEndpointType(
      { tasks, categories },
      dependency.successorId ?? dependency.toTaskId,
      dependency.successorType,
    );
    const predecessorKey = getNodeKey(predecessorType, dependency.predecessorId ?? dependency.fromTaskId);
    const successorKey = getNodeKey(successorType, dependency.successorId ?? dependency.toTaskId);

    if (!knownNodes.has(predecessorKey) || !knownNodes.has(successorKey)) {
      continue;
    }

    incoming.get(successorKey).add(predecessorKey);
    outgoing.get(predecessorKey).add(successorKey);
  }

  const queue = nodeKeys.filter((key) => incoming.get(key).size === 0);
  let visitedCount = 0;

  while (queue.length > 0) {
    const key = queue.shift();
    visitedCount += 1;

    for (const nextKey of outgoing.get(key) ?? []) {
      incoming.get(nextKey).delete(key);
      if (incoming.get(nextKey).size === 0) {
        queue.push(nextKey);
      }
    }
  }

  return visitedCount !== nodeKeys.length;
}

function getNodeKey(type, id) {
  return `${type ?? 'unknown'}:${id ?? 'missing'}`;
}
