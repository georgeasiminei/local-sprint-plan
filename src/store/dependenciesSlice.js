import { createId } from '../utils/uuid.js';

export function createDependenciesSlice(set, get) {
  return {
    addDependency: (predecessorId, successorId, lagWeeks = 0) => {
      const currentDocument = get().getActiveDocument();
      const id = createId('dependency', (currentDocument?.dependencies ?? []).map((dependency) => dependency.id));

      get().updateActiveDocument((document) => {
        if (!predecessorId || !successorId || predecessorId === successorId) {
          return document;
        }

        const exists = document.dependencies.some(
          (dependency) =>
            dependency.predecessorId === predecessorId && dependency.successorId === successorId,
        );
        if (exists) {
          return document;
        }

        return {
          ...document,
          dependencies: [
            ...document.dependencies,
            {
              id,
              predecessorId,
              successorId,
              lagWeeks: Math.max(0, Number(lagWeeks) || 0),
            },
          ],
        };
      });

      set({
        selectedDependencyId: id,
        selectedExternalDependencyId: null,
        selectedTaskId: null,
        selectedCategoryId: null,
        selectedWeekIndex: null,
        activePanel: 'dependency',
        isSettingsOpen: false,
        isSidebarOpen: true,
      });
      return id;
    },
    updateDependency: (dependencyId, patch) =>
      get().updateActiveDocument((document) => ({
        ...document,
        dependencies: document.dependencies.map((dependency) =>
          dependency.id === dependencyId
            ? {
                ...dependency,
                ...patch,
                lagWeeks:
                  patch.lagWeeks === undefined ? dependency.lagWeeks : Math.max(0, Number(patch.lagWeeks) || 0),
              }
            : dependency,
        ),
      })),
    removeDependency: (dependencyId) =>
      get().updateActiveDocument((document) => ({
        ...document,
        dependencies: document.dependencies.filter((item) => item.id !== dependencyId),
      })),
    addExternalDependency: (dependency = {}) => {
      const currentDocument = get().getActiveDocument();
      const id = createId(
        'external-dependency',
        (currentDocument?.externalDependencies ?? []).map((item) => item.id),
      );

      get().updateActiveDocument((document) => {
        const dueWeek = Math.max(
          1,
          Number(dependency.dueWeek ?? dependency.startWeek ?? dependency.endWeek) || document.plan?.startWeek || 1,
        );

        return {
          ...document,
          externalDependencies: [
            ...(document.externalDependencies ?? []),
            {
              id,
              name: dependency.name || 'External dependency',
              dueWeek,
              status: normalizeExternalDependencyStatus(dependency.status),
              notes: dependency.notes ?? '',
            },
          ],
        };
      });

      set({
        selectedExternalDependencyId: id,
        selectedDependencyId: null,
        selectedTaskId: null,
        selectedCategoryId: null,
        selectedWeekIndex: null,
        activePanel: 'dependency',
        isSettingsOpen: false,
        isSidebarOpen: true,
      });
      return id;
    },
    updateExternalDependency: (dependencyId, patch) =>
      get().updateActiveDocument((document) => ({
        ...document,
        externalDependencies: (document.externalDependencies ?? []).map((dependency) => {
          if (dependency.id !== dependencyId) {
            return dependency;
          }

          const currentDueWeek = dependency.dueWeek ?? dependency.endWeek ?? dependency.startWeek ?? document.plan?.startWeek ?? 1;
          const nextDueWeek =
            patch.dueWeek === undefined && patch.startWeek === undefined && patch.endWeek === undefined
              ? currentDueWeek
              : Math.max(1, Number(patch.dueWeek ?? patch.endWeek ?? patch.startWeek) || currentDueWeek);

          return {
            ...dependency,
            ...patch,
            dueWeek: nextDueWeek,
            status:
              patch.status === undefined
                ? normalizeExternalDependencyStatus(dependency.status)
                : normalizeExternalDependencyStatus(patch.status),
          };
        }),
      })),
    removeExternalDependency: (dependencyId) =>
      get().updateActiveDocument((document) => ({
        ...document,
        externalDependencies: (document.externalDependencies ?? []).filter((item) => item.id !== dependencyId),
      })),
  };
}

function normalizeExternalDependencyStatus(status) {
  return ['yes', 'partial', 'no'].includes(status) ? status : 'no';
}
