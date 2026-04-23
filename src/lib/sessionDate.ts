/**
 * Calendar date (YYYY-MM-DD) for bucketing cash-game sessions.
 * Uses a fixed IANA timezone so "tonight" matches what hosts expect (not UTC server midnight).
 * Override with `SESSIONS_TIMEZONE` (e.g. `America/Los_Angeles`).
 */
export function sessionCalendarDateISO(when: Date = new Date()): string {
  const tz =
    (typeof process !== "undefined" &&
      process.env &&
      (process.env.SESSIONS_TIMEZONE?.trim() || process.env.CASINO_TIMEZONE?.trim())) ||
    "America/New_York";
  return when.toLocaleString("sv-SE", { timeZone: tz }).slice(0, 10);
}
