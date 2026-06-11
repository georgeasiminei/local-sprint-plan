const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function formatWeekTooltip(week) {
  if (!week?.startDate) {
    return week?.label ?? '';
  }

  const start = parseLocalDate(week.startDate);
  const end = addDays(start, 4);
  const dateRange = formatDateRange(start, end);
  const quarterRange = formatQuarterRange(start, end);

  return [week.label, dateRange, quarterRange].filter(Boolean).join(' · ');
}

function parseLocalDate(value) {
  const [year, month, day] = String(value).split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateRange(start, end) {
  const startMonth = MONTH_LABELS[start.getMonth()];
  const endMonth = MONTH_LABELS[end.getMonth()];
  const startDay = start.getDate();
  const endDay = end.getDate();

  if (startMonth === endMonth) {
    return `${startMonth} ${startDay} - ${endDay}`;
  }

  return `${startMonth} ${startDay} - ${endMonth} ${endDay}`;
}

function formatQuarterRange(start, end) {
  const startQuarter = getQuarter(start);
  const endQuarter = getQuarter(end);

  return startQuarter === endQuarter ? `Q${startQuarter}` : `Q${startQuarter}/Q${endQuarter}`;
}

function getQuarter(date) {
  return Math.floor(date.getMonth() / 3) + 1;
}
