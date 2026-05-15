import { describe, expect, it } from 'vitest';
import { buildCalculatedWeeks, buildFixedSprints, getCurrentIsoWeekInfo } from './timeline.js';

describe('timeline generation', () => {
  it('generates ISO week-year labels and dates', () => {
    const weeks = buildCalculatedWeeks(12, 4, 2026);

    expect(weeks[0]).toMatchObject({
      weekIndex: 12,
      weekYear: 2026,
      weekNumber: 12,
      label: '26.12',
      startDate: '2026-03-16',
      endDate: '2026-03-22',
    });
  });

  it('rolls ISO weeks into the next year', () => {
    const weeks = buildCalculatedWeeks(52, 4, 2026);

    expect(weeks.map((week) => week.label)).toEqual(['26.52', '26.53', '27.01', '27.02']);
  });

  it('builds merged two-week sprints and renumbers from the edited sprint onward', () => {
    const weeks = buildCalculatedWeeks(1, 6, 2026);
    const sprints = buildFixedSprints(weeks, 10, 2);

    expect(sprints).toEqual([
      expect.objectContaining({ name: 'Sprint 1', columnStart: 1, columnSpan: 2, number: 1 }),
      expect.objectContaining({ name: 'Sprint 10', columnStart: 3, columnSpan: 2, number: 10 }),
      expect.objectContaining({ name: 'Sprint 11', columnStart: 5, columnSpan: 2, number: 11 }),
    ]);
  });

  it('finds the current ISO week', () => {
    expect(getCurrentIsoWeekInfo(new Date('2026-03-18T12:00:00'))).toEqual({
      weekYear: 2026,
      weekNumber: 12,
    });
  });
});
