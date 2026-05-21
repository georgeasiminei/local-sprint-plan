import { beforeEach, describe, expect, it } from 'vitest';
import { useTimelineStore } from './index.js';

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
});
