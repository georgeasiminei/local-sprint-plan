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
        selectedDependencyId: null,
        selectedExternalDependencyId: null,
        selectedWeekIndex: null,
        activePanel: 'category',
        isSettingsOpen: false,
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

function setVacationDays(vacations = [], weekIndex, dayCount) {
  const normalizedDayCount = Math.max(0, Math.floor(Number(dayCount) || 0));
  const retained = vacations.filter((vacation) => vacation.weekIndex !== weekIndex);

  if (normalizedDayCount === 0) {
    return retained;
  }

  return [...retained, { weekIndex, dayCount: normalizedDayCount }].sort((a, b) => a.weekIndex - b.weekIndex);
}
