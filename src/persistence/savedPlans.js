import { compactPlanDocument, expandCompactPlanDocument } from './shareUrl.js';

const STORAGE_KEY = 'timeline.savedPlans';

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

export function loadSavedPlan(savedPlanId) {
  const savedPlan = readSavedPlans().find((plan) => plan.id === savedPlanId);
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

function readSavedPlans() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter(isSavedPlan) : [];
  } catch {
    return [];
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
