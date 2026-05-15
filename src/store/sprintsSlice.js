import { createId } from '../utils/uuid.js';

export function createSprintsSlice(set, get) {
  return {
    addSprint: (sprint = {}) =>
      get().updateActiveDocument((document) => ({
        ...document,
        sprints: [
          ...document.sprints,
          {
            id: createId('sprint'),
            name: `Sprint ${document.sprints.length + 1}`,
            startWeek: document.sprints.length * 2 + 1,
            endWeek: document.sprints.length * 2 + 2,
            order: document.sprints.length + 1,
            ...sprint,
          },
        ],
      })),
  };
}
