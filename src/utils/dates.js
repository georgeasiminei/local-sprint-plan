const DAY_MS = 24 * 60 * 60 * 1000;

export function toDate(value) {
  return value instanceof Date ? value : new Date(value);
}

export function startOfWeek(date) {
  const value = toDate(date);
  const day = value.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  const result = new Date(value);
  result.setHours(0, 0, 0, 0);
  result.setDate(value.getDate() + diff);
  return result;
}

export function addWeeks(date, weeks) {
  const result = new Date(toDate(date));
  result.setDate(result.getDate() + weeks * 7);
  return result;
}

export function getWeekRange(startDate, weekIndex) {
  const start = addWeeks(startOfWeek(startDate), weekIndex);
  const end = addWeeks(start, 1);
  end.setDate(end.getDate() - 1);
  return { start, end };
}

export function countWeekdays(startDate, endDate) {
  let count = 0;
  const cursor = new Date(toDate(startDate));
  const end = toDate(endDate);

  while (cursor <= end) {
    const day = cursor.getDay();
    if (day !== 0 && day !== 6) {
      count += 1;
    }
    cursor.setTime(cursor.getTime() + DAY_MS);
  }

  return count;
}
