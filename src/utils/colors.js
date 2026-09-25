import { DEFAULT_CATEGORY_COLORS } from '../constants/defaults.js';

export function getCategoryColor(index = 0) {
  return DEFAULT_CATEGORY_COLORS[index % DEFAULT_CATEGORY_COLORS.length];
}
