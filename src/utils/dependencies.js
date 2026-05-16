export const DEPENDENCY_ENTITY_TYPES = ['task', 'category'];

export function normalizeDependencyEndpointType(document, entityId, explicitType) {
  if (DEPENDENCY_ENTITY_TYPES.includes(explicitType)) {
    return explicitType;
  }

  if ((document.tasks ?? []).some((task) => task.id === entityId)) {
    return 'task';
  }

  if ((document.categories ?? []).some((category) => category.id === entityId)) {
    return 'category';
  }

  return null;
}

export function getDependencyEndpoint(document, dependency, side) {
  const id = dependency?.[`${side}Id`] ?? null;
  const type = normalizeDependencyEndpointType(document, id, dependency?.[`${side}Type`]);
  const collection = type === 'category' ? document.categories ?? [] : document.tasks ?? [];
  const entity = collection.find((item) => item.id === id) ?? null;

  return { id, type, entity };
}

export function getDependencyEntityName(document, type, id) {
  if (type === 'category') {
    return (document.categories ?? []).find((category) => category.id === id)?.name ?? 'Missing category';
  }

  return (document.tasks ?? []).find((task) => task.id === id)?.name ?? 'Missing task';
}

export function getDependenciesForEntity(document, type, id) {
  return (document.dependencies ?? []).filter((dependency) => {
    const predecessor = getDependencyEndpoint(document, dependency, 'predecessor');
    const successor = getDependencyEndpoint(document, dependency, 'successor');
    return (predecessor.type === type && predecessor.id === id) || (successor.type === type && successor.id === id);
  });
}

export function getEntityTasks(tasks = [], categories = [], type, id) {
  if (type === 'category') {
    return tasks.filter((task) => task.categoryId === id);
  }

  return tasks.filter((task) => task.id === id);
}

export function getDependencyEntityOptions(document, type) {
  if (type === 'category') {
    return (document.categories ?? []).map((category) => ({ id: category.id, name: category.name }));
  }

  return (document.tasks ?? []).map((task) => ({ id: task.id, name: task.name }));
}
