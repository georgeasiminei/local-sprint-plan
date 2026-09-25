import { beforeEach, describe, expect, it, vi } from 'vitest';
import { migratePlanDocument } from './index.js';
import { migrateV1ToV2 } from './v1_to_v2.js';
import { PLAN_SCHEMA_VERSION } from '../schema.js';

describe('migrateV1ToV2', () => {
  it('advances the version marker even though the document shape is otherwise unchanged', () => {
    const document = { version: '1.0', plan: { id: 'p1' } };

    expect(migrateV1ToV2(document)).toEqual({ version: '2.0', plan: { id: 'p1' } });
  });
});

describe('migratePlanDocument', () => {
  it('returns the document unchanged when it is already at the current schema version', () => {
    const document = { version: PLAN_SCHEMA_VERSION, plan: { id: 'p1' } };

    expect(migratePlanDocument(document)).toBe(document);
  });

  it('returns the document unchanged when it has no version at all', () => {
    const document = { plan: { id: 'p1' } };

    expect(migratePlanDocument(document)).toBe(document);
  });

  it('returns the document unchanged when its version has no registered migration', () => {
    const document = { version: '0.9', plan: { id: 'p1' } };

    expect(migratePlanDocument(document)).toBe(document);
  });
});

describe('migratePlanDocument (with a newer schema version registered)', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('runs the registered chain through to the current version without looping forever', async () => {
    // Simulate a future state where PLAN_SCHEMA_VERSION has been bumped past '1.0',
    // which is exactly the situation the infinite-loop guard exists to protect against.
    vi.doMock('../schema.js', () => ({ PLAN_SCHEMA_VERSION: '2.0' }));
    const { migratePlanDocument: migrateWithNewerSchema } = await import('./index.js');

    const result = migrateWithNewerSchema({ version: '1.0', plan: { id: 'p1' } });

    expect(result).toEqual({ version: '2.0', plan: { id: 'p1' } });
  });

  it('throws instead of looping forever if a migration step does not advance the version', async () => {
    vi.doMock('../schema.js', () => ({ PLAN_SCHEMA_VERSION: '2.0' }));
    vi.doMock('./v1_to_v2.js', () => ({ migrateV1ToV2: (document) => document }));
    const { migratePlanDocument: migrateWithBrokenStep } = await import('./index.js');

    expect(() => migrateWithBrokenStep({ version: '1.0', plan: { id: 'p1' } })).toThrow(
      'Migration for schema version "1.0" did not advance the document version.',
    );
  });
});
