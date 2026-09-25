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
  const weekByIndex = new Map((document.weeks ?? []).map((week) => [week.weekIndex, week]));
  const rows = [['Task', 'Category', 'Priority', 'Week', 'Allocation', 'Manual']];

  for (const item of schedule) {
    const task = taskById.get(item.taskId);
    const category = task?.categoryId ? categoryById.get(task.categoryId) : null;
    // The planning-week label (e.g. "26.12") is what the grid shows; the raw internal
    // weekIndex has no year and does not match it, so fall back to it only when the
    // week isn't in range (a manual entry or completed interval beyond what was
    // regenerated) rather than exporting a number nobody can map back to a calendar week.
    const week = weekByIndex.get(item.weekIndex);
    rows.push([
      task?.name ?? item.taskId,
      category?.name ?? '',
      task?.priority ?? '',
      week?.label ?? item.weekIndex,
      item.allocatedUnits ?? 0,
      item.isManual ? 'yes' : 'no',
    ]);
  }

  return rows.map((row) => row.map(escapeCsv).join(',')).join('\n');
}

// A value is exported to a file the user (or whoever they share it with) opens in
// Excel/Sheets/a CSV parser, so this must be a real RFC 4180 escaper, not just
// "quote when there's a comma": a bare quote, CR, or LF in a name would otherwise
// corrupt the row structure. A leading =, +, -, @, tab, or CR is also neutralised with
// a leading apostrophe so a task/category name from a shared link cannot execute as a
// formula when the file is opened (CSV formula injection).
function escapeCsv(value) {
  let text = String(value ?? '');

  if (/^[=+\-@\t\r]/.test(text)) {
    text = `'${text}`;
  }

  return /[",\r\n]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}
