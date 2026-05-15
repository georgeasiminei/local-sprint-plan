import { DEFAULT_CATEGORY_COLORS } from '../constants/defaults.js';

export function getCategoryColor(index = 0) {
  return DEFAULT_CATEGORY_COLORS[index % DEFAULT_CATEGORY_COLORS.length];
}

export function withAlpha(hex, alpha = 0.16) {
  const normalized = hex.replace('#', '');
  const value = Number.parseInt(normalized, 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return `rgb(${r} ${g} ${b} / ${alpha})`;
}
