import { UserRole } from '@prisma/client';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import {
  CorporateDraftFingerprintKeyProvider,
  CorporateDraftPayloadFingerprinter,
} from '../crypto/corporate-draft-fingerprint';
import { CorporateDraftBootstrapInput } from '../dto/corporate-draft-bootstrap.input';
import { CorporateApplicantContextService } from './corporate-applicant-context.service';
import { CorporateDraftBootstrapService } from './corporate-draft-bootstrap.service';

const USER_ID = '11111111-1111-4111-8111-111111111111';
const KEY = 'test-only-non-tin-bootstrap-hmac-key-0123456789abcdef';
const principal: AuthPrincipal = {
  userId: USER_ID,
  role: UserRole.INVESTOR,
  sessionId: '22222222-2222-4222-8222-222222222222',
};
const input: CorporateDraftBootstrapInput = {
  institutionName: 'Example Holdings Ltd',
  dateOfIncorporation: '2020-01-02',
  rcNumber: 'RC-123',
  businessPhoneNumber: '+2348000000000',
  businessEmail: 'accounts@example.com',
};

interface FakeState {
  accounts: Array<Record<string, unknown>>;
  applications: Array<Record<string, unknown>>;
  details: Array<Record<string, unknown>>;
  history: Array<Record<string, unknown>>;
  creations: Array<Record<string, unknown>>;
  keys: Array<Record<string, unknown>>;
}

function createHarness() {
  const state: FakeState = { accounts: [], applications: [], details: [], history: [], creations: [], keys: [] };
  let sequence = 0;
  let failDetailsInsert = false;
  let queue: Promise<void> = Promise.resolve();
  const user = { id: USER_ID, role: UserRole.INVESTOR, emailVerifiedAt: new Date('2025-01-01T00:00:00Z') };

  const txFor = (draft: FakeState) => ({
    corporateAccount: {
      create: jest.fn(async () => {
        const row = { id: `account-${++sequence}` };
        draft.accounts.push(row);
        return row;
      }),
    },
    onboardingApplication: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `application-${++sequence}`, ...data };
        draft.applications.push(row);
        return row;
      }),
    },
    corporateOnboardingDetails: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        if (failDetailsInsert) throw new Error('synthetic transaction failure');
        const row = { ...data };
        draft.details.push(row);
        return row;
      }),
    },
    onboardingApplicationHistory: {
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const row = { id: `history-${++sequence}`, ...data };
        draft.history.push(row);
        return row;
      }),
    },
    corporateDraftCreation: {
      findUnique: jest.fn(async ({ where }: any) => {
        const q = where.initiatorOperationPayload;
        return draft.creations.find((row) =>
          row.initiatingUserId === q.initiatingUserId &&
          row.operation === q.operation &&
          row.payloadFingerprintHmac === q.payloadFingerprintHmac,
        ) ?? null;
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const duplicate = draft.creations.some((row) =>
          row.initiatingUserId === data.initiatingUserId &&
          row.operation === data.operation &&
          row.payloadFingerprintHmac === data.payloadFingerprintHmac,
        );
        if (duplicate) throw new Error('simulated unique payload collision');
        const row = { id: `creation-${++sequence}`, ...data };
        draft.creations.push(row);
        return row;
      }),
    },
    corporateDraftIdempotencyKey: {
      findUnique: jest.fn(async ({ where }: any) => {
        const q = where.initiatorOperationKey;
        const key = draft.keys.find((row) =>
          row.initiatingUserId === q.initiatingUserId &&
          row.operation === q.operation &&
          row.idempotencyKeyDigest === q.idempotencyKeyDigest,
        );
        if (!key) return null;
        return { ...key, creation: draft.creations.find((row) => row.id === key.creationId) };
      }),
      create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
        const duplicate = draft.keys.some((row) =>
          row.initiatingUserId === data.initiatingUserId &&
          row.operation === data.operation &&
          row.idempotencyKeyDigest === data.idempotencyKeyDigest,
        );
        if (duplicate) throw new Error('simulated unique key collision');
        const row = { id: `key-${++sequence}`, ...data };
        draft.keys.push(row);
        return row;
      }),
      createMany: jest.fn(async ({ data }: { data: Array<Record<string, unknown>> }) => {
        for (const value of data) {
          const duplicate = draft.keys.some((row) =>
            row.initiatingUserId === value.initiatingUserId &&
            row.operation === value.operation &&
            row.idempotencyKeyDigest === value.idempotencyKeyDigest,
          );
          if (!duplicate) draft.keys.push({ id: `key-${++sequence}`, ...value });
        }
        return { count: data.length };
      }),
    },
  });

  const prisma: any = {
    user: { findUnique: jest.fn(async () => user) },
    $transaction: jest.fn(async (callback: (tx: any) => Promise<unknown>) => {
      // Deterministic serial transaction harness. Each callback mutates a
      // private snapshot; exceptions discard all writes, modeling atomicity.
      const previous = queue;
      let release!: () => void;
      queue = new Promise<void>((resolve) => { release = resolve; });
      await previous;
      const draft = structuredClone(state);
      try {
        const result = await callback(txFor(draft));
        Object.assign(state, draft);
        return result;
      } finally {
        release();
      }
    }),
  };
  const keys: CorporateDraftFingerprintKeyProvider = { getNonTinBootstrapKey: () => KEY };
  const service = new CorporateDraftBootstrapService(
    prisma,
    new CorporateApplicantContextService(prisma),
    new CorporateDraftPayloadFingerprinter(keys),
  );
  jest.spyOn((service as any).logger, 'error').mockImplementation(() => undefined);

  return {
    state,
    prisma,
    service,
    failNextDetailsInsert: () => { failDetailsInsert = true; },
    makeUnconfiguredService: () => new CorporateDraftBootstrapService(
      prisma,
      new CorporateApplicantContextService(prisma),
      new CorporateDraftPayloadFingerprinter({ getNonTinBootstrapKey: () => undefined }),
    ),
  };
}

