import 'reflect-metadata';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AccessTokenGuard } from '../auth/guards/access-token.guard';
import { CookieMutationGuard } from '../../common/security/cookie-mutation.guard';
import { KEYED_RATE_LIMIT_KEY } from '../../common/rate-limit/keyed-rate-limit.decorator';
import { CorporateApplicantGuard } from './guards/corporate-applicant.guard';
import { CorporateO2RateLimitGuard } from './guards/corporate-o2-rate-limit.guard';
import { CorporateO2ActivationGuard } from './services/corporate-o2-availability.service';
import { RATE_LIMIT_KEY } from '../../common/rate-limit/rate-limit.decorator';
import { CorporateO2ApplicationsController } from './corporate-o2-applications.controller';

describe('CorporateO2ApplicationsController rate-limit policy', () => {
  const handler = CorporateO2ApplicationsController.prototype.create;

  it('applies the reviewed 5-create-per-hour authenticated-user limit', () => {
    expect(Reflect.getMetadata(KEYED_RATE_LIMIT_KEY, handler)).toEqual({
      bucket: 'corporate-o2-create',
      limit: 5,
      windowSeconds: 3600,
      identity: 'user',
    });
  });

  it('does not claim a separate IP tier that is not configured for O2', () => {
    expect(Reflect.getMetadata(RATE_LIMIT_KEY, handler)).toBeUndefined();
  });

  it('retains the availability, bearer authentication, verified applicant, CSRF, and shared-rate guards', () => {
    const guards = Reflect.getMetadata(GUARDS_METADATA, handler) as unknown[];
    expect(guards).toEqual(expect.arrayContaining([
      CorporateO2ActivationGuard,
      AccessTokenGuard,
      CorporateApplicantGuard,
      CookieMutationGuard,
      CorporateO2RateLimitGuard,
    ]));
  });
});
