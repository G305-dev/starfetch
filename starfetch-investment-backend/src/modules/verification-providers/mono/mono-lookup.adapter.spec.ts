import { ConfigService } from '@nestjs/config';
import { VerificationConsentService } from '../verification-consent.service';
import { MonoLookupAdapter, MonoLookupInput } from './mono-lookup.adapter';
import { MonoLookupEvidenceJournal, MonoLookupHttpResponse, MonoLookupHttpTransport } from './mono-lookup-ports';

const APP = '10000000-0000-4000-8000-000000000001';
const REQ = '20000000-0000-4000-8000-000000000002';
const SUBJECT = '30000000-0000-4000-8000-000000000003';
const ACTOR = '40000000-0000-4000-8000-000000000004';
const CONSENT = '50000000-0000-4000-8000-000000000005';
const SETTINGS = {
  enabled: true,
  environment: 'sandbox',
  secretKey: 'test_sk_synthetic_only',
  consentTextApproved: true,
  consentTextVersion: 'synthetic-consent-v1',
  consentTextSha256: 'a'.repeat(64),
  privacyNoticeVersion: 'synthetic-privacy-v1',
  lawfulBasisVersion: 'synthetic-basis-v1',
  lawfulBasisApproved: true,
  privacyNoticeApproved: true,
};

const input = (overrides: Partial<MonoLookupInput> = {}): MonoLookupInput => ({
  applicationId: APP,
  requirementId: REQ,
  subjectSnapshotId: SUBJECT,
  actorUserId: ACTOR,
  consentRecordId: CONSENT,
  operationKey: 'synthetic-lookup-operation-01',
  channel: 'tin' as const,
  number: 'SYNTHETIC-TIN-0001',
  expectedCorporateName: 'Synthetic Example Limited',
  expectedRcNumber: 'RC-SYNTHETIC-01',
  ...overrides,
});

function harness(options: {
  enabled?: boolean;
  consentError?: boolean;
  reserve?: Partial<Awaited<ReturnType<MonoLookupEvidenceJournal['reserve']>>>;
  response?: MonoLookupHttpResponse;
  transportError?: boolean;
  appendError?: boolean;
} = {}) {
  const settings = { ...SETTINGS, enabled: options.enabled ?? true };
  const config = { get: (key: string) => key === 'corporate.monoLookup' ? settings : undefined } as unknown as ConfigService;
  const consent = {
    requireApprovedLookupConsent: jest.fn(async () => {
      if (options.consentError) throw new Error('synthetic consent failure');
      return {};
    }),
  } as unknown as VerificationConsentService;
  const transport: jest.Mocked<MonoLookupHttpTransport> = {
    get: jest.fn(async (_url, _headers, _timeout): Promise<MonoLookupHttpResponse> => {
      void _url; void _headers; void _timeout;
      if (options.transportError) throw new Error('synthetic transport failure');
      return options.response ?? { status: 200, body: {
        status: 'successful',
        message: 'Lookup Successful',
        data: { taxpayer_name: 'SYNTHETIC EXAMPLE LIMITED', tin_type: 'CORPORATE', nrs_tin: 'NEVER_RETURNED' },
      } };
    }),
    post: jest.fn(async (_url, _headers, _body, _timeout): Promise<MonoLookupHttpResponse> => {
      void _url; void _headers; void _body; void _timeout;
      if (options.transportError) throw new Error('synthetic transport failure');
      return options.response ?? { status: 200, body: {
        status: 'successful',
        message: 'Lookup Successful',
        data: { taxpayer_name: 'SYNTHETIC EXAMPLE LIMITED', tin_type: 'CORPORATE', nrs_tin: 'NEVER_RETURNED' },
      } };
    }),
  };
  const evidence: jest.Mocked<MonoLookupEvidenceJournal> = {
    reserve: jest.fn(async (_input: Parameters<MonoLookupEvidenceJournal['reserve']>[0]) => {
      void _input;
      return { evidenceId: '60000000-0000-4000-8000-000000000006', reference: 'sf-synthetic-reference', shouldLookup: true, ...options.reserve };
    }),
    append: jest.fn(async (_input: Parameters<MonoLookupEvidenceJournal['append']>[0]) => {
      void _input;
      if (options.appendError) throw new Error('synthetic persistence failure');
    }),
  };
  return { adapter: new MonoLookupAdapter(config, consent, transport, evidence), consent, transport, evidence };
}

