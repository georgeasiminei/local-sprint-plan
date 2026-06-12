import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createPlanDocument } from '../../persistence/schema.js';
import EffortSummaryRow from './EffortSummaryRow.jsx';

describe('EffortSummaryRow', () => {
  it('shows effective assigned resources against resolved raw capacity in effective view', () => {
    const document = createPlanDocument({ startWeek: 1, startingResourceCount: 13 });
    document.schedule = [
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 9, rawAllocatedUnits: 13.6, isManual: false },
    ];

    render(<EffortSummaryRow allocationView="effective" document={document} rowHeight={19} weekColumnWidth={48} />);

    expect(screen.getByText('9.0/13.0')).toBeInTheDocument();
  });

  it('shows raw assigned resources against resolved raw capacity in resource view', () => {
    const document = createPlanDocument({ startWeek: 1, startingResourceCount: 13 });
    document.plan.vacations = [{ weekIndex: 1, dayCount: 9 }];
    document.tasks = [
      { id: 'task-1', name: 'Manual task', priority: 1, estimateWeeks: 2 },
      { id: 'task-2', name: 'Completed task', priority: 2, estimateWeeks: 4 },
      { id: 'task-3', name: 'Capped task A', priority: 3, estimateWeeks: 4, resourceOverrides: [{ weekIndex: 1, allocatedUnits: 3.5 }] },
      { id: 'task-4', name: 'Capped task B', priority: 4, estimateWeeks: 4, resourceOverrides: [{ weekIndex: 1, allocatedUnits: 3.5 }] },
      { id: 'task-5', name: 'Leftover task', priority: 5, estimateWeeks: 1, maxResources: 0.3 },
    ];
    document.schedule = [
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 1.7, isManual: true },
      { taskId: 'task-2', weekIndex: 1, allocatedUnits: 3.4, rawAllocatedUnits: 4, isManual: false, isCompleted: true },
      { taskId: 'task-3', weekIndex: 1, allocatedUnits: 3, rawAllocatedUnits: 3.5, isManual: false },
      { taskId: 'task-4', weekIndex: 1, allocatedUnits: 3, rawAllocatedUnits: 3.5, isManual: false },
      { taskId: 'task-5', weekIndex: 1, allocatedUnits: 0.1, rawAllocatedUnits: 0.3, isManual: false },
    ];

    render(<EffortSummaryRow allocationView="resource" document={document} rowHeight={19} weekColumnWidth={48} />);

    expect(screen.getByText('13.0/13.0')).toBeInTheDocument();
  });
});
