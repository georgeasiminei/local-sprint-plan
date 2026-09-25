import { describe, expect, it } from 'vitest';
import { exportScheduleCsv } from './exportPlan.js';

function buildDocument(overrides = {}) {
  return {
    tasks: [{ id: 'task-1', name: 'Task A', priority: 1, categoryId: 'category-1' }],
    categories: [{ id: 'category-1', name: 'Delivery' }],
    weeks: [{ weekIndex: 12, label: '26.12' }],
    schedule: [{ taskId: 'task-1', weekIndex: 12, allocatedUnits: 3, isManual: false }],
    ...overrides,
  };
}

describe('exportScheduleCsv', () => {
  it('exports the planning-week label instead of the raw internal week index', () => {
    const csv = exportScheduleCsv(buildDocument());
    const rows = csv.split('\n');

    expect(rows[0]).toBe('Task,Category,Priority,Week,Allocation,Manual');
    expect(rows[1]).toBe('Task A,Delivery,1,26.12,3,no');
  });

  it('falls back to the raw week index when no matching week exists', () => {
    const csv = exportScheduleCsv(buildDocument({ weeks: [] }));
    const rows = csv.split('\n');

    expect(rows[1]).toBe('Task A,Delivery,1,12,3,no');
  });

  it('quotes fields containing commas, quotes, or newlines per RFC 4180', () => {
    const csv = exportScheduleCsv(
      buildDocument({
        tasks: [{ id: 'task-1', name: 'Say "hi", please', priority: 1, categoryId: null }],
      }),
    );
    const rows = csv.split('\n');

    expect(rows[1]).toBe('"Say ""hi"", please",,1,26.12,3,no');
  });

  it('neutralises a leading formula character to prevent CSV formula injection', () => {
    const csv = exportScheduleCsv(
      buildDocument({
        tasks: [{ id: 'task-1', name: '=HYPERLINK("https://evil.example/")', priority: 1, categoryId: null }],
      }),
    );
    const rows = csv.split('\n');

    expect(rows[1]).toBe('"\'=HYPERLINK(""https://evil.example/"")",,1,26.12,3,no');
  });

  it('marks manual allocations', () => {
    const csv = exportScheduleCsv(
      buildDocument({
        schedule: [{ taskId: 'task-1', weekIndex: 12, allocatedUnits: 2, isManual: true }],
      }),
    );
    const rows = csv.split('\n');

    expect(rows[1]).toBe('Task A,Delivery,1,26.12,2,yes');
  });
});
