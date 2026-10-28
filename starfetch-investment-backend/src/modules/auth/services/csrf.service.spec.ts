import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'crypto';
import { CsrfService } from './csrf.service';

const SECRET = 'unit-test-csrf-hmac-secret-0123456789abcdef0123456789';

describe('CsrfService (signed double-submit, session-bound)', () => {
  const service = new CsrfService(new ConfigService({ 'auth.csrfHmacSecret': SECRET }));

  it('issues a "<sessionId>.<token>.<hmac>" value', () => {
    const sid = randomUUID();
    const value = service.issue(sid);
    const parts = value.split('.');
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe(sid);
    expect(parts[2]).toMatch(/^[0-9a-f]{64}$/);
  });

  it('accepts a matching cookie/header pair bound to the session', () => {
    const sid = randomUUID();
    const value = service.issue(sid);
    expect(service.verify(sid, value, value)).toBe(true);
  });

  it('rejects missing header or cookie', () => {
    const sid = randomUUID();
    const value = service.issue(sid);
    expect(service.verify(sid, value, undefined)).toBe(false);
    expect(service.verify(sid, undefined, value)).toBe(false);
  });

  it('rejects a mismatched header (double-submit mismatch)', () => {
    const sid = randomUUID();
    const value = service.issue(sid);
    const other = service.issue(sid);
    expect(service.verify(sid, value, other)).toBe(false);
  });

  it('rejects a token bound to a different session', () => {
    const sidA = randomUUID();
    const sidB = randomUUID();
    const value = service.issue(sidA);
    expect(service.verify(sidB, value, value)).toBe(false);
  });

  it('rejects a tampered HMAC', () => {
    const sid = randomUUID();
    const value = service.issue(sid);
    const tampered = value.slice(0, -2) + 'ff';
    expect(service.verify(sid, tampered, tampered)).toBe(false);
  });

  it('issues fresh randomness on every rotation', () => {
    const sid = randomUUID();
    expect(service.issue(sid)).not.toBe(service.issue(sid));
  });

  it('fails securely when the HMAC secret is missing', () => {
    const broken = new CsrfService(new ConfigService({}));
    expect(() => broken.issue(randomUUID())).toThrow();
  });
});
