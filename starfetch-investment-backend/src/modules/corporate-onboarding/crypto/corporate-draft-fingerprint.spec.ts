import {
  CorporateDraftBootstrapPayload,
  CorporateDraftFingerprintKeyProvider,
  CorporateDraftPayloadFingerprinter,
  digestCorporateDraftIdempotencyKey,
} from './corporate-draft-fingerprint';

const KEY = 'test-only-non-tin-bootstrap-hmac-key-0123456789abcdef';
const payload: CorporateDraftBootstrapPayload = {
  institutionName: 'Example Holdings Ltd',
  dateOfIncorporation: '2020-01-02',
  rcNumber: 'RC-123',
  businessPhoneNumber: '+2348000000000',
  businessEmail: 'accounts@example.com',
};

describe('CorporateDraftPayloadFingerprinter', () => {
  const provider: CorporateDraftFingerprintKeyProvider = {
    getNonTinBootstrapKey: () => KEY,
  };

  it('creates a stable, domain-separated HMAC for the non-TIN bootstrap payload', () => {
    const fingerprinter = new CorporateDraftPayloadFingerprinter(provider);
    const first = fingerprinter.fingerprint(payload);
    expect(first).toMatch(/^[0-9a-f]{64}$/);
    expect(fingerprinter.fingerprint({ ...payload })).toBe(first);
    expect(fingerprinter.fingerprint({ ...payload, businessEmail: 'other@example.com' })).not.toBe(first);
  });

  it('fails closed when the purpose-specific key is unavailable or weak', () => {
    expect(() => new CorporateDraftPayloadFingerprinter({ getNonTinBootstrapKey: () => undefined }).fingerprint(payload)).toThrow();
    expect(() => new CorporateDraftPayloadFingerprinter({ getNonTinBootstrapKey: () => 'short' }).fingerprint(payload)).toThrow();
  });

  it('rejects unexpected runtime properties (including any TIN field)', () => {
    expect(() =>
      new CorporateDraftPayloadFingerprinter(provider).fingerprint({
        ...payload,
        taxIdentificationNumber: 'SYNTHETIC-NOT-A-REAL-TIN',
      } as never),
    ).toThrow();
  });
});

describe('digestCorporateDraftIdempotencyKey', () => {
  const userA = '33333333-3333-4333-8333-333333333333';
  const userB = '44444444-4444-4444-8444-444444444444';
  it('does not store the raw key and separates user/operation scopes', () => {
    const digest = digestCorporateDraftIdempotencyKey(userA, 'CORPORATE_DRAFT_BOOTSTRAP_NON_TIN_V1', 'client-key-123');
    expect(digest).toMatch(/^[0-9a-f]{64}$/);
    expect(digest).not.toContain('client-key-123');
    expect(digestCorporateDraftIdempotencyKey(userA, 'other-operation', 'client-key-123')).not.toBe(digest);
    expect(digestCorporateDraftIdempotencyKey(userB, 'CORPORATE_DRAFT_BOOTSTRAP_NON_TIN_V1', 'client-key-123')).not.toBe(digest);
  });
});
