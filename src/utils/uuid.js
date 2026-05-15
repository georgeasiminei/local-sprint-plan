const counters = new Map();

export function createId(prefix = 'id', existingIds = []) {
  const normalizedPrefix = normalizePrefix(prefix);
  const maxExisting = existingIds.reduce((max, id) => {
    const match = typeof id === 'string' ? id.match(new RegExp(`^${normalizedPrefix}(\\d+)$`)) : null;
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0);
  const next = Math.max(counters.get(normalizedPrefix) ?? 0, maxExisting) + 1;
  counters.set(normalizedPrefix, next);
  return `${normalizedPrefix}${next}`;
}

function normalizePrefix(prefix) {
  const aliases = {
    category: 'c',
    task: 't',
    dependency: 'd',
    'external-dependency': 'x',
    plan: 'p',
    sprint: 's',
    week: 'w',
    'week-resource': 'wr',
    freeday: 'f',
    import: 'i',
  };

  return aliases[prefix] ?? prefix;
}
