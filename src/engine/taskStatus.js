export const TASK_STATUS_NONE = 'none';
export const TASK_STATUS_GREEN = 'green';
export const TASK_STATUS_AMBER = 'amber';
export const TASK_STATUS_RED = 'red';
export const TASK_STATUS_COMPLETED = 'completed';

export const TASK_HEALTH_STATUSES = [TASK_STATUS_GREEN, TASK_STATUS_AMBER, TASK_STATUS_RED];
export const TASK_STATUS_VALUES = [
  TASK_STATUS_NONE,
  ...TASK_HEALTH_STATUSES,
  TASK_STATUS_COMPLETED,
];

export const TASK_STATUS_COLORS = {
  [TASK_STATUS_GREEN]: '#86efac',
  [TASK_STATUS_AMBER]: '#facc15',
  [TASK_STATUS_RED]: '#f87171',
  [TASK_STATUS_COMPLETED]: '#86efac',
};

export function normalizeTaskStatus(value) {
  return TASK_STATUS_VALUES.includes(value) ? value : TASK_STATUS_NONE;
}

export function normalizeTaskHealthStatus(value) {
  return TASK_HEALTH_STATUSES.includes(value) ? value : undefined;
}

export function getTaskStatusValue(task) {
  if (task?.completed) {
    return TASK_STATUS_COMPLETED;
  }

  return normalizeTaskStatus(task?.status);
}
