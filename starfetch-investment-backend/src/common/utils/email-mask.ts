/**
 * Email helpers shared by auth flows.
 */

/** trim + lowercase — the canonical comparison/storage form (normalizedEmail). */
export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

/** "user@example.com" → "u***@example.com" — safe for responses and logs. */
export function maskEmail(email: string): string {
  const trimmed = email.trim();
  const at = trimmed.lastIndexOf('@');
  if (at <= 0) return '***';
  const local = trimmed.slice(0, at);
  const domain = trimmed.slice(at + 1);
  if (domain.length === 0) return '***';
  return `${local[0]}***@${domain}`;
}
