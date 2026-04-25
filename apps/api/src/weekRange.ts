/** Start of the current week (Monday 00:00:00, local) as a date-only value for standup keys. */
export function getWeekStartDate(now = new Date()): Date {
  const d = new Date(now);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);
  return start;
}

/** Monday 00:00:00 to next Monday 00:00:00 in local server timezone. */
export function getCurrentWeekRange(now = new Date()) {
  const d = new Date(now);
  const day = d.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(d);
  start.setDate(d.getDate() + mondayOffset);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}
