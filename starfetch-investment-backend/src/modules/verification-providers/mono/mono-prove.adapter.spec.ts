import { ConfigService } from '@nestjs/config';
import { MonoProveAdapter, MonoProveInitiationInput } from './mono-prove.adapter';
import {
  ApprovedMonoProveConsent,
  MonoEvidenceAppend,
  MonoEvidenceJournal,
  MonoEvidenceReservation,
  MonoHttpResponse,
  MonoHttpTransport,
  MonoProveAuthorizationRequest,
  MonoProveConsentAuthorizer,
  MonoWebhookEvidenceAppend,
} from './mono-verification-ports';

const APP_ID = '10000000-0000-4000-8000-000000000001';
const REQUIREMENT_ID = '20000000-0000-4000-8000-000000000002';
const ACTOR_ID = '30000000-0000-4000-8000-000000000003';
const SUBJECT_ID = '40000000-0000-4000-8000-000000000004';
const CONSENT_ID = '50000000-0000-4000-8000-000000000005';
const SETTINGS = {
  enabled: true,
  environment: 'sandbox' as const,
  secretKey: 'synthetic-sandbox-secret-not-a-credential',
  redirectUrl: 'https://app.starfetch.example/corporate/verify',
  consentTextVersion: 'approved-v1',
  consentTextSha256: 'a'.repeat(64),
  privacyNoticeVersion: 'privacy-v1',
  lawfulBasisVersion: 'basis-v1',
  lawfulBasisApproved: true,
  privacyNoticeApproved: true,
  consentTextApproved: true,
};

function input(overrides: Partial<MonoProveInitiationInput> = {}): MonoProveInitiationInput {
  return {
    applicationId: APP_ID,
    requirementId: REQUIREMENT_ID,
    actorUserId: ACTOR_ID,
    subjectUserId: SUBJECT_ID,
    consentRecordId: CONSENT_ID,
    operationKey: 'synthetic-operation-01',
    identities: ['bvn'],
    customer: {
      name: 'Synthetic Test Person',
      phone: '+2348000000000',
      email: 'synthetic@example.invalid',
      identity: { number: '12345678901', type: 'bvn' },
    },
    ...overrides,
  };
}

function harness(options: {
  settings?: Partial<typeof SETTINGS>;
  consentAllowed?: boolean;
  reservation?: Partial<Awaited<ReturnType<MonoEvidenceJournal['reserve']>>>;
  response?: { status: number; body: unknown };
  transportError?: Error;
  appendError?: Error;
} = {}) {
  const settings = { ...SETTINGS, ...options.settings };
  const config = { get: (key: string) => key === 'corporate.mono' ? settings : undefined } as unknown as ConfigService;
  const transport: jest.Mocked<MonoHttpTransport> = {
    post: jest.fn(async (_url: string, _headers: Readonly<Record<string, string>>, _body: unknown, _timeoutMs: number): Promise<MonoHttpResponse> => {
      void _url; void _headers; void _body; void _timeoutMs;
      if (options.transportError) throw options.transportError;
      return options.response ?? { status: 200, body: { data: { id: 'PRV-SYNTHETIC-01', url: 'https://verify.withmono.com/session/synthetic' } } };
    }),
  };
  const consent: jest.Mocked<MonoProveConsentAuthorizer> = {
    requireApprovedConsent: jest.fn(async (_request: MonoProveAuthorizationRequest): Promise<ApprovedMonoProveConsent> => {
      void _request;
      if (options.consentAllowed === false) throw new Error('no approved consent');
      return {
        applicationId: APP_ID,
        subjectUserId: SUBJECT_ID,
        consentRecordId: CONSENT_ID,
        textVersion: settings.consentTextVersion ?? 'approved-v1',
        privacyNoticeVersion: settings.privacyNoticeVersion ?? 'privacy-v1',
        lawfulBasisVersion: settings.lawfulBasisVersion ?? 'basis-v1',
        allowedIdentities: ['bvn', 'nin'],
      };
    }),
  };
  const evidence: jest.Mocked<MonoEvidenceJournal> = {
    reserve: jest.fn(async (_reservationInput: Parameters<MonoEvidenceJournal['reserve']>[0]): Promise<MonoEvidenceReservation> => {
      void _reservationInput;
      return {
        evidenceId: '60000000-0000-4000-8000-000000000006',
        reference: 'sf-synthetic-reference-01',
        shouldInitiate: true,
        ...options.reservation,
      };
    }),
    append: jest.fn(async (_event: MonoEvidenceAppend): Promise<void> => {
      void _event;
      if (options.appendError) throw options.appendError;
    }),
    appendWebhook: jest.fn(async (_event: MonoWebhookEvidenceAppend): Promise<boolean> => { void _event; return true; }),
  };
  return { adapter: new MonoProveAdapter(config, transport, consent, evidence), config, transport, consent, evidence };
}

