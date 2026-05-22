import { describe, expect, it } from 'vitest';
import { createPlanDocument } from '../persistence/schema.js';
import { recalculateSchedule } from './scheduler.js';

describe('recalculateSchedule', () => {
  it('uses arbitrary start week and calculates enough weeks for the work', () => {
    const document = createPlanDocument({
      name: 'Scheduler fixture',
      startWeek: 10,
      startingResourceCount: 5,
    });
    document.tasks = [
      {
        id: 'task-1',
        categoryId: null,
        name: 'Large task',
        priority: 1,
        estimateWeeks: 12,
        calcWeeks: 0,
        earliestStartWeek: null,
        maxResources: null,
      },
    ];

    const result = recalculateSchedule(document);

    expect(result.weeks[0].weekIndex).toBe(10);
    expect(result.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 10, allocatedUnits: 5, isManual: false },
      { taskId: 'task-1', weekIndex: 11, allocatedUnits: 5, isManual: false },
      { taskId: 'task-1', weekIndex: 12, allocatedUnits: 2, isManual: false },
    ]);
    expect(result.tasks[0].calcWeeks).toBe(3);
  });

  it('inherits resource changes and reduces capacity for working-day adjustments', () => {
    const document = createPlanDocument({
      name: 'Capacity fixture',
      startWeek: 1,
      startingResourceCount: 4,
    });
    const teamId = document.teams[0].id;
    document.weekResources.push({
      id: 'week-resource-change',
      teamId,
      weekIndex: 2,
      resourceCount: 2,
    });
    document.freedays = [
      { id: 'free-1', teamId, weekIndex: 2, date: null, reason: 'Capacity adjustment' },
      { id: 'free-2', teamId, weekIndex: 2, date: null, reason: 'Capacity adjustment' },
    ];
    document.tasks = [
      {
        id: 'task-1',
        categoryId: null,
        name: 'Capacity task',
        priority: 1,
        estimateWeeks: 7,
        calcWeeks: 0,
        earliestStartWeek: null,
        maxResources: null,
      },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 4, isManual: false },
      { taskId: 'task-1', weekIndex: 2, allocatedUnits: 1.2, rawAllocatedUnits: 2, isManual: false },
      { taskId: 'task-1', weekIndex: 3, allocatedUnits: 1.8, isManual: false },
    ]);
  });

  it('applies working-day reductions to every capped task in the week', () => {
    const document = createPlanDocument({
      name: 'Shared day off fixture',
      startWeek: 1,
      startingResourceCount: 5,
    });
    const teamId = document.teams[0].id;
    document.freedays = [{ id: 'free-1', teamId, weekIndex: 1, date: null, reason: 'Holiday' }];
    document.tasks = [
      {
        id: 'task-1',
        categoryId: null,
        name: 'First capped task',
        priority: 1,
        estimateWeeks: 10,
        calcWeeks: 0,
        earliestStartWeek: null,
        maxResources: 2,
      },
      {
        id: 'task-2',
        categoryId: null,
        name: 'Second capped task',
        priority: 2,
        estimateWeeks: 10,
        calcWeeks: 0,
        earliestStartWeek: null,
        maxResources: 3,
      },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule.filter((entry) => entry.weekIndex === 1)).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 1.6, rawAllocatedUnits: 2, isManual: false },
      { taskId: 'task-2', weekIndex: 1, allocatedUnits: 2.4, rawAllocatedUnits: 3, isManual: false },
    ]);
  });

  it('schedules fractional estimates to one decimal place', () => {
    const document = createPlanDocument({
      name: 'Fractional estimate fixture',
      startWeek: 1,
      startingResourceCount: 5,
    });
    document.tasks = [
      {
        id: 'task-1',
        categoryId: null,
        name: 'Fractional task',
        priority: 1,
        estimateWeeks: 12.7,
        calcWeeks: 0,
        earliestStartWeek: null,
        maxResources: null,
      },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 5, isManual: false },
      { taskId: 'task-1', weekIndex: 2, allocatedUnits: 5, isManual: false },
      { taskId: 'task-1', weekIndex: 3, allocatedUnits: 2.7, isManual: false },
    ]);
  });

  it('reduces category task capacity for category vacation days without changing raw resources', () => {
    const document = createPlanDocument({
      name: 'Category vacation fixture',
      startWeek: 1,
      startingResourceCount: 4,
    });
    document.categories = [
      {
        id: 'category-1',
        name: 'Delivery',
        order: 1,
        color: '#e0f2fe',
        vacations: [{ weekIndex: 1, dayCount: 5 }],
      },
    ];
    document.tasks = [
      {
        id: 'task-1',
        categoryId: 'category-1',
        name: 'Vacation adjusted task',
        priority: 1,
        estimateWeeks: 7,
        calcWeeks: 0,
        earliestStartWeek: null,
        maxResources: null,
      },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 3, rawAllocatedUnits: 4, isManual: false },
      { taskId: 'task-1', weekIndex: 2, allocatedUnits: 4, isManual: false },
    ]);
  });

  it('reduces all task capacity for plan-level vacation person-days', () => {
    const document = createPlanDocument({
      name: 'Plan vacation fixture',
      startWeek: 1,
      startingResourceCount: 4,
    });
    document.plan.vacations = [{ weekIndex: 1, dayCount: 10 }];
    document.tasks = [
      {
        id: 'task-1',
        categoryId: null,
        name: 'Global vacation task',
        priority: 1,
        estimateWeeks: 4,
        calcWeeks: 0,
        earliestStartWeek: null,
        maxResources: null,
      },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 2, rawAllocatedUnits: 4, isManual: false },
      { taskId: 'task-1', weekIndex: 2, allocatedUnits: 2, isManual: false },
    ]);
  });

  it('applies plan vacation reductions to every capped task in the week', () => {
    const document = createPlanDocument({
      name: 'Plan vacation capped fixture',
      startWeek: 1,
      startingResourceCount: 5,
    });
    document.plan.vacations = [{ weekIndex: 1, dayCount: 5 }];
    document.tasks = [
      { id: 'task-1', categoryId: null, name: 'First capped task', priority: 1, estimateWeeks: 10, maxResources: 2 },
      { id: 'task-2', categoryId: null, name: 'Second capped task', priority: 2, estimateWeeks: 10, maxResources: 3 },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule.filter((entry) => entry.weekIndex === 1)).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 1.6, rawAllocatedUnits: 2, isManual: false },
      { taskId: 'task-2', weekIndex: 1, allocatedUnits: 2.4, rawAllocatedUnits: 3, isManual: false },
    ]);
  });

  it('applies category vacation reductions only to tasks in that category', () => {
    const document = createPlanDocument({
      name: 'Category vacation capped fixture',
      startWeek: 1,
      startingResourceCount: 5,
    });
    document.categories = [
      {
        id: 'category-1',
        name: 'Delivery',
        order: 1,
        color: '#e0f2fe',
        vacations: [{ weekIndex: 1, dayCount: 5 }],
      },
    ];
    document.tasks = [
      { id: 'task-1', categoryId: 'category-1', name: 'Category capped task', priority: 1, estimateWeeks: 10, maxResources: 2 },
      { id: 'task-2', categoryId: null, name: 'Other capped task', priority: 2, estimateWeeks: 10, maxResources: 3 },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule.filter((entry) => entry.weekIndex === 1)).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 1.6, rawAllocatedUnits: 2, isManual: false },
      { taskId: 'task-2', weekIndex: 1, allocatedUnits: 3, isManual: false },
    ]);
  });

  it('does not start another task when vacation-adjusted tasks have exhausted raw resources', () => {
    const document = createPlanDocument({
      name: 'Raw capacity exhaustion fixture',
      startWeek: 1,
      startingResourceCount: 13,
    });
    document.categories = [
      {
        id: 'category-1',
        name: 'Delivery',
        order: 1,
        color: '#e0f2fe',
        vacations: [{ weekIndex: 1, dayCount: 1 }],
      },
    ];
    document.tasks = [
      { id: 'task-1', categoryId: 'category-1', name: 'Five resource task', priority: 1, estimateWeeks: 20, maxResources: 5 },
      { id: 'task-2', categoryId: 'category-1', name: 'Eight resource task', priority: 2, estimateWeeks: 20, maxResources: 8 },
      { id: 'task-3', categoryId: null, name: 'Should wait', priority: 3, estimateWeeks: 1, maxResources: null },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule.filter((entry) => entry.weekIndex === 1)).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 4.9, rawAllocatedUnits: 5, isManual: false },
      { taskId: 'task-2', weekIndex: 1, allocatedUnits: 7.9, rawAllocatedUnits: 8, isManual: false },
    ]);
    expect(result.schedule).toContainEqual(
      expect.objectContaining({ taskId: 'task-3', weekIndex: 3, allocatedUnits: 1 }),
    );
  });

  it('tracks raw allocation separately when effective rounding would show a partial raw total', () => {
    const document = createPlanDocument({
      name: 'Raw total fixture',
      startWeek: 1,
      startingResourceCount: 13,
    });
    document.plan.vacations = [{ weekIndex: 1, dayCount: 20 }];
    document.tasks = [
      { id: 'task-1', categoryId: null, name: 'Two raw resources', priority: 1, estimateWeeks: 10, maxResources: 2 },
      { id: 'task-2', categoryId: null, name: 'Three raw resources', priority: 2, estimateWeeks: 10, maxResources: 3 },
      { id: 'task-3', categoryId: null, name: 'Remaining raw resources', priority: 3, estimateWeeks: 5.5, maxResources: null },
    ];

    const result = recalculateSchedule(document);
    const weekOneEntries = result.schedule.filter((entry) => entry.weekIndex === 1);

    expect(weekOneEntries).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 1.4, rawAllocatedUnits: 2, isManual: false },
      { taskId: 'task-2', weekIndex: 1, allocatedUnits: 2.1, rawAllocatedUnits: 3, isManual: false },
      { taskId: 'task-3', weekIndex: 1, allocatedUnits: 5.5, rawAllocatedUnits: 8, isManual: false },
    ]);
    expect(weekOneEntries.reduce((total, entry) => total + (entry.rawAllocatedUnits ?? entry.allocatedUnits), 0)).toBe(13);
  });

  it('applies task vacation reductions only to the selected task', () => {
    const document = createPlanDocument({
      name: 'Task vacation fixture',
      startWeek: 1,
      startingResourceCount: 5,
    });
    document.tasks = [
      {
        id: 'task-1',
        categoryId: null,
        name: 'Vacation task',
        priority: 1,
        estimateWeeks: 10,
        maxResources: 2,
        vacations: [{ weekIndex: 1, dayCount: 5 }],
      },
      { id: 'task-2', categoryId: null, name: 'Unaffected task', priority: 2, estimateWeeks: 10, maxResources: 3 },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule.filter((entry) => entry.weekIndex === 1)).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 1, rawAllocatedUnits: 2, isManual: false },
      { taskId: 'task-2', weekIndex: 1, allocatedUnits: 3, isManual: false },
    ]);
  });

  it('preserves manual allocations and schedules the remaining estimate around them', () => {
    const document = createPlanDocument({
      name: 'Manual fixture',
      startWeek: 1,
      startingResourceCount: 4,
    });
    document.tasks = [
      {
        id: 'task-1',
        categoryId: null,
        name: 'Manual task',
        priority: 1,
        estimateWeeks: 6,
        calcWeeks: 0,
        earliestStartWeek: null,
        maxResources: null,
      },
    ];
    document.schedule = [{ taskId: 'task-1', weekIndex: 2, allocatedUnits: 2, isManual: true }];

    const result = recalculateSchedule(document);

    expect(result.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 4, isManual: false },
      { taskId: 'task-1', weekIndex: 2, allocatedUnits: 2, isManual: true },
    ]);
  });

  it('applies task resource overrides from their week onward', () => {
    const document = createPlanDocument({
      name: 'Resource rule fixture',
      startWeek: 1,
      startingResourceCount: 5,
    });
    document.tasks = [
      {
        id: 'task-1',
        categoryId: null,
        name: 'Cascading resource task',
        priority: 1,
        estimateWeeks: 12,
        calcWeeks: 0,
        earliestStartWeek: null,
        maxResources: null,
        resourceOverrides: [{ weekIndex: 2, allocatedUnits: 2 }],
      },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 5, isManual: false },
      { taskId: 'task-1', weekIndex: 2, allocatedUnits: 2, isManual: false },
      { taskId: 'task-1', weekIndex: 3, allocatedUnits: 2, isManual: false },
      { taskId: 'task-1', weekIndex: 4, allocatedUnits: 2, isManual: false },
      { taskId: 'task-1', weekIndex: 5, allocatedUnits: 1, isManual: false },
    ]);
  });

  it('extends visible weeks for external dependency markers', () => {
    const document = createPlanDocument({ startWeek: 1, startingResourceCount: 5 });
    document.externalDependencies = [{ id: 'x1', name: 'Vendor input', dueWeek: 14, status: 'no' }];

    const result = recalculateSchedule(document);

    expect(result.weeks.at(-1).weekIndex).toBe(14);
  });

  it('waits for all predecessor category tasks before scheduling a successor category', () => {
    const document = createPlanDocument({ startWeek: 1, startingResourceCount: 5 });
    document.categories = [
      { id: 'category-1', name: 'Foundation', order: 1 },
      { id: 'category-2', name: 'Delivery', order: 2 },
    ];
    document.tasks = [
      { id: 'task-1', categoryId: 'category-1', name: 'Foundation A', priority: 1, estimateWeeks: 3 },
      { id: 'task-2', categoryId: 'category-1', name: 'Foundation B', priority: 2, estimateWeeks: 4 },
      { id: 'task-3', categoryId: 'category-2', name: 'Delivery A', priority: 3, estimateWeeks: 1 },
    ];
    document.dependencies = [
      {
        id: 'dep-1',
        predecessorType: 'category',
        predecessorId: 'category-1',
        successorType: 'category',
        successorId: 'category-2',
      },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 3, isManual: false },
      { taskId: 'task-2', weekIndex: 1, allocatedUnits: 2, isManual: false },
      { taskId: 'task-2', weekIndex: 2, allocatedUnits: 2, isManual: false },
      { taskId: 'task-3', weekIndex: 3, allocatedUnits: 1, isManual: false },
    ]);
  });

  it('keeps higher-priority newly-unblocked tasks ahead of lower-priority independent work', () => {
    const document = createPlanDocument({ startWeek: 1, startingResourceCount: 1 });
    document.categories = [
      { id: 'category-1', name: 'Foundation', order: 1 },
      { id: 'category-2', name: 'Delivery', order: 2 },
    ];
    document.tasks = [
      { id: 'task-1', categoryId: 'category-1', name: 'Foundation', priority: 1, estimateWeeks: 1 },
      { id: 'task-2', categoryId: 'category-2', name: 'Delivery', priority: 2, estimateWeeks: 1 },
      { id: 'task-3', categoryId: null, name: 'Independent lower priority', priority: 3, estimateWeeks: 2 },
    ];
    document.dependencies = [
      {
        id: 'dep-1',
        predecessorType: 'category',
        predecessorId: 'category-1',
        successorType: 'category',
        successorId: 'category-2',
      },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 1, isManual: false },
      { taskId: 'task-2', weekIndex: 2, allocatedUnits: 1, isManual: false },
      { taskId: 'task-3', weekIndex: 3, allocatedUnits: 1, isManual: false },
      { taskId: 'task-3', weekIndex: 4, allocatedUnits: 1, isManual: false },
    ]);
  });

  it('keeps extending the timeline until long delayed tasks are fully scheduled', () => {
    const document = createPlanDocument({ startWeek: 16, startingResourceCount: 5 });
    document.tasks = [
      {
        id: 'task-1',
        name: 'Long delayed task',
        priority: 1,
        estimateWeeks: 19,
        earliestStartWeek: 18,
        resourceOverrides: [{ weekIndex: 18, allocatedUnits: 2 }],
      },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule).toHaveLength(10);
    expect(result.schedule.at(-1)).toEqual({
      taskId: 'task-1',
      weekIndex: 27,
      allocatedUnits: 1,
      isManual: false,
    });
    expect(result.warnings).toEqual([]);
  });

  it('keeps completed task history frozen when inputs later change', () => {
    const document = createPlanDocument({ startWeek: 1, startingResourceCount: 5 });
    document.tasks = [
      {
        id: 'task-1',
        name: 'Historical task',
        priority: 1,
        estimateWeeks: 99,
        completed: true,
        completedIntervals: [
          { startWeek: 1, endWeek: 2, allocatedUnits: 2 },
          { startWeek: 3, endWeek: 3, allocatedUnits: 1 },
        ],
      },
      {
        id: 'task-2',
        name: 'Next task',
        priority: 2,
        estimateWeeks: 2,
      },
    ];

    const result = recalculateSchedule(document);

    expect(result.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 2, isManual: false, isCompleted: true },
      { taskId: 'task-1', weekIndex: 2, allocatedUnits: 2, isManual: false, isCompleted: true },
      { taskId: 'task-1', weekIndex: 3, allocatedUnits: 1, isManual: false, isCompleted: true },
      { taskId: 'task-2', weekIndex: 1, allocatedUnits: 2, isManual: false },
    ]);
  });

  it('names the tasks involved when reporting dependency cycles', () => {
    const document = createPlanDocument({ startWeek: 1, startingResourceCount: 5 });
    document.tasks = [
      { id: 'task-1', name: 'First', priority: 1, estimateWeeks: 1 },
      { id: 'task-2', name: 'Second', priority: 2, estimateWeeks: 1 },
    ];
    document.dependencies = [
      { id: 'dep-1', predecessorId: 'task-1', successorId: 'task-2' },
      { id: 'dep-2', predecessorId: 'task-2', successorId: 'task-1' },
    ];

    const result = recalculateSchedule(document);

    expect(result.warnings).toContain('Dependency cycle detected involving task-1, task-2.');
  });
});
