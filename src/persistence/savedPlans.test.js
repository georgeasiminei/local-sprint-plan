import { beforeEach, describe, expect, it } from 'vitest';
import { createPlanFixture } from '../test/fixtures/planDocument.js';
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
});