describe('CorporateDraftBootstrapService (internal non-TIN primitive; no public O2 route)', () => {
  it('atomically creates account, DRAFT application, version-1 details, creation history and receipt', async () => {
    const h = createHarness();
    const result = await h.service.createDraft(principal, input, 'key-1');

    expect(result).toEqual({
      corporateAccountId: 'account-1',
      applicationId: 'application-2',
      applicationStatus: 'DRAFT',
      detailsVersion: 1,
    });
    expect(h.state.accounts).toHaveLength(1);
    expect(h.state.applications).toHaveLength(1);
    expect(h.state.applications[0]).toMatchObject({
      kind: 'CORPORATE',
      ownerCorporateAccountId: 'account-1',
      initiatingUserId: USER_ID,
      status: 'DRAFT',
      submittedByUserId: null,
      submittedAt: null,
    });
    expect(h.state.details).toHaveLength(1);
    expect(h.state.details[0]).toMatchObject({
      applicationId: 'application-2',
      institutionName: input.institutionName,
      version: 1,
    });
    expect(h.state.details[0]).not.toHaveProperty('taxIdentificationNumber');
    expect(h.state.history).toHaveLength(1);
    expect(h.state.history[0]).toMatchObject({
      event: 'CREATED', fromStatus: null, toStatus: 'DRAFT', actorUserId: USER_ID,
    });
    expect(h.state.creations).toHaveLength(1);
    expect(h.state.keys).toHaveLength(1);
  });

  it('replays the original receipt for the same key and same canonical payload', async () => {
    const h = createHarness();
    const first = await h.service.createDraft(principal, input, 'key-replay');
    const second = await h.service.createDraft(principal, { ...input, businessEmail: 'ACCOUNTS@EXAMPLE.COM' }, 'key-replay');
    expect(second).toEqual(first);
    expect(h.state.accounts).toHaveLength(1);
    expect(h.state.applications).toHaveLength(1);
  });

  it('returns a generic conflict for the same key with a changed payload', async () => {
    const h = createHarness();
    await h.service.createDraft(principal, input, 'key-changed');
    await expect(h.service.createDraft(principal, { ...input, rcNumber: 'RC-999' }, 'key-changed'))
      .rejects.toMatchObject({ status: 409, response: expect.objectContaining({ code: 'CONFLICT' }) });
    expect(h.state.accounts).toHaveLength(1);
  });

  it('maps a same-user identical non-TIN bootstrap payload under a different key to the original receipt', async () => {
    const h = createHarness();
    const first = await h.service.createDraft(principal, input, 'key-a');
    const second = await h.service.createDraft(principal, input, 'key-b');
    expect(second).toEqual(first);
    expect(h.state.accounts).toHaveLength(1);
    expect(h.state.applications).toHaveLength(1);
    expect(h.state.keys).toHaveLength(2);
  });

  it('serializes concurrent identical requests without creating duplicate shells', async () => {
    const h = createHarness();
    const [first, second] = await Promise.all([
      h.service.createDraft(principal, input, 'concurrent-a'),
      h.service.createDraft(principal, input, 'concurrent-b'),
    ]);
    expect(first).toEqual(second);
    expect(h.state.accounts).toHaveLength(1);
    expect(h.state.applications).toHaveLength(1);
    expect(h.state.keys).toHaveLength(2);
  });

  it('rolls back every write when details creation fails', async () => {
    const h = createHarness();
    h.failNextDetailsInsert();
    await expect(h.service.createDraft(principal, input, 'key-rollback')).rejects.toMatchObject({ status: 500 });
    expect(h.state.accounts).toHaveLength(0);
    expect(h.state.applications).toHaveLength(0);
    expect(h.state.details).toHaveLength(0);
    expect(h.state.history).toHaveLength(0);
    expect(h.state.creations).toHaveLength(0);
    expect(h.state.keys).toHaveLength(0);
  });

  it('does not start a transaction without the purpose-specific fingerprint key', async () => {
    const h = createHarness();
    await expect(h.makeUnconfiguredService().createDraft(principal, input, 'key-no-secret'))
      .rejects.toMatchObject({ status: 503 });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
    expect(h.state.accounts).toHaveLength(0);
  });

  it('rejects unverified investors before any creation transaction', async () => {
    const h = createHarness();
    h.prisma.user.findUnique.mockResolvedValueOnce({
      id: USER_ID, role: UserRole.INVESTOR, emailVerifiedAt: null,
    });
    await expect(h.service.createDraft(principal, input, 'key-unverified'))
      .rejects.toMatchObject({ status: 403, response: expect.objectContaining({ code: 'EMAIL_NOT_VERIFIED' }) });
    expect(h.prisma.$transaction).not.toHaveBeenCalled();
  });
});
