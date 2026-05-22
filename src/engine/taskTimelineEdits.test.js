import { describe, expect, it } from 'vitest';
import { createPlanDocument } from '../persistence/schema.js';
import { deleteTaskShift, findTaskShiftAtWeek, shiftTaskRemainder, splitTaskAtWeek } from './taskTimelineEdits.js';

describe('task timeline edits', () => {
  it('shifts remaining work from the selected week and allows fractional gaps', () => {
    const document = createPlanDocument({ startWeek: 1, startingResourceCount: 10 });
    document.tasks = [
      { id: 'task-1', name: 'Blocked task', priority: 1, estimateWeeks: 30, maxResources: 10 },
    ];
    document.schedule = [
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 10, isManual: false },
      { taskId: 'task-1', weekIndex: 2, allocatedUnits: 10, isManual: false },
      { taskId: 'task-1', weekIndex: 3, allocatedUnits: 10, isManual: false },
    ];

    const result = shiftTaskRemainder(document, 'task-1', 2, 1.5);

    expect(result.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 10, isManual: true },
      { taskId: 'task-1', weekIndex: 3, allocatedUnits: 5, isManual: true },
      { taskId: 'task-1', weekIndex: 4, allocatedUnits: 10, isManual: true },
      { taskId: 'task-1', weekIndex: 5, allocatedUnits: 5, isManual: true },
    ]);
    expect(result.tasks[0].shiftRules).toEqual([
      {
        id: 'shift-2',
        anchorWeekIndex: 2,
        weekDelta: 1.5,
        firstShiftedWeek: 3,
        sourceEntries: [
          { weekIndex: 2, allocatedUnits: 10 },
          { weekIndex: 3, allocatedUnits: 10 },
        ],
      },
    ]);
  });

  it('updates and deletes a stored shift from its first shifted week', () => {
    const document = createPlanDocument({ startWeek: 1, startingResourceCount: 10 });
    document.tasks = [
      { id: 'task-1', name: 'Blocked task', priority: 1, estimateWeeks: 30, maxResources: 10 },
    ];
    document.schedule = [
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 10, isManual: false },
      { taskId: 'task-1', weekIndex: 2, allocatedUnits: 10, isManual: false },
      { taskId: 'task-1', weekIndex: 3, allocatedUnits: 10, isManual: false },
    ];

    const shifted = shiftTaskRemainder(document, 'task-1', 2, 1.5);
    const shift = findTaskShiftAtWeek(shifted.tasks[0], 3);
    const updated = shiftTaskRemainder(shifted, 'task-1', shift.anchorWeekIndex, 2, shift.id);
    const restored = deleteTaskShift(updated, 'task-1', shift.id);

    expect(updated.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 10, isManual: true },
      { taskId: 'task-1', weekIndex: 4, allocatedUnits: 10, isManual: true },
      { taskId: 'task-1', weekIndex: 5, allocatedUnits: 10, isManual: true },
    ]);
    expect(updated.tasks[0].shiftRules[0]).toMatchObject({
      id: shift.id,
      anchorWeekIndex: 2,
      weekDelta: 2,
      firstShiftedWeek: 4,
    });
    expect(restored.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 10, isManual: true },
      { taskId: 'task-1', weekIndex: 2, allocatedUnits: 10, isManual: true },
      { taskId: 'task-1', weekIndex: 3, allocatedUnits: 10, isManual: true },
    ]);
    expect(restored.tasks[0].shiftRules).toBeUndefined();
  });

  it('splits a task at the selected week and keeps settings on the new task', () => {
    const document = createPlanDocument({ startWeek: 1, startingResourceCount: 10 });
    document.categories = [{ id: 'cat-1', name: 'Delivery', order: 1, color: '#e0f2fe' }];
    document.tasks = [
      {
        id: 'task-1',
        categoryId: 'cat-1',
        name: 'Long task',
        priority: 1,
        estimateWeeks: 25,
        maxResources: 10,
        highlightColor: '#bae6fd',
        notes: 'Keep this context',
      },
    ];
    document.schedule = [
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 10, isManual: false },
      { taskId: 'task-1', weekIndex: 2, allocatedUnits: 10, isManual: false },
      { taskId: 'task-1', weekIndex: 3, allocatedUnits: 5, isManual: false },
    ];

    const result = splitTaskAtWeek(document, 'task-1', 2, 'task-2');

    expect(result.tasks).toEqual([
      expect.objectContaining({
        id: 'task-1',
        categoryId: 'cat-1',
        estimateWeeks: 10,
        highlightColor: '#bae6fd',
        notes: 'Keep this context',
        priority: 1,
      }),
      expect.objectContaining({
        id: 'task-2',
        categoryId: 'cat-1',
        name: 'Long task (split)',
        estimateWeeks: 15,
        earliestStartWeek: 2,
        maxResources: 10,
        highlightColor: '#bae6fd',
        notes: 'Keep this context',
        priority: 2,
      }),
    ]);
    expect(result.schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 10, isManual: true },
      { taskId: 'task-2', weekIndex: 2, allocatedUnits: 10, isManual: true },
      { taskId: 'task-2', weekIndex: 3, allocatedUnits: 5, isManual: true },
    ]);
  });
});
