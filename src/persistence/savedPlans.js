import { compactPlanDocument, expandCompactPlanDocument } from './shareUrl.js';

// App-specific and versioned: GitHub Pages serves every project under a given account
// from the same <user>.github.io origin, so a generic key like the previous
// 'timeline.savedPlans' could be read, overwritten, or cleared by an unrelated project
// on that same origin. The migration below moves any snapshots already saved under the
// old key exactly once, so existing users do not lose their local snapshots.
const STORAGE_KEY = 'local-sprint-plan.savedPlans.v1';
const LEGACY_STORAGE_KEY = 'timeline.savedPlans';
const BACKUP_VERSION = 1;
let hasMigratedLegacyStorageKey = false;

export function listSavedPlans() {
  return readSavedPlans().sort((a, b) => b.savedAt.localeCompare(a.savedAt));
}

export function savePlanSnapshot(name, document, existingId = null) {
  const normalizedName = name.trim();
  if (!normalizedName) {
    throw new Error('Plan name is required.');
  }

  const savedPlans = readSavedPlans();
  const existing =
    savedPlans.find((plan) => plan.id === existingId) ??
    savedPlans.find((plan) => plan.name.toLocaleLowerCase() === normalizedName.toLocaleLowerCase());
  const nextPlan = {
    id: existing?.id ?? createSavedPlanId(savedPlans),
    name: normalizedName,
    savedAt: new Date().toISOString(),
    document: compactPlanDocument(document),
  };
  const nextPlans = existing
    ? savedPlans.map((plan) => (plan.id === existing.id ? nextPlan : plan))
    : [...savedPlans, nextPlan];

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPlans));
  return nextPlan;
}

export function getSavedPlan(savedPlanId) {
  return readSavedPlans().find((plan) => plan.id === savedPlanId) ?? null;
}

export function loadSavedPlan(savedPlanId) {
  const savedPlan = getSavedPlan(savedPlanId);
  if (!savedPlan) {
    throw new Error('Saved plan was not found.');
  }

  return {
    savedPlan,
    document: expandCompactPlanDocument(savedPlan.document),
  };
}

export function deleteSavedPlan(savedPlanId) {
  const savedPlans = readSavedPlans();
  const nextPlans = savedPlans.filter((plan) => plan.id !== savedPlanId);

  if (nextPlans.length === savedPlans.length) {
    throw new Error('Saved plan was not found.');
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(nextPlans));
}

export function createSavedPlansBackup() {
  return {
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    savedPlans: listSavedPlans(),
  };
}

export function restoreSavedPlansBackup(backup) {
  if (!backup || typeof backup !== 'object' || backup.version !== BACKUP_VERSION) {
    throw new Error('Backup format is not supported.');
  }

  if (!Array.isArray(backup.savedPlans) || !backup.savedPlans.every(isSavedPlan)) {
    throw new Error('Backup does not contain valid saved plans.');
  }

  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(backup.savedPlans));
}

function readSavedPlans() {
  migrateLegacyStorageKeyOnce();

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isSavedPlan) : [];
  } catch {
    return [];
  }
}

// One-time move of snapshots saved under the old, un-namespaced key to the new
// app-specific one (see the comment on STORAGE_KEY above). The old key is left in
// place rather than deleted - it is simply never read again - so this cannot lose data
// even if something about the migration itself goes wrong.
function migrateLegacyStorageKeyOnce() {
  if (hasMigratedLegacyStorageKey) {
    return;
  }

  hasMigratedLegacyStorageKey = true;

  try {
    if (window.localStorage.getItem(STORAGE_KEY) !== null) {
      return;
    }

    const legacyRaw = window.localStorage.getItem(LEGACY_STORAGE_KEY);
    if (!legacyRaw) {
      return;
    }

    const parsed = JSON.parse(legacyRaw);
    if (Array.isArray(parsed) && parsed.every(isSavedPlan)) {
      window.localStorage.setItem(STORAGE_KEY, legacyRaw);
    }
  } catch {
    // Nothing to migrate, or the legacy entry was not valid JSON - leave it alone.
  }
}

function createSavedPlanId(savedPlans) {
  const maxId = savedPlans.reduce((max, plan) => {
    const match = /^sp(\d+)$/.exec(plan.id);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);

  return `sp${maxId + 1}`;
}

function isSavedPlan(plan) {
  return Boolean(
    plan &&
      typeof plan.id === 'string' &&
      typeof plan.name === 'string' &&
      typeof plan.savedAt === 'string' &&
      Array.isArray(plan.document),
  );
}
