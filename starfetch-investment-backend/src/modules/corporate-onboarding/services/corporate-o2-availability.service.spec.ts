import { CorporateO2ActivationGuard, CorporateO2AvailabilityService } from './corporate-o2-availability.service';

const ready = {
  'corporate.o2.enabled': true,
  'corporate.o2.lawfulBasisApproved': true,
  'corporate.o2.privacyNoticeApproved': true,
  'corporate.o2.retentionApproved': true,
  'corporate.o2.kmsKeyId': 'arn:aws:kms:region:account:key/synthetic',
  'corporate.o2.kmsKeyVersion': 'kms-v1',
  'corporate.o2.awsRegion': 'eu-west-1',
  'corporate.o2.hmacActiveVersion': 'hmac-v1',
  'corporate.o2.hmacKeysJson': '{configured-by-test-only}',
};

function create(values: Record<string, unknown>) {
  const config = { get: jest.fn((key: string) => values[key]) };
  const availability = new CorporateO2AvailabilityService(config as any);
  return { availability, guard: new CorporateO2ActivationGuard(availability) };
}

describe('Corporate O2 activation gate', () => {
  it('defaults unavailable and returns only a safe feature response', () => {
    const { availability, guard } = create({});
    expect(availability.isAvailable()).toBe(false);
    try {
      guard.canActivate();
      throw new Error('Expected the disabled activation gate to reject.');
    } catch (error) {
      expect(error).toMatchObject({ status: 503, response: { code: 'FEATURE_UNAVAILABLE' } });
    }
  });

  it('requires every privacy approval and key configuration even with the feature switch set', () => {
    const { availability } = create({ ...ready, 'corporate.o2.retentionApproved': false });
    expect(availability.isAvailable()).toBe(false);
  });

  it('opens only when explicit feature, approval, KMS and dedicated HMAC configuration are present', () => {
    expect(create(ready).availability.isAvailable()).toBe(true);
  });
});
