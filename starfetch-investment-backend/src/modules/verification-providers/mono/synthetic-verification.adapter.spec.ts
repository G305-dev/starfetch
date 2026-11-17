import { ConfigService } from '@nestjs/config';
import { SyntheticVerificationAdapter } from './synthetic-verification.adapter';

describe('SyntheticVerificationAdapter', () => {
  it('generates deterministic synthetic-only evidence metadata in test mode', () => {
    const config = { get: () => 'test' } as unknown as ConfigService;
    const adapter = new SyntheticVerificationAdapter(config);
    const first = adapter.result('PENDING', 'SYNTHETIC_CASE_01');
    const replay = adapter.result('PENDING', 'SYNTHETIC_CASE_01');
    expect(first).toEqual(replay);
    expect(first.status).toBe('PENDING');
    expect(first.reference).toMatch(/^synthetic-[a-f0-9]{20}$/);
    expect(first.detailMasked).toEqual({ source: 'SYNTHETIC_TEST_ADAPTER', caseKey: 'SYNTHETIC_CASE_01' });
  });

  it('refuses to run outside NODE_ENV=test', () => {
    const config = { get: () => 'production' } as unknown as ConfigService;
    const adapter = new SyntheticVerificationAdapter(config);
    expect(() => adapter.result('PROVIDER_VERIFIED', 'SYNTHETIC_CASE_01')).toThrow(/automated tests/);
  });
});
