export function downloadCsv(filename, csv) {
  downloadText(filename, csv, 'text/csv;charset=utf-8');
}

export function downloadJson(filename, json) {
  downloadText(filename, json, 'application/json;charset=utf-8');
}

function downloadText(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function exportScheduleCsv(document) {
  const schedule = document.schedule ?? [];
  const taskById = new Map((document.tasks ?? []).map((task) => [task.id, task]));
  const categoryById = new Map((document.categories ?? []).map((category) => [category.id, category]));
  const rows = [['Task', 'Category', 'Priority', 'Week', 'Allocation', 'Manual']];

  for (const item of schedule) {
    const task = taskById.get(item.taskId);
    const category = task?.categoryId ? categoryById.get(task.categoryId) : null;
    rows.push([
      task?.name ?? item.taskId,
      category?.name ?? '',
      task?.priority ?? '',
      item.weekIndex,
      item.allocatedUnits ?? 0,
      item.isManual ? 'yes' : 'no',
    ]);
  }

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

function escapeCsv(value) {
  const text = String(value ?? '');
  return text.includes(',') ? `"${text.replaceAll('"', '""')}"` : text;
}
