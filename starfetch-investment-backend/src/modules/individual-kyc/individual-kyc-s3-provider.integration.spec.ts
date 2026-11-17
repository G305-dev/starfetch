import { S3CompatibleIndividualKycDocumentStorage } from './individual-kyc-s3-storage';

const runAgainstExplicitProvider = process.env.INDIVIDUAL_KYC_S3_PROVIDER_PROBE === 'true';
const describeIfConfigured = runAgainstExplicitProvider ? describe : describe.skip;

describeIfConfigured('explicit S3-compatible provider conditional-write capability probe (synthetic only)', () => {
  it('requires bucket versioning, checksum/metadata/SSE behavior, and replayed signed PUT rejection', async () => {
    const endpoint = process.env.INDIVIDUAL_KYC_S3_ENDPOINT;
    const bucket = process.env.INDIVIDUAL_KYC_S3_BUCKET;
    const region = process.env.INDIVIDUAL_KYC_S3_REGION;
    const credentialReference = process.env.INDIVIDUAL_KYC_S3_CREDENTIAL_REFERENCE;
    if (!endpoint || !bucket || !region || !credentialReference) throw new Error('Explicit provider probe configuration is incomplete.');
    const storage = new S3CompatibleIndividualKycDocumentStorage({
      enabled: true, endpoint, bucket, region, credentialReference,
      forcePathStyle: process.env.INDIVIDUAL_KYC_S3_FORCE_PATH_STYLE !== 'false',
      residencyApproved: process.env.INDIVIDUAL_KYC_STORAGE_RESIDENCY_APPROVED === 'true',
      privateBucketApproved: process.env.INDIVIDUAL_KYC_STORAGE_PRIVATE_BUCKET_APPROVED === 'true',
      tlsPolicyApproved: process.env.INDIVIDUAL_KYC_STORAGE_TLS_POLICY_APPROVED === 'true',
      isVercel: process.env.VERCEL === '1',
      roleArn: process.env.AWS_ROLE_ARN,
    });
    await storage.probeProviderCapabilities();
  });
});