describe('MonoLookupAdapter (documented CAC/TIN sandbox contracts; synthetic only)', () => {
  it('does not call consent, evidence, or Mono when disabled', async () => {
    const h = harness({ enabled: false });
    const result = await h.adapter.verifyBusiness(input());
    expect(result).toMatchObject({ status: 'UNAVAILABLE', safeReason: 'FEATURE_DISABLED' });
    expect(h.consent.requireApprovedLookupConsent).not.toHaveBeenCalled();
    expect(h.evidence.reserve).not.toHaveBeenCalled();
    expect(h.transport.post).not.toHaveBeenCalled();
  });

  it('requires approved versioned consent before reserving evidence or sending the synthetic TIN', async () => {
    const h = harness({ consentError: true });
    const result = await h.adapter.verifyBusiness(input());
    expect(result).toMatchObject({ status: 'UNAVAILABLE', safeReason: 'APPROVED_CONSENT_REQUIRED' });
    expect(h.evidence.reserve).not.toHaveBeenCalled();
    expect(h.transport.post).not.toHaveBeenCalled();
  });

  it('uses documented POST /v3/lookup/tin fields, records only a hash, and returns no taxpayer data', async () => {
    const h = harness();
    const result = await h.adapter.verifyBusiness(input());
    expect(result).toMatchObject({ status: 'PROVIDER_VERIFIED', safeReason: 'PROVIDER_MATCHED', idempotentReplay: false });
    expect(h.transport.post).toHaveBeenCalledWith(
      'https://api.withmono.com/v3/lookup/tin',
      expect.objectContaining({ 'mono-sec-key': 'test_sk_synthetic_only' }),
      { number: 'SYNTHETIC-TIN-0001', channel: 'tin' },
      8_000,
    );
    expect(h.evidence.append).toHaveBeenCalledWith(expect.objectContaining({ status: 'PROVIDER_VERIFIED', rawPayloadSha256: expect.stringMatching(/^[a-f0-9]{64}$/) }));
    expect(JSON.stringify(result)).not.toContain('SYNTHETIC EXAMPLE LIMITED');
    expect(JSON.stringify(result)).not.toContain('NEVER_RETURNED');
    expect(JSON.stringify(h.evidence.append.mock.calls)).not.toContain('SYNTHETIC-TIN-0001');
  });

  it('uses the distinct documented CAC GET /v3/lookup/cac endpoint and exact RC match', async () => {
    const h = harness({
      response: { status: 200, body: { status: 'successful', data: [{ rc_number: 'rc-synthetic-01', active: true, registration_approved: true, approved_name: 'Synthetic Name' }] } },
    });
    const result = await h.adapter.verifyBusiness(input({ channel: 'cac', number: 'RC-SYNTHETIC-01' }));
    expect(result.status).toBe('PROVIDER_VERIFIED');
    expect(h.transport.get).toHaveBeenCalledWith(
      'https://api.withmono.com/v3/lookup/cac?search=RC-SYNTHETIC-01',
      expect.objectContaining({ 'mono-sec-key': 'test_sk_synthetic_only' }),
      8_000,
    );
    expect(h.transport.post).not.toHaveBeenCalled();
    expect(JSON.stringify(result)).not.toContain('Synthetic Name');
  });

  it('never fabricates a match for provider mismatch, invalid response, failed transport, or failed evidence append', async () => {
    const mismatch = harness({ response: { status: 200, body: { status: 'successful', data: { tin_type: 'CORPORATE', taxpayer_name: 'Different Company' } } } });
    expect((await mismatch.adapter.verifyBusiness(input())).status).toBe('PROVIDER_FAILED');

    const invalid = harness({ response: { status: 200, body: { error: 'bad' } } });
    expect(await invalid.adapter.verifyBusiness(input())).toMatchObject({ status: 'UNAVAILABLE', safeReason: 'INVALID_PROVIDER_RESPONSE' });

    const failedTransport = harness({ transportError: true });
    expect(await failedTransport.adapter.verifyBusiness(input())).toMatchObject({ status: 'UNAVAILABLE', safeReason: 'TRANSPORT_UNAVAILABLE' });

    const failedPersistence = harness({ appendError: true });
    expect(await failedPersistence.adapter.verifyBusiness(input())).toMatchObject({ status: 'UNAVAILABLE', safeReason: 'EVIDENCE_APPEND_FAILED' });
  });

  it('does not call Mono again for an idempotent replay', async () => {
    const h = harness({ reserve: { shouldLookup: false, existingStatus: 'PROVIDER_VERIFIED' } });
    expect(await h.adapter.verifyBusiness(input())).toMatchObject({ status: 'PROVIDER_VERIFIED', idempotentReplay: true });
    expect(h.transport.post).not.toHaveBeenCalled();
  });
});
