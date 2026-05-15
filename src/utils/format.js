export function formatNumber(value, decimals = 1) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  return Number(value).toFixed(decimals);
}

export function formatPercent(value) {
  if (value === null || value === undefined) {
    return '-';
  }

  return `${Math.round(value * 100)}%`;
}
