import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, randomBytes } from 'crypto';
import { secureCompare } from '../../../common/utils/secure-compare';

/**
 * Signed double-submit CSRF scheme for cookie-authenticated state-changing
 * requests.
 *
 * Cookie value format:  "<sessionId>.<token>.<hmac>"
 *   token — 256-bit random, base64url
 *   hmac  — HMAC-SHA-256(CSRF_HMAC_SECRET, "<sessionId>.<token>")
 *
 * The browser returns the readable cookie value verbatim in the
 * `X-CSRF-Token` header. Validation requires: header == cookie (timing-safe),
 * embedded sessionId == the currently authenticated session, and a valid HMAC.
 * A fresh token is issued on every refresh rotation.
 */
@Injectable()
export class CsrfService {
  constructor(private readonly config: ConfigService) {}

  private get secret(): string {
    return this.config.getOrThrow<string>('auth.csrfHmacSecret');
  }

  issue(sessionId: string): string {
    const token = randomBytes(32).toString('base64url');
    return `${sessionId}.${token}.${this.sign(sessionId, token)}`;
  }

  verify(expectedSessionId: string, cookieValue?: string, headerValue?: string): boolean {
    if (!cookieValue || !headerValue) return false;
    if (!secureCompare(cookieValue, headerValue)) return false;

    const parts = cookieValue.split('.');
    if (parts.length !== 3) return false;
    const [sessionId, token, hmac] = parts;

    if (!secureCompare(sessionId, expectedSessionId)) return false;
    return secureCompare(hmac, this.sign(sessionId, token));
  }

  private sign(sessionId: string, token: string): string {
    return createHmac('sha256', this.secret).update(`${sessionId}.${token}`).digest('hex');
  }
}
