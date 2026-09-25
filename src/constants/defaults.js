export const DEFAULT_SPRINT_LENGTH_WEEKS = 2;
export const DEFAULT_RESOURCE_COUNT = 5;
// Used only to prefill the "Start year" field on a brand new, not-yet-persisted plan.
// Intentionally wall-clock based for UX; never use this for encode/decode defaults below.
export const DEFAULT_START_YEAR = new Date().getFullYear();
export const DEFAULT_START_WEEK = 1;
export const MIN_VISIBLE_WEEKS = 4;
export const MAX_CALCULATED_WEEKS = 260;
export const DEFAULT_WEEK_LABEL_FORMAT = 'short';
export const DEFAULT_ROW_HEIGHT = 19;
export const DEFAULT_WEEK_COLUMN_WIDTH = 48;
export const MIN_VALID_START_YEAR = 2000;
export const MAX_VALID_START_YEAR = 2999;

// Fixed reference year for the compact URL/localStorage document format. A plan's
// startYear is omitted from the encoded payload only when it equals this constant,
// and a payload with no startYear falls back to it on decode. This MUST stay a fixed
// value (never new Date().getFullYear()) - the compact format is a persistence surface
// for already-shared links and saved snapshots, and re-dating them at every calendar
// year boundary was a real, shipped bug. Changing this constant would silently re-date
// every existing link/snapshot that currently omits startYear; do not change it without
// a documented migration.
export const COMPACT_URL_EPOCH_YEAR = 2026;

// Persisted compatibility surface: encoded as a bare array index in shareUrl.js.
// Append new colors only; never reorder, remove, or insert - doing so silently
// recolors every existing shared URL and saved snapshot that references an index.
export const DEFAULT_CATEGORY_COLORS = [
  '#e0f2fe',
  '#dcfce7',
  '#fef3c7',
  '#fce7f3',
  '#ede9fe',
  '#fee2e2',
];

export const DEFAULT_PLAN_NAME = 'New project plan';