describe('MonoProveAdapter (synthetic tests; no network)', () => {
  it('fails closed by default and does not call consent, journal, or provider', async () => {
    const h = harness({ settings: { enabled: false } });
    const result = await h.adapter.initiate(input());
    expect(result).toMatchObject({ status: 'UNAVAILABLE', safeReason: 'FEATURE_DISABLED' });
    expect(h.consent.requireApprovedConsent).not.toHaveBeenCalled();
    expect(h.evidence.reserve).not.toHaveBeenCalled();
    expect(h.transport.post).not.toHaveBeenCalled();
  });

  it('requires persisted approved consent before reserving evidence or transmitting identity data', async () => {
    const h = harness({ consentAllowed: false });
    const result = await h.adapter.initiate(input());
    expect(result).toMatchObject({ status: 'UNAVAILABLE', safeReason: 'APPROVED_CONSENT_REQUIRED' });
    expect(h.evidence.reserve).not.toHaveBeenCalled();
    expect(h.transport.post).not.toHaveBeenCalled();
  });

  it('persists only pending provider evidence for a validated sandbox initiation', async () => {
    const h = harness();
    const result = await h.adapter.initiate(input());
    expect(result).toMatchObject({
      status: 'PENDING',
      evidenceId: '60000000-0000-4000-8000-000000000006',
      reference: 'sf-synthetic-reference-01',
      providerSessionId: 'PRV-SYNTHETIC-01',
      redirectUrl: 'https://verify.withmono.com/session/synthetic',
      idempotentReplay: false,
    });
    expect(h.transport.post).toHaveBeenCalledWith(
      'https://api.withmono.com/v1/prove/initiate',
      expect.objectContaining({ 'mono-sec-key': SETTINGS.secretKey }),
      expect.objectContaining({
        reference: 'sf-synthetic-reference-01',
        redirect_url: SETTINGS.redirectUrl,
        kyc_level: 'custom',
        identities: ['bvn'],
        bank_accounts: false,
      }),
      8_000,
    );
    expect(h.evidence.append).toHaveBeenCalledWith(expect.objectContaining({
      status: 'PENDING',
      providerKey: 'mono_prove',
      providerReference: 'sf-synthetic-reference-01',
      providerSessionId: 'PRV-SYNTHETIC-01',
    }));
    expect(JSON.stringify(result)).not.toContain('12345678901');
    expect(JSON.stringify(result)).not.toContain(SETTINGS.secretKey);
  });

  it('returns an existing reservation on idempotent replay without another provider request', async () => {
    const h = harness({ reservation: {
      shouldInitiate: false,
      existingStatus: 'PENDING',
      providerSessionId: 'PRV-SYNTHETIC-EXISTING',
      redirectUrl: 'https://verify.withmono.com/session/existing',
    } });
    const result = await h.adapter.initiate(input());
    expect(result).toMatchObject({ status: 'PENDING', idempotentReplay: true });
    expect(h.transport.post).not.toHaveBeenCalled();
  });

  it('returns a prior provider outcome truthfully on replay without another provider request', async () => {
    const h = harness({ reservation: { shouldInitiate: false, existingStatus: 'PROVIDER_VERIFIED' } });
    expect(await h.adapter.initiate(input())).toMatchObject({
      status: 'PROVIDER_VERIFIED',
      idempotentReplay: true,
      safeReason: 'PROVIDER_VERIFIED',
    });
    expect(h.transport.post).not.toHaveBeenCalled();
  });

  it('maps provider outages and malformed responses to UNAVAILABLE, never customer failure', async () => {
    const outage = harness({ response: { status: 503, body: { message: 'synthetic outage' } } });
    expect(await outage.adapter.initiate(input())).toMatchObject({ status: 'UNAVAILABLE', safeReason: 'PROVIDER_TEMPORARILY_UNAVAILABLE' });
    expect(outage.evidence.append).toHaveBeenCalledWith(expect.objectContaining({ status: 'UNAVAILABLE' }));

    const malformed = harness({ response: { status: 200, body: { data: { id: 'only-id' } } } });
    expect(await malformed.adapter.initiate(input())).toMatchObject({ status: 'UNAVAILABLE', safeReason: 'INVALID_PROVIDER_RESPONSE' });
  });

  it('does not release a provider link when append-only evidence storage fails', async () => {
    const h = harness({ appendError: new Error('synthetic journal fault') });
    const result = await h.adapter.initiate(input());
    expect(result).toMatchObject({ status: 'UNAVAILABLE', safeReason: 'EVIDENCE_APPEND_FAILED' });
    expect(result).not.toHaveProperty('redirectUrl');
  });

  it('rejects ruleset identity requests without BVN/NIN or outside consent', async () => {
    const noIdentity = harness();
    expect(await noIdentity.adapter.initiate(input({ identities: ['address'] })))
      .toMatchObject({ status: 'UNAVAILABLE', safeReason: 'INVALID_RULESET_IDENTITIES' });
    expect(noIdentity.transport.post).not.toHaveBeenCalled();

    const consent = harness();
    expect(await consent.adapter.initiate(input({ identities: ['bvn', 'address'] })))
      .toMatchObject({ status: 'UNAVAILABLE', safeReason: 'APPROVED_CONSENT_REQUIRED' });
    expect(consent.transport.post).not.toHaveBeenCalled();
  });
});
