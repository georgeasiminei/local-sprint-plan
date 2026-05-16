import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import ExternalDependencyNotes from './ExternalDependencyNotes.jsx';
import { buildCalculatedWeeks } from '../../engine/timeline.js';
import { createPlanFixture } from '../../test/fixtures/planDocument.js';

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
});
