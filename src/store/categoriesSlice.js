import { createId } from '../utils/uuid.js';
import { getCategoryColor } from '../utils/colors.js';

export function createCategoriesSlice(set, get) {
  return {
    addCategory: (name = 'New category') => {
      const document = get().getActiveDocument();
      const id = createId('category', (document?.categories ?? []).map((category) => category.id));

      get().updateActiveDocument((document) => ({
        ...document,
        categories: [
          ...document.categories,
          {
            id,
            name,
            order: document.categories.length + 1,
            color: getCategoryColor(document.categories.length),
            collapsed: false,
            vacations: [],
          },
        ],
      }));

      set({
        selectedCategoryId: id,
        selectedTaskId: null,
        selectedTaskWeekIndex: null,
        selectedDependencyId: null,
        selectedExternalDependencyId: null,
        selectedWeekIndex: null,
        activePanel: 'category',
        isSidebarOpen: true,
      });
      return id;
    },
    updateCategory: (categoryId, patch) =>
      get().updateActiveDocument((document) => ({
        ...document,
        categories: document.categories.map((category) =>
          category.id === categoryId ? { ...category, ...patch } : category,
        ),
      })),
    moveCategory: (categoryId, direction) =>
      get().updateActiveDocument((document) => ({
        ...document,
        categories: moveCategory(document.categories, categoryId, direction),
      })),
    setCategoryVacationDays: (categoryId, weekIndex, dayCount) =>
      get().updateActiveDocument((document) => ({
        ...document,
        categories: document.categories.map((category) =>
          category.id === categoryId
            ? {
                ...category,
                vacations: setVacationDays(category.vacations, weekIndex, dayCount),
              }
            : category,
        ),
      })),
    removeCategory: (categoryId) =>
      get().updateActiveDocument((document) => ({
        ...document,
        categories: document.categories.filter((category) => category.id !== categoryId),
        tasks: document.tasks.map((task) => (task.categoryId === categoryId ? { ...task, categoryId: null } : task)),
        dependencies: document.dependencies.filter(
          (dependency) =>
            !((dependency.predecessorType ?? 'task') === 'category' && dependency.predecessorId === categoryId) &&
            !((dependency.successorType ?? 'task') === 'category' && dependency.successorId === categoryId),
        ),
      })),
    toggleCategory: (categoryId) =>
      get().updateActiveDocument((document) => ({
        ...document,
        categories: document.categories.map((category) =>
          category.id === categoryId ? { ...category, collapsed: !category.collapsed } : category,
        ),
      })),
  };
}

function moveCategory(categories, categoryId, direction) {
  const index = categories.findIndex((category) => category.id === categoryId);
  const targetIndex = index + (direction === 'up' ? -1 : 1);

  if (index < 0 || targetIndex < 0 || targetIndex >= categories.length) {
    return categories;
  }

  const nextCategories = [...categories];
  [nextCategories[index], nextCategories[targetIndex]] = [nextCategories[targetIndex], nextCategories[index]];
  return nextCategories.map((category, orderIndex) => ({ ...category, order: orderIndex + 1 }));
}

function setVacationDays(vacations = [], weekIndex, dayCount) {
  const normalizedDayCount = Math.max(0, Math.floor(Number(dayCount) || 0));
  const retained = vacations.filter((vacation) => vacation.weekIndex !== weekIndex);

  if (normalizedDayCount === 0) {
    return retained;
  }

  return [...retained, { weekIndex, dayCount: normalizedDayCount }].sort((a, b) => a.weekIndex - b.weekIndex);
}
