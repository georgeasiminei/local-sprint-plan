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
    const previousVersion = current.version;
    current = migrations[current.version](current);

    // A migration step that does not advance the version would otherwise spin this
    // loop forever the moment PLAN_SCHEMA_VERSION is bumped past its own target - fail
    // loudly instead of hanging the tab on load.
    if (current.version === previousVersion) {
      throw new Error(`Migration for schema version "${previousVersion}" did not advance the document version.`);
    }
  }

  return current;
}
