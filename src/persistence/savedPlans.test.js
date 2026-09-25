import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createPlanFixture } from '../test/fixtures/planDocument.js';
import { compactPlanDocument } from './shareUrl.js';
import {
  createSavedPlansBackup,
  listSavedPlans,
  loadSavedPlan,
  restoreSavedPlansBackup,
  savePlanSnapshot,
} from './savedPlans.js';

describe('saved plan backups', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('backs up and restores the full saved-plan library', () => {
    savePlanSnapshot('Plan A', createPlanFixture({ plan: { name: 'Plan A' } }));
    savePlanSnapshot('Plan B', createPlanFixture({ plan: { name: 'Plan B' } }));

    const backup = createSavedPlansBackup();
    window.localStorage.clear();
    restoreSavedPlansBackup(backup);

    expect(listSavedPlans().map((plan) => plan.name).sort()).toEqual(['Plan A', 'Plan B']);
  });

  it('persists the plan name inside the saved compact document', () => {
    const savedPlan = savePlanSnapshot('Named snapshot', createPlanFixture({ plan: { name: 'Named snapshot' } }));

    const loaded = loadSavedPlan(savedPlan.id);

    expect(loaded.document.plan.name).toBe('Named snapshot');
  });

  it('rejects unsupported backup shapes', () => {
    expect(() => restoreSavedPlansBackup({ version: 2, savedPlans: [] })).toThrow('Backup format is not supported.');
    expect(() => restoreSavedPlansBackup({ version: 1, savedPlans: [{ name: 'Missing fields' }] })).toThrow(
      'Backup does not contain valid saved plans.',
    );
  });

  it('migrates snapshots from the legacy un-namespaced storage key without deleting it', async () => {
    const legacyPlans = [
      {
        id: 'sp1',
        name: 'Legacy plan',
        savedAt: '2026-01-01T00:00:00.000Z',
        document: compactPlanDocument(createPlanFixture({ plan: { name: 'Legacy plan' } })),
      },
    ];
    window.localStorage.setItem('timeline.savedPlans', JSON.stringify(legacyPlans));

    // The migration runs once per module lifetime; reset modules to get a fresh copy
    // that has not already migrated in an earlier test in this file.
    vi.resetModules();
    const freshModule = await import('./savedPlans.js');

    expect(freshModule.listSavedPlans().map((plan) => plan.name)).toEqual(['Legacy plan']);
    expect(window.localStorage.getItem('timeline.savedPlans')).not.toBeNull();
    expect(window.localStorage.getItem('local-sprint-plan.savedPlans.v1')).not.toBeNull();
  });
});
