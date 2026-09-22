export function sleeperCurrentWeek(week, seasonWeeks) {
  return Math.min(seasonWeeks, Math.max(1, Number(week) || 1));
}

// Tuesday is recap day: Sleeper has already advanced its official current-week ID, while the
// useful default view is still the week that just finished. Keep those two concepts separate so
// Week 3 remains marked "current" even though Tuesday opens Week 2.
export function defaultBrowseWeek(week, seasonWeeks, date = new Date()) {
  const currentWeek = sleeperCurrentWeek(week, seasonWeeks);
  return date.getDay() === 2 ? Math.max(1, currentWeek - 1) : currentWeek;
}
