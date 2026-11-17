/**
 * Time-of-day greeting helpers (frontend only).
 *
 * Uses the visitor's local browser time (e.g. Africa/Lagos for a Lagos
 * visitor) so the dashboard placard always matches the time of day the
 * user is actually experiencing.
 *
 * - 00:00-11:59 -> "Good morning"
 * - 12:00-16:59 -> "Good afternoon"
 * - 17:00-23:59 -> "Good evening"
 */

export type TimeGreeting = "Good morning" | "Good afternoon" | "Good evening";

/** Maps a 0-23 local hour to a greeting. Invalid hours fall back to morning. */
export function getGreetingForHour(hour: number): TimeGreeting {
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return "Good morning";
  if (hour < 12) return "Good morning";
  if (hour < 17) return "Good afternoon";
  return "Good evening";
}

/** Returns the greeting for a date's local hour (defaults to now). */
export function getTimeGreeting(now: Date = new Date()): TimeGreeting {
  return getGreetingForHour(now.getHours());
}

/** Returns the decorative emoji paired with each greeting. */
export function getGreetingEmoji(greeting: TimeGreeting): string {
  switch (greeting) {
    case "Good afternoon":
      return "☀️";
    case "Good evening":
      return "🌙";
    case "Good morning":
    default:
      return "👋";
  }
}
