export function migrateV1ToV2(document) {
  // No structural change exists yet between v1 and v2 - but a migration step must
  // always advance the version marker (see the guard in migrations/index.js), so this
  // still stamps the target version even though the shape is otherwise unchanged.
  return { ...document, version: '2.0' };
}
