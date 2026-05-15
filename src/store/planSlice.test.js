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

  it('caps undo history at fifty documents', () => {
    const store = useTimelineStore.getState();

    for (let index = 0; index < 60; index += 1) {
      store.updatePlanSettings({ rowHeight: 19 + (index % 3) });
    }

    expect(useTimelineStore.getState().undoStack).toHaveLength(50);
  });
});
