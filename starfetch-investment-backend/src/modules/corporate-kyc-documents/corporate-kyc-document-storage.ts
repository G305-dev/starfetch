import { ConfigService } from '@nestjs/config';
import {
  DisabledIndividualKycDocumentStorage,
  IndividualKycDocumentStorage,
} from '../individual-kyc/individual-kyc-document-ports';
import {
  ONBOARDING_DOCUMENTS_CAPABILITY_PROBE_PREFIX,
  S3CompatibleIndividualKycDocumentStorage,
} from '../individual-kyc/individual-kyc-s3-storage';

/**
 * Corporate KYC private document storage.
 *
 * This reuses the EXISTING Individual KYC S3 adapter class, the EXISTING
 * private bucket, the EXISTING Vercel OIDC role (`AWS_ROLE_ARN`) and the EXISTING
 * `INDIVIDUAL_KYC_*` environment variables. No new bucket, credential or env
 * var is introduced.
 *
 * It is a separate *instance* of the adapter for one reason only: the adapter's
 * synthetic capability probe must write inside `onboarding-documents/` so the
 * production IAM grant for Corporate uploads can be scoped to
 * `onboarding-documents/*` alone. The Individual KYC instance (and its
 * `individual-kyc/_capability-probe/` probe) is untouched.
 */
export const CORPORATE_KYC_DOCUMENT_STORAGE = Symbol('CORPORATE_KYC_DOCUMENT_STORAGE');

/** Every object key Corporate KYC writes — documents and probe — is below this prefix. */
export const CORPORATE_KYC_OBJECT_PREFIX = 'onboarding-documents/' as const;

/**
 * Activation gates. Storage stays disabled (every call → 503 FEATURE_UNAVAILABLE)
 * unless ALL are exactly `true`. Same gates as the Individual KYC storage factory.
 */
export const CORPORATE_KYC_STORAGE_GATES = Object.freeze([
  { configKey: 'individualKyc.s3.enabled', env: 'INDIVIDUAL_KYC_S3_STORAGE_ENABLED' },
  { configKey: 'individualKyc.documentUploadEnabled', env: 'INDIVIDUAL_KYC_DOCUMENT_UPLOAD_ENABLED' },
  { configKey: 'individualKyc.dataResidencyApproved', env: 'INDIVIDUAL_KYC_DATA_RESIDENCY_APPROVED' },
  { configKey: 'individualKyc.s3.storageResidencyApproved', env: 'INDIVIDUAL_KYC_STORAGE_RESIDENCY_APPROVED' },
  { configKey: 'individualKyc.s3.privateBucketApproved', env: 'INDIVIDUAL_KYC_STORAGE_PRIVATE_BUCKET_APPROVED' },
  { configKey: 'individualKyc.s3.tlsPolicyApproved', env: 'INDIVIDUAL_KYC_STORAGE_TLS_POLICY_APPROVED' },
  { configKey: 'individualKyc.s3.retentionApproved', env: 'INDIVIDUAL_KYC_STORAGE_RETENTION_APPROVED' },
] as const);

/** Provider settings read once the gates pass (all pre-existing variables). */
export const CORPORATE_KYC_STORAGE_SETTINGS = Object.freeze([
  { configKey: 'individualKyc.s3.bucket', env: 'INDIVIDUAL_KYC_S3_BUCKET' },
  { configKey: 'individualKyc.s3.region', env: 'INDIVIDUAL_KYC_S3_REGION' },
  { configKey: 'individualKyc.s3.endpoint', env: 'INDIVIDUAL_KYC_S3_ENDPOINT' },
  { configKey: 'individualKyc.s3.credentialReference', env: 'INDIVIDUAL_KYC_S3_CREDENTIAL_REFERENCE' },
  { configKey: 'individualKyc.s3.forcePathStyle', env: 'INDIVIDUAL_KYC_S3_FORCE_PATH_STYLE' },
  { configKey: 'individualKyc.awsRoleArn', env: 'AWS_ROLE_ARN' },
  { configKey: 'platform.isVercel', env: 'VERCEL' },
] as const);

export function createCorporateKycDocumentStorage(config: ConfigService): IndividualKycDocumentStorage {
  const allowed = CORPORATE_KYC_STORAGE_GATES.every(({ configKey }) => config.get<boolean>(configKey) === true);
  if (!allowed) return new DisabledIndividualKycDocumentStorage();
  return new S3CompatibleIndividualKycDocumentStorage({
    enabled: true,
    endpoint: config.get<string>('individualKyc.s3.endpoint'),
    bucket: config.get<string>('individualKyc.s3.bucket'),
    region: config.get<string>('individualKyc.s3.region'),
    credentialReference: config.get<string>('individualKyc.s3.credentialReference'),
    forcePathStyle: config.get<boolean>('individualKyc.s3.forcePathStyle') ?? true,
    residencyApproved: true,
    privateBucketApproved: true,
    tlsPolicyApproved: true,
    isVercel: config.get<boolean>('platform.isVercel') === true,
    roleArn: config.get<string>('individualKyc.awsRoleArn'),
    capabilityProbePrefix: ONBOARDING_DOCUMENTS_CAPABILITY_PROBE_PREFIX,
  });
}
