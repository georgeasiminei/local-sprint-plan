import { describe, expect, it } from 'vitest';
import { createPlanFixture } from '../test/fixtures/planDocument.js';
import { validatePlanDocument } from './validators.js';

describe('validatePlanDocument', () => {
  it('accepts a minimal valid plan document', () => {
    const result = validatePlanDocument(createPlanFixture());

    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });

  it('rejects duplicate task ids', () => {
    const result = validatePlanDocument(
      createPlanFixture({
        tasks: [
          { id: 'task-1', name: 'One', priority: 1, estimateWeeks: 1 },
          { id: 'task-1', name: 'Two', priority: 2, estimateWeeks: 1 },
        ],
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('tasks contains duplicate id: task-1.');
  });

  it('rejects dependencies that point at missing tasks', () => {
    const result = validatePlanDocument(
      createPlanFixture({
        tasks: [{ id: 'task-1', name: 'One', priority: 1, estimateWeeks: 1 }],
        dependencies: [
          {
            id: 'dep-1',
            predecessorId: 'task-1',
            successorId: 'task-missing',
            lagWeeks: 0,
          },
        ],
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Dependency dep-1 references a missing successor task.');
  });

  it('accepts dependencies that target categories', () => {
    const result = validatePlanDocument(
      createPlanFixture({
        categories: [{ id: 'category-1', name: 'Delivery', order: 1 }],
        tasks: [{ id: 'task-1', name: 'One', priority: 1, estimateWeeks: 1 }],
        dependencies: [
          {
            id: 'dep-1',
            predecessorType: 'task',
            predecessorId: 'task-1',
            successorType: 'category',
            successorId: 'category-1',
            lagWeeks: 0,
          },
        ],
      }),
    );

    expect(result.valid).toBe(true);
  });

  it('rejects non-boolean internal dependency line settings', () => {
    const result = validatePlanDocument(
      createPlanFixture({
        plan: { showInternalDependencyLines: 'yes' },
      }),
    );

    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Plan showInternalDependencyLines must be a boolean.');
  });
});
