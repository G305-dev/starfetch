import { CorporateO2ActivationGuard, CorporateO2AvailabilityService } from './corporate-o2-availability.service';

const ready = {
  'platform.isVercel': true,
  'platform.vercelEnvironment': 'production',
  'corporate.o2.enabled': true,
  'corporate.o2.lawfulBasisApproved': true,
  'corporate.o2.privacyNoticeApproved': true,
  'corporate.o2.retentionApproved': true,
  'corporate.o2.kmsKeyId': 'arn:aws:kms:eu-west-1:123456789012:key/synthetic',
  'corporate.o2.kmsKeyVersion': 'kms-v1',
  'corporate.o2.awsRoleArn': 'arn:aws:iam::123456789012:role/starfetch-corporate-o2',
  'corporate.o2.awsRegion': 'eu-west-1',
  'corporate.o2.hmacActiveVersion': 'hmac-v1',
  'corporate.o2.hmacKeysJson': '{configured-by-test-only}',
  'corporate.o2.rateLimitRedisRestUrl': 'https://redis.example.invalid',
  'corporate.o2.rateLimitRedisRestToken': 'test-only-not-a-redis-credential',
  'corporate.o2.rateLimitHmacSecret': Buffer.alloc(32, 0x48).toString('base64'),
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

  it('requires a valid AWS role ARN for Vercel Production OIDC', () => {
    expect(create({ ...ready, 'corporate.o2.awsRoleArn': undefined }).availability.isAvailable()).toBe(false);
    expect(create({ ...ready, 'corporate.o2.awsRoleArn': 'not-an-iam-role-arn' }).availability.isAvailable()).toBe(false);
  });

  it('keeps Corporate O2 unavailable in Vercel Preview even if its gate and test role are configured', () => {
    expect(create({ ...ready, 'platform.vercelEnvironment': 'preview' }).availability.isAvailable()).toBe(false);
  });

  it('allows non-Vercel deployments to use the AWS SDK workload credential chain without AWS_ROLE_ARN', () => {
    const nonVercel = { ...ready, 'platform.isVercel': false, 'platform.vercelEnvironment': undefined };
    delete (nonVercel as Record<string, unknown>)['corporate.o2.awsRoleArn'];
    expect(create(nonVercel).availability.isAvailable()).toBe(true);
  });

  it('opens Vercel Production only with explicit feature, approvals, OIDC role, KMS and dedicated HMAC configuration', () => {
    expect(create(ready).availability.isAvailable()).toBe(true);
  });
});
