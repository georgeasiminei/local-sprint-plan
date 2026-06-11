import { describe, expect, it } from 'vitest';
import { getExternalDependencyHighlightTaskIds } from './externalDependencyHighlights.js';

describe('getExternalDependencyHighlightTaskIds', () => {
  it('combines the related task and hard dependency successors', () => {
    const highlightedTaskIds = getExternalDependencyHighlightTaskIds(
      {
        categories: [{ id: 'category-1', name: 'Delivery' }],
        tasks: [
          { id: 'task-1', name: 'Related' },
          { id: 'task-2', name: 'Direct successor' },
          { id: 'task-3', categoryId: 'category-1', name: 'Category successor' },
          { id: 'task-4', name: 'Unrelated' },
        ],
        externalDependencies: [{ id: 'external-1', name: 'Vendor input', relatedTaskId: 'task-1' }],
        dependencies: [
          {
            id: 'dep-1',
            predecessorType: 'external',
            predecessorId: 'external-1',
            successorType: 'task',
            successorId: 'task-2',
          },
          {
            id: 'dep-2',
            predecessorType: 'external',
            predecessorId: 'external-1',
            successorType: 'category',
            successorId: 'category-1',
          },
        ],
      },
      'external-1',
    );

    expect([...highlightedTaskIds].sort()).toEqual(['task-1', 'task-2', 'task-3']);
  });
});
