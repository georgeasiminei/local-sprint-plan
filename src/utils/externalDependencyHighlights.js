import { getEntityTasks } from './dependencies.js';

export function getExternalDependencyHighlightTaskIds(document, externalDependencyId) {
  if (!document || !externalDependencyId) {
    return new Set();
  }

  const highlightedTaskIds = new Set();
  const externalDependency = (document.externalDependencies ?? []).find((item) => item.id === externalDependencyId);

  if (externalDependency?.relatedTaskId) {
    highlightedTaskIds.add(externalDependency.relatedTaskId);
  }

  for (const dependency of document.dependencies ?? []) {
    if ((dependency.predecessorType ?? 'task') !== 'external' || dependency.predecessorId !== externalDependencyId) {
      continue;
    }

    for (const task of getEntityTasks(
      document.tasks ?? [],
      document.categories ?? [],
      dependency.successorType ?? 'task',
      dependency.successorId,
    )) {
      highlightedTaskIds.add(task.id);
    }
  }

  return highlightedTaskIds;
}
