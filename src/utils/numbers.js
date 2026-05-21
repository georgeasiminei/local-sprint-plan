export function roundToTenths(value) {
  return Math.round(value * 10) / 10;
}

export function parseNonNegativeTenths(value, fallback = 0) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return roundToTenths(Math.max(0, parsed));
}
