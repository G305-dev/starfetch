import { maskEmail, normalizeEmail } from './email-mask';

describe('email helpers', () => {
  it('normalizes with trim + lowercase for comparison', () => {
    expect(normalizeEmail('  User@Example.COM  ')).toBe('user@example.com');
    expect(normalizeEmail('A@B.CD')).toBe('a@b.cd');
  });

  it('masks as "u***@domain" for safe display/logs', () => {
    expect(maskEmail('user@example.com')).toBe('u***@example.com');
    expect(maskEmail('david.okafor@starfetch.ng')).toBe('d***@starfetch.ng');
  });

  it('degenerates safely on malformed input', () => {
    expect(maskEmail('@example.com')).toBe('***');
    expect(maskEmail('not-an-email')).toBe('***');
    expect(maskEmail('a@')).toBe('***');
  });
});
