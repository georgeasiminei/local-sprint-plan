import { describe, expect, it } from 'vitest';
import { formatWeekTooltip } from './weekTooltip.js';

describe('formatWeekTooltip', () => {
  it('formats same-month workweek dates with the quarter', () => {
    expect(
      formatWeekTooltip({
        label: '26.25',
        startDate: '2026-06-15',
      }),
    ).toBe('Jun 15 - 19 · Q2');
  });

  it('formats cross-month workweek dates with both quarters when needed', () => {
    expect(
      formatWeekTooltip({
        label: '26.27',
        startDate: '2026-06-29',
      }),
    ).toBe('Jun 29 - Jul 3 · Q2/Q3');
  });

  it('returns no tooltip when dates are missing', () => {
    expect(formatWeekTooltip({ label: '26.25' })).toBe('');
  });
});
