/**
 * Calendar date (YYYY-MM-DD) in the configured casino timezone.
 * Session history is bucketed by this value captured when the player sits (stored on the seat);
 * this helper is also used for "today" and for legacy seats without a stored day (cash-out time).
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
