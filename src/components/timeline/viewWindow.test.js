import { describe, expect, it } from 'vitest';
import { buildCalculatedWeeks, buildFixedSprints } from '../../engine/timeline.js';
import { createPlanDocument } from '../../persistence/schema.js';
import { createVisibleTimelineDocument, resolveViewStartWeekIndex } from './viewWindow.js';

describe('timeline view window', () => {
  it('keeps all weeks visible when no view start setting is configured', () => {
    const document = createDocument({ viewStartWeek: '' });

    expect(createVisibleTimelineDocument(document)).toBe(document);
  });

  it('hides weeks before an absolute planning week and keeps the first sprint whole', () => {
    const document = createDocument({ startWeek: 19, weekCount: 10, viewStartWeek: '26.22' });

    const visibleDocument = createVisibleTimelineDocument(document);

    expect(resolveViewStartWeekIndex(document)).toBe(22);
    expect(visibleDocument.weeks.map((week) => week.label)).toEqual([
      '26.21',
      '26.22',
      '26.23',
      '26.24',
      '26.25',
      '26.26',
      '26.27',
      '26.28',
    ]);
    expect(visibleDocument.sprints[0]).toMatchObject({
      startWeek: 21,
      endWeek: 22,
      columnStart: 1,
      columnSpan: 2,
    });
    expect(visibleDocument.timelineView.hiddenBeforeWeeks.map((week) => week.label)).toEqual(['26.19', '26.20']);
  });

  it('hides weeks relative to the current planning week and snaps back to a sprint boundary', () => {
    const document = createDocument({ startWeek: 18, weekCount: 12, viewStartWeek: '5' });

    const visibleDocument = createVisibleTimelineDocument(document, new Date('2026-06-24T12:00:00'));

    expect(resolveViewStartWeekIndex(document, new Date('2026-06-24T12:00:00'))).toBe(21);
    expect(visibleDocument.weeks.map((week) => week.label)).toEqual([
      '26.20',
      '26.21',
      '26.22',
      '26.23',
      '26.24',
      '26.25',
      '26.26',
      '26.27',
      '26.28',
      '26.29',
    ]);
  });
});

function createDocument({ startYear = 2026, startWeek = 1, weekCount = 8, viewStartWeek = '' } = {}) {
  const document = createPlanDocument({ startYear, startWeek, viewStartWeek });
  const weeks = buildCalculatedWeeks(startWeek, weekCount, startYear);
  return {
    ...document,
    plan: {
      ...document.plan,
      startYear,
      startWeek,
      viewStartWeek,
    },
    weeks,
    sprints: buildFixedSprints(weeks, document.plan.sprintStartNumber, document.plan.sprintStartOrder),
  };
}
