import { describe, expect, it } from 'vitest';
import { hasDependencyCycle, wouldCreateDependencyCycle } from './dependencyGraph.js';

describe('dependency cycle detection', () => {
  it('detects category cycles even before categories contain tasks', () => {
    const categories = [
      { id: 'category-1', name: 'Foundation' },
      { id: 'category-2', name: 'Delivery' },
    ];
    const dependencies = [
      {
        id: 'dep-1',
        predecessorType: 'category',
        predecessorId: 'category-1',
        successorType: 'category',
        successorId: 'category-2',
      },
      {
        id: 'dep-2',
        predecessorType: 'category',
        predecessorId: 'category-2',
        successorType: 'category',
        successorId: 'category-1',
      },
    ];

    expect(hasDependencyCycle([], categories, dependencies)).toBe(true);
  });

  it('detects task/category cycles created through category membership', () => {
    const document = {
      tasks: [{ id: 'task-1', categoryId: 'category-1', name: 'Own task' }],
      categories: [{ id: 'category-1', name: 'Delivery' }],
      dependencies: [],
    };

    expect(
      wouldCreateDependencyCycle(document, {
        id: 'dep-1',
        predecessorType: 'category',
        predecessorId: 'category-1',
        successorType: 'task',
        successorId: 'task-1',
      }),
    ).toBe(true);
  });
});
