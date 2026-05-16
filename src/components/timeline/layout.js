export const CATEGORY_COLUMN_WIDTH = 104;
export const TASK_COLUMN_WIDTH = 196;
export const LEFT_COLUMN_WIDTH = CATEGORY_COLUMN_WIDTH + TASK_COLUMN_WIDTH;
export { DEFAULT_ROW_HEIGHT as DEFAULT_TIMELINE_ROW_HEIGHT, DEFAULT_WEEK_COLUMN_WIDTH } from '../../constants/defaults.js';

export function weekGridColumns(weekCount, weekColumnWidth) {
  return `repeat(${Math.max(weekCount, 1)}, ${weekColumnWidth}px)`;
}
