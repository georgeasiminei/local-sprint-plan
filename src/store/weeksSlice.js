import { createId } from '../utils/uuid.js';

export function createWeeksSlice(set, get) {
  return {
    addWeek: (week = {}) =>
      get().updateActiveDocument((document) => ({
        ...document,
        weeks: [
          ...document.weeks,
          {
            id: createId('week'),
            label: `W${document.weeks.length + 1}`,
            weekIndex: document.weeks.length + 1,
            startDate: null,
            endDate: null,
            ...week,
          },
        ],
      })),
  };
}
