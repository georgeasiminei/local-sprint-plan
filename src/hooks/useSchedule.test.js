import { act, renderHook } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useSchedule } from './useSchedule.js';
import { useTimelineStore } from '../store/index.js';
import { getCurrentIsoWeekInfo } from '../engine/timeline.js';

describe('useSchedule', () => {
  let firstWeekIndex;

  beforeEach(() => {
    // Anchor the plan's first week on the real current week, not a fixed week index -
    // a fixed startWeek: 1 plan is "months in the past" whenever this suite runs later
    // in the year, which triggers the unrelated auto-complete-old-tasks maintenance
    // pass and freezes the very allocations these tests are trying to observe.
    const { weekYear, weekNumber } = getCurrentIsoWeekInfo();
    firstWeekIndex = weekNumber;
    useTimelineStore.setState({ activePlanId: null, plans: [], undoStack: [], redoStack: [] });
    useTimelineStore.getState().createPlan('Plan', {
      startingResourceCount: 5,
      startWeek: weekNumber,
      startYear: weekYear,
    });
  });

  it('recalculates after a manual allocation so sibling tasks scheduled the same week lose that capacity', () => {
    const store = useTimelineStore.getState();
    const taskAId = store.addTask({ name: 'Task A', estimateWeeks: 20 });
    const taskBId = store.addTask({ name: 'Task B', estimateWeeks: 20 });

    renderHook(() => useSchedule());

    // Before any manual entry, Task A (added first, higher priority) takes all 5
    // resources in the first week; Task B gets none until A's demand is satisfied.
    let scheduleFirstWeek = useTimelineStore
      .getState()
      .getActiveDocument()
      .schedule.filter((entry) => entry.weekIndex === firstWeekIndex);
    expect(scheduleFirstWeek.find((entry) => entry.taskId === taskAId)?.allocatedUnits).toBe(5);
    expect(scheduleFirstWeek.find((entry) => entry.taskId === taskBId)).toBeUndefined();

    act(() => {
      // Manually reserve 4 of the 5 resources in the first week for Task B.
      store.setManualAllocation(taskBId, firstWeekIndex, 4);
    });

    scheduleFirstWeek = useTimelineStore
      .getState()
      .getActiveDocument()
      .schedule.filter((entry) => entry.weekIndex === firstWeekIndex);
    // Task A must now be recalculated down to the 1 resource left over, not still show 5.
    expect(scheduleFirstWeek.find((entry) => entry.taskId === taskAId)?.allocatedUnits).toBe(1);
    expect(scheduleFirstWeek.find((entry) => entry.taskId === taskBId)).toEqual({
      taskId: taskBId,
      weekIndex: firstWeekIndex,
      allocatedUnits: 4,
      isManual: true,
    });
  });

  it('does not recompute the schedule for a display-only edit like renaming a task', () => {
    const store = useTimelineStore.getState();
    const taskId = store.addTask({ name: 'Original name', estimateWeeks: 2 });

    renderHook(() => useSchedule());

    const scheduleBefore = useTimelineStore.getState().getActiveDocument().schedule;

    act(() => {
      store.updateTask(taskId, { name: 'Renamed', notes: 'Some notes' });
    });

    const scheduleAfter = useTimelineStore.getState().getActiveDocument().schedule;
    // Same reference: recalculateActiveSchedule's schedule-write is skipped entirely
    // because the scheduling-relevant inputs did not change.
    expect(scheduleAfter).toBe(scheduleBefore);
  });
});
