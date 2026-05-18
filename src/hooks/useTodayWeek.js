export function useTodayWeek(weeks = []) {
  const today = new Date();
  return weeks.findIndex((week) => {
    if (!week.startDate) {
      return false;
    }

    const start = new Date(week.startDate);
    const end = week.endDate ? new Date(`${week.endDate}T23:59:59`) : new Date(start);
    if (!week.endDate) {
      end.setDate(start.getDate() + 6);
      end.setHours(23, 59, 59, 999);
    }

    return today >= start && today <= end;
  });
}
