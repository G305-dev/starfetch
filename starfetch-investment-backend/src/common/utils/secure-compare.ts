import { timingSafeEqual } from 'crypto';

/**
 * Timing-safe string equality for fixed-length verifiers (HMAC / SHA-256 hex).
 * Length inequality short-circuits — acceptable because all compared values
 * are fixed-length digests whose length is not secret.
 */
export function secureCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}
