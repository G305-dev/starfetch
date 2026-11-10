import { corporateO2IdempotencyDigests, corporateO2PayloadDigests, CorporateO2HmacKeyring } from './corporate-o2-hmac-keyring';

const payload = {
  institutionName: 'Synthetic Example Ltd',
  dateOfIncorporation: '2020-01-02',
  rcNumber: 'RC-SYNTHETIC-1',
  taxIdentificationNumber: 'SYNTHETIC-TIN-NOT-A-REAL-CUSTOMER',
  businessPhoneNumber: '+2348000000000',
  businessEmail: 'synthetic@example.invalid',
};
const v1 = Buffer.alloc(32, 0x11);
const v2 = Buffer.alloc(32, 0x22);

function ring(activeVersion: string, includePrior = true): CorporateO2HmacKeyring {
  return {
    activeVersion,
    keys: [
      ...(includePrior ? [{ version: 'hmac-v1', key: v1 }] : []),
      { version: 'hmac-v2', key: v2 },
    ],
  };
}

describe('Corporate O2 versioned HMAC key hierarchy', () => {
  it('HMACs all six canonical fields and supports prior key versions during rotation', () => {
    const old = corporateO2PayloadDigests(payload, ring('hmac-v1'));
    const rotated = corporateO2PayloadDigests(payload, ring('hmac-v2'));
    expect(old.find((x) => x.keyVersion === 'hmac-v1')?.digest).toMatch(/^[0-9a-f]{64}$/);
    expect(rotated).toEqual(old);
    expect(corporateO2PayloadDigests({ ...payload, taxIdentificationNumber: 'OTHER-SYNTHETIC-TIN' }, ring('hmac-v1')))
      .not.toEqual(old);
  });

  it('domain-separates idempotency keys from payload fingerprints and scopes keys to user/operation', () => {
    const fingerprint = corporateO2PayloadDigests(payload, ring('hmac-v1'))[0].digest;
    const idempotency = corporateO2IdempotencyDigests(
      '11111111-1111-4111-8111-111111111111', 'CORPORATE_DRAFT_BOOTSTRAP_O2_V1', 'client-key-123', ring('hmac-v1'),
    )[0].digest;
    expect(idempotency).not.toBe(fingerprint);
    expect(idempotency).not.toContain('client-key-123');
    expect(corporateO2IdempotencyDigests(
      '22222222-2222-4222-8222-222222222222', 'CORPORATE_DRAFT_BOOTSTRAP_O2_V1', 'client-key-123', ring('hmac-v1'),
    )[0].digest).not.toBe(idempotency);
  });
});
