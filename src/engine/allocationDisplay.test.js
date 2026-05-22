import { describe, expect, it } from 'vitest';
import { createPlanDocument } from '../persistence/schema.js';
import { getResourceAllocationForEntry } from './allocationDisplay.js';

describe('allocation display values', () => {
  it('keeps raw resource caps stable when effective allocations are rounded', () => {
    const document = createPlanDocument({ startWeek: 1, startingResourceCount: 7 });
    const week = document.weeks[0];
    const [team] = document.teams;
    document.plan.vacations = [{ weekIndex: week.weekIndex, dayCount: 1.75 }];
    document.weekResources = [
      {
        id: 'week-resource-1',
        teamId: team.id,
        weekIndex: week.weekIndex,
        resourceCount: 7,
      },
    ];
    document.tasks = [
      { id: 'task-1', name: 'Five resources', priority: 1, estimateWeeks: 10, maxResources: 5 },
      { id: 'task-2', name: 'Two resources', priority: 2, estimateWeeks: 10, maxResources: 2 },
    ];

    expect(
      getResourceAllocationForEntry(document, document.tasks[0], week, {
        taskId: 'task-1',
        weekIndex: week.weekIndex,
        allocatedUnits: 4.8,
      }),
    ).toBe(5);
    expect(
      getResourceAllocationForEntry(document, document.tasks[1], week, {
        taskId: 'task-2',
        weekIndex: week.weekIndex,
        allocatedUnits: 1.9,
      }),
    ).toBe(2);
  });

  it('keeps raw resource overrides stable when task vacation reduces effective work', () => {
    const document = createPlanDocument({ startWeek: 1, startingResourceCount: 5 });
    const week = document.weeks[0];
    document.tasks = [
      {
        id: 'task-1',
        name: 'Task vacation',
        priority: 1,
        estimateWeeks: 10,
        resourceOverrides: [{ weekIndex: week.weekIndex, allocatedUnits: 2 }],
        vacations: [{ weekIndex: week.weekIndex, dayCount: 5 }],
      },
    ];

    expect(
      getResourceAllocationForEntry(document, document.tasks[0], week, {
        taskId: 'task-1',
        weekIndex: week.weekIndex,
        allocatedUnits: 1,
      }),
    ).toBe(2);
  });
});
