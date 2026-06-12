import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import { createPlanDocument } from '../../persistence/schema.js';
import EffortSummaryRow from './EffortSummaryRow.jsx';

describe('EffortSummaryRow', () => {
  it('shows resolved week capacity as the resource total', () => {
    const document = createPlanDocument({ startWeek: 1, startingResourceCount: 13 });
    document.schedule = [
      { taskId: 'task-1', weekIndex: 1, allocatedUnits: 9, rawAllocatedUnits: 13.6, isManual: false },
    ];

    render(<EffortSummaryRow document={document} rowHeight={19} weekColumnWidth={48} />);

    expect(screen.getByText('9.0/13.0')).toBeInTheDocument();
  });
});
