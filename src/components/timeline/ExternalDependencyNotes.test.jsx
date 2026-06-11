import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ExternalDependencyNotes from './ExternalDependencyNotes.jsx';
import { buildCalculatedWeeks, buildFixedSprints } from '../../engine/timeline.js';
import { createPlanFixture } from '../../test/fixtures/planDocument.js';
import { createVisibleTimelineDocument } from './viewWindow.js';

describe('ExternalDependencyNotes', () => {
  afterEach(() => cleanup());

  it('moves overlapping notes from adjacent weeks into separate vertical lanes', () => {
    const document = createPlanFixture({
      weeks: buildCalculatedWeeks(26, 8, 2026),
      externalDependencies: [
        { id: 'x1', name: 'First week 28 dependency', dueWeek: 28, status: 'no' },
        { id: 'x2', name: 'Second week 28 dependency', dueWeek: 28, status: 'no' },
        { id: 'x3', name: 'Week 29 dependency', dueWeek: 29, status: 'no' },
      ],
    });

    render(<ExternalDependencyNotes document={document} weekColumnWidth={48} />);

    expect(screen.getByText('First week 28 dependency')).toHaveStyle({ top: '12px' });
    expect(screen.getByText('Second week 28 dependency')).toHaveStyle({ top: '46px' });
    expect(screen.getByText('Week 29 dependency')).toHaveStyle({ top: '80px' });
  });

  it('keeps hidden incomplete external dependencies visible with their due week in the tooltip', () => {
    const weeks = buildCalculatedWeeks(20, 8, 2026);
    const document = createPlanFixture({
      plan: { viewStartWeek: '26.25' },
      weeks,
      sprints: buildFixedSprints(weeks),
      externalDependencies: [
        { id: 'x1', name: 'Old incomplete dependency', dueWeek: 22, status: 'no' },
        { id: 'x2', name: 'Old completed dependency', dueWeek: 23, status: 'yes' },
        { id: 'x3', name: 'Visible dependency', dueWeek: 25, status: 'no' },
      ],
    });

    render(<ExternalDependencyNotes document={createVisibleTimelineDocument(document)} weekColumnWidth={48} />);

    const hiddenDependency = screen.getByText('<- Old incomplete dependency');
    expect(hiddenDependency).toHaveAttribute('data-tooltip', 'Old incomplete dependency · Due 26.22');
    expect(hiddenDependency).not.toHaveAttribute('title');
    expect(screen.queryByText('Old completed dependency')).not.toBeInTheDocument();
    expect(screen.getByText('Visible dependency')).toHaveAttribute('data-tooltip', 'Visible dependency · Due 26.25');
  });
});
