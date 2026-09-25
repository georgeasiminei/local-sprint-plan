import { beforeEach, describe, expect, it } from 'vitest';
import { useTimelineStore } from './index.js';
import { MAX_VALID_START_YEAR, MIN_VALID_START_YEAR } from '../constants/defaults.js';
import { PLANNING_WEEKS_PER_YEAR } from '../engine/timeline.js';

describe('plan slice', () => {
  beforeEach(() => {
    useTimelineStore.setState({
      activePlanId: null,
      plans: [],
      undoStack: [],
      redoStack: [],
      savedPlanId: null,
      savedPlanName: null,
    });
    useTimelineStore.getState().createPlan('Plan');
  });

  it('does not rewrite starting week resources for unrelated plan setting changes', () => {
    const store = useTimelineStore.getState();
    const before = store.getActiveDocument();

    store.updatePlanSettings({ rowHeight: 22 });

    const after = useTimelineStore.getState().getActiveDocument();
    expect(after.weekResources).toEqual(before.weekResources);
  });

  it('preserves the current schedule for display-only setting changes', () => {
    const store = useTimelineStore.getState();
    store.updateActiveDocument((document) => ({
      ...document,
      schedule: [{ taskId: 'task-1', weekIndex: 1, allocatedUnits: 1, isManual: false }],
    }));

    store.updatePlanSettings({ rowHeight: 22 });

    expect(useTimelineStore.getState().getActiveDocument().schedule).toEqual([
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 1, isManual: false },
    ]);
  });

  it('clears undo and redo history when hydrating another plan', () => {
    const store = useTimelineStore.getState();
    store.updatePlanSettings({ rowHeight: 22 });
    store.updatePlanSettings({ rowHeight: 23 });
    store.undo();

    expect(useTimelineStore.getState().undoStack.length).toBeGreaterThan(0);
    expect(useTimelineStore.getState().redoStack.length).toBeGreaterThan(0);

    const nextDocument = {
      ...store.getActiveDocument(),
      plan: {
        ...store.getActiveDocument().plan,
        id: 'loaded-plan',
        name: 'Loaded plan',
      },
    };

    store.hydratePlan(nextDocument);

    expect(useTimelineStore.getState().undoStack).toEqual([]);
    expect(useTimelineStore.getState().redoStack).toEqual([]);
  });

  it('caps undo history at fifty documents', () => {
    const store = useTimelineStore.getState();

    for (let index = 0; index < 60; index += 1) {
      store.updatePlanSettings({ rowHeight: 19 + (index % 3) });
    }

    expect(useTimelineStore.getState().undoStack).toHaveLength(50);
  });

  it('reorders tasks within their category and refreshes priority', () => {
    const store = useTimelineStore.getState();
    const categoryId = store.addCategory('Delivery');
    const firstId = store.addTask({ name: 'First', categoryId });
    const secondId = store.addTask({ name: 'Second', categoryId });

    store.moveTask(secondId, 'up');

    const tasks = useTimelineStore.getState().getActiveDocument().tasks;
    expect(tasks.map((task) => task.id)).toEqual([secondId, firstId]);
    expect(tasks.map((task) => task.priority)).toEqual([1, 2]);
  });

  it('reorders categories and refreshes order', () => {
    const store = useTimelineStore.getState();
    const firstId = store.addCategory('First');
    const secondId = store.addCategory('Second');

    store.moveCategory(secondId, 'up');

    const categories = useTimelineStore.getState().getActiveDocument().categories;
    expect(categories.map((category) => category.id)).toEqual([secondId, firstId]);
    expect(categories.map((category) => category.order)).toEqual([1, 2]);
  });

  it('clamps start week and start year instead of accepting any typed value', () => {
    const store = useTimelineStore.getState();

    store.updatePlanSettings({ startWeek: 999 });
    expect(useTimelineStore.getState().getActiveDocument().plan.startWeek).toBe(PLANNING_WEEKS_PER_YEAR);

    store.updatePlanSettings({ startWeek: -5 });
    expect(useTimelineStore.getState().getActiveDocument().plan.startWeek).toBe(1);

    store.updatePlanSettings({ startYear: 26 });
    expect(useTimelineStore.getState().getActiveDocument().plan.startYear).toBe(MIN_VALID_START_YEAR);

    store.updatePlanSettings({ startYear: 9999 });
    expect(useTimelineStore.getState().getActiveDocument().plan.startYear).toBe(MAX_VALID_START_YEAR);
  });

  it('shifts plan/category/task vacations, shift rules, and manual schedule rows together with the start week', () => {
    const store = useTimelineStore.getState();
    const categoryId = store.addCategory('Delivery');
    const taskId = store.addTask({ name: 'Task A', categoryId });

    store.updateActiveDocument((document) => ({
      ...document,
      plan: { ...document.plan, vacations: [{ weekIndex: 3, dayCount: 2 }] },
      categories: document.categories.map((category) =>
        category.id === categoryId ? { ...category, vacations: [{ weekIndex: 3, dayCount: 1 }] } : category,
      ),
      tasks: document.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              vacations: [{ weekIndex: 3, dayCount: 0.5 }],
              shiftRules: [
                {
                  id: 'shift-3',
                  anchorWeekIndex: 3,
                  weekDelta: 2,
                  firstShiftedWeek: 5,
                  sourceEntries: [{ weekIndex: 3, allocatedUnits: 2 }],
                },
              ],
            }
          : task,
      ),
      schedule: [{ taskId, weekIndex: 3, allocatedUnits: 2, isManual: true }],
    }));

    // Default start week is 1, so this is a delta of +7.
    store.updatePlanSettings({ startWeek: 8 });

    const document = useTimelineStore.getState().getActiveDocument();
    const task = document.tasks.find((item) => item.id === taskId);
    const category = document.categories.find((item) => item.id === categoryId);

    expect(document.plan.vacations).toEqual([{ weekIndex: 10, dayCount: 2 }]);
    expect(category.vacations).toEqual([{ weekIndex: 10, dayCount: 1 }]);
    expect(task.vacations).toEqual([{ weekIndex: 10, dayCount: 0.5 }]);
    expect(task.shiftRules).toEqual([
      {
        id: 'shift-3',
        anchorWeekIndex: 10,
        weekDelta: 2,
        firstShiftedWeek: 12,
        sourceEntries: [{ weekIndex: 10, allocatedUnits: 2 }],
      },
    ]);
    expect(document.schedule.find((entry) => entry.taskId === taskId).weekIndex).toBe(10);
  });

  it('does not push an undo entry or clear the redo stack for a no-op update', () => {
    const store = useTimelineStore.getState();
    store.updatePlanSettings({ rowHeight: 22 });
    store.undo();

    const undoStackBefore = useTimelineStore.getState().undoStack;
    const redoStackBefore = useTimelineStore.getState().redoStack;
    expect(redoStackBefore.length).toBeGreaterThan(0);

    // Returning the same document reference is a no-op (e.g. a rejected action).
    store.updateActiveDocument((document) => document);

    expect(useTimelineStore.getState().undoStack).toEqual(undoStackBefore);
    expect(useTimelineStore.getState().redoStack).toEqual(redoStackBefore);
  });

  it('resets UI selection when hydrating a different plan', () => {
    const store = useTimelineStore.getState();
    const taskId = store.addTask({ name: 'Task A' });
    store.selectTask(taskId);
    expect(useTimelineStore.getState().selectedTaskId).toBe(taskId);

    const nextDocument = {
      ...store.getActiveDocument(),
      plan: { ...store.getActiveDocument().plan, id: 'loaded-plan', name: 'Loaded plan' },
    };
    store.hydratePlan(nextDocument);

    expect(useTimelineStore.getState().selectedTaskId).toBeNull();
    expect(useTimelineStore.getState().isSidebarOpen).toBe(false);
  });
});
