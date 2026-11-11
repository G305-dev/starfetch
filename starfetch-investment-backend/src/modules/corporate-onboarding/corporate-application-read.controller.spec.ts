import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { CookieMutationGuard } from '../../common/security/cookie-mutation.guard';
import { KeyedRateLimitGuard } from '../../common/rate-limit/keyed-rate-limit.guard';
import { AuthenticatedRequest } from '../../common/types/auth-principal';
import { ApplicationVerificationSnapshotFreshnessService } from '../verification-rulesets/services/application-verification-snapshot-freshness.service';
import { ApplicationVerificationSnapshotService } from '../verification-rulesets/services/application-verification-snapshot.service';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CorporateApplicantGuard } from './guards/corporate-applicant.guard';
import {
  CorporateApplicationDiscoveryController,
  CorporateApplicationReadController,
} from './corporate-application-read.controller';
import { CorporateApplicationReadService } from './services/corporate-application-read.service';
import { CorporateDetailsEditService } from './services/corporate-details-edit.service';
import { CorporateApplicantContextService } from './services/corporate-applicant-context.service';
import { CorporateApplicationAccessService } from './services/corporate-application-access.service';

const principal = {
  userId: '11111111-1111-4111-8111-111111111111',
  role: 'INVESTOR',
  sessionId: 'synthetic-session',
} as AuthenticatedRequest['principal'];
const corporateAccountId = '22222222-2222-4222-8222-222222222222';
const applicationId = '33333333-3333-4333-8333-333333333333';

describe('CorporateApplicationReadController O3/O11/O4 routes', () => {
  let app: INestApplication;
  const reads = {
    getApplicationByCorporateAccountId: jest.fn().mockResolvedValue({ corporateAccountId, applicationId, status: 'DRAFT' }),
    getHistoryByCorporateAccountId: jest.fn().mockResolvedValue({ corporateAccountId, applicationId, history: [], detailsAmendments: [] }),
    listInitiatedApplications: jest.fn().mockResolvedValue([]),
  };
  const edits = { updateByCorporateAccountId: jest.fn().mockResolvedValue({ applicationId, corporateAccountId, status: 'DRAFT' }) };
  const applicants = { requireVerifiedInvestor: jest.fn().mockResolvedValue({ initiatingUserId: principal!.userId }) };
  const access = { requireInitiatorOwnedCorporateAccount: jest.fn().mockResolvedValue({ id: applicationId }) };
  const snapshots = { createOrGetSnapshot: jest.fn().mockResolvedValue({ applicationId, generation: 1 }) };
  const freshness = { assess: jest.fn().mockResolvedValue({ applicationId, generation: 1, isFresh: true, issues: [] }) };

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      controllers: [CorporateApplicationReadController, CorporateApplicationDiscoveryController],
      providers: [
        { provide: CorporateApplicationReadService, useValue: reads },
        { provide: CorporateDetailsEditService, useValue: edits },
        { provide: CorporateApplicantContextService, useValue: applicants },
        { provide: CorporateApplicationAccessService, useValue: access },
        { provide: ApplicationVerificationSnapshotService, useValue: snapshots },
        { provide: ApplicationVerificationSnapshotFreshnessService, useValue: freshness },
      ],
    })
      .overrideGuard(AccessTokenGuard)
      .useValue({
        canActivate: jest.fn((context) => {
          context.switchToHttp().getRequest().principal = principal;
          return true;
        }),
      })
      .overrideGuard(CorporateApplicantGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(CookieMutationGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .overrideGuard(KeyedRateLimitGuard)
      .useValue({ canActivate: jest.fn(() => true) })
      .compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api/v1');
    await app.init();
  });

  afterAll(async () => app?.close());
  beforeEach(() => {
    for (const method of Object.values(reads)) method.mockClear();
    edits.updateByCorporateAccountId.mockClear();
    snapshots.createOrGetSnapshot.mockClear();
    freshness.assess.mockClear();
    applicants.requireVerifiedInvestor.mockClear();
    access.requireInitiatorOwnedCorporateAccount.mockClear();
  });

  it('routes O3 with an explicitly named corporateAccountId and preserves the distinct applicationId', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/corporate-accounts/${corporateAccountId}/onboarding`)
      .expect(200)
      .expect(({ body }) => expect(body).toMatchObject({ corporateAccountId, applicationId, status: 'DRAFT' }));
    expect(reads.getApplicationByCorporateAccountId).toHaveBeenCalledWith(principal, corporateAccountId);
  });

  it('routes O11 history under the same account ID and preserves permitted amendment metadata', async () => {
    await request(app.getHttpServer())
      .get(`/api/v1/corporate-accounts/${corporateAccountId}/onboarding/history`)
      .expect(200)
      .expect(({ body }) => expect(body).toEqual({ corporateAccountId, applicationId, history: [], detailsAmendments: [] }));
    expect(reads.getHistoryByCorporateAccountId).toHaveBeenCalledWith(principal, corporateAccountId);
  });

  it('routes O4 via If-Match and passes only the CorporateAccount-scoped update to the service', async () => {
    const body = { institutionName: 'Synthetic Amendment Ltd' };
    await request(app.getHttpServer())
      .patch(`/api/v1/corporate-accounts/${corporateAccountId}/onboarding/draft`)
      .set('If-Match', '"2"')
      .send(body)
      .expect(200);
    expect(edits.updateByCorporateAccountId).toHaveBeenCalledWith(principal, corporateAccountId, 2, body);
  });

  it('exposes owner-scoped discovery and authenticated snapshot freshness/regeneration operations', async () => {
    await request(app.getHttpServer()).get('/api/v1/me/corporate-accounts').expect(200);
    expect(reads.listInitiatedApplications).toHaveBeenCalledWith(principal);

    await request(app.getHttpServer())
      .get(`/api/v1/corporate-accounts/${corporateAccountId}/onboarding/verification-snapshot/freshness`)
      .expect(200);
    await request(app.getHttpServer())
      .post(`/api/v1/corporate-accounts/${corporateAccountId}/onboarding/verification-snapshot`)
      .expect(200);
    expect(access.requireInitiatorOwnedCorporateAccount).toHaveBeenCalledTimes(2);
    expect(freshness.assess).toHaveBeenCalledWith(principal, applicationId);
    expect(snapshots.createOrGetSnapshot).toHaveBeenCalledWith(principal, applicationId);
  });
});
