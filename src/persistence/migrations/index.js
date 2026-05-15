import { PLAN_SCHEMA_VERSION } from '../schema.js';
import { migrateV1ToV2 } from './v1_to_v2.js';

const migrations = {
  '1.0': migrateV1ToV2,
};

export function migratePlanDocument(document) {
  if (!document?.version || document.version === PLAN_SCHEMA_VERSION) {
    return document;
  }

  let current = document;
  while (current.version !== PLAN_SCHEMA_VERSION && migrations[current.version]) {
    current = migrations[current.version](current);
  }

  return current;
}
