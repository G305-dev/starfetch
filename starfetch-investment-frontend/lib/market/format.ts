/**
 * Display formatting for market timestamps.
 *
 * Kept in its own module because both the NGX and commodity adapters format
 * provider timestamps, and duplicating the Intl options is how the two labels
 * would eventually drift apart.
 */

/**
 * Formats an ISO instant for display. Fixed locale and timezone so the server
 * and the browser render identical text (no hydration mismatch between the
 * server-rendered HTML and the client).
 */
export function formatAsOf(iso: string | null): string {
  if (!iso) return "";
  return `${new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Africa/Lagos",
    hour12: false,
  }).format(new Date(iso))} WAT`;
}
