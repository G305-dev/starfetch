import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  DeleteObjectCommand, GetBucketVersioningCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import { createHash, randomUUID } from 'crypto';
import configuration from '../../config/configuration';
import { validateEnv } from '../../config/env.validation';
import { DisabledIndividualKycDocumentStorage } from '../individual-kyc/individual-kyc-document-ports';
import {
  INDIVIDUAL_KYC_CAPABILITY_PROBE_PREFIX,
  ONBOARDING_DOCUMENTS_CAPABILITY_PROBE_PREFIX,
  S3CompatibleIndividualKycDocumentStorage,
} from '../individual-kyc/individual-kyc-s3-storage';
import {
  CORPORATE_KYC_OBJECT_PREFIX,
  CORPORATE_KYC_STORAGE_GATES,
  createCorporateKycDocumentStorage,
} from './corporate-kyc-document-storage';

/**
 * Synthetic configuration only. The account ID is the reserved all-zero test
 * value; no AWS call is made anywhere in this file (S3 client is a fake).
 */
const PROD_BUCKET = 'starfetch-kyc-prod-2026-01';
const PROD_REGION = 'eu-west-1';
const SYNTHETIC_ROLE_ARN = 'arn:aws:iam::000000000000:role/StarfetchCorporateO2VercelProductionRole';

/** The nine INDIVIDUAL_KYC_* deployment variables: seven gates + bucket + region. */
const NINE_DEPLOYMENT_VARIABLES = {
  INDIVIDUAL_KYC_S3_STORAGE_ENABLED: 'true',
  INDIVIDUAL_KYC_DOCUMENT_UPLOAD_ENABLED: 'true',
  INDIVIDUAL_KYC_DATA_RESIDENCY_APPROVED: 'true',
  INDIVIDUAL_KYC_STORAGE_RESIDENCY_APPROVED: 'true',
  INDIVIDUAL_KYC_STORAGE_PRIVATE_BUCKET_APPROVED: 'true',
  INDIVIDUAL_KYC_STORAGE_TLS_POLICY_APPROVED: 'true',
  INDIVIDUAL_KYC_STORAGE_RETENTION_APPROVED: 'true',
  INDIVIDUAL_KYC_S3_BUCKET: PROD_BUCKET,
  INDIVIDUAL_KYC_S3_REGION: PROD_REGION,
} as const;

/** Pre-existing variables the existing adapter / startup validation also require. */
const ALSO_REQUIRED_EXISTING = {
  INDIVIDUAL_KYC_S3_ENDPOINT: 'https://s3.eu-west-1.amazonaws.com',
  INDIVIDUAL_KYC_S3_CREDENTIAL_REFERENCE: 'workload-identity',
  INDIVIDUAL_KYC_KMS_KEY_ID: 'alias/synthetic-individual-kyc-test',
  INDIVIDUAL_KYC_KMS_KEY_VERSION: 'synthetic-v1',
  AWS_REGION: PROD_REGION,
  AWS_ROLE_ARN: SYNTHETIC_ROLE_ARN,
} as const;

const BASE = {
  NODE_ENV: 'test',
  DATABASE_URL: 'postgresql://user:pw@localhost:5432/db',
  JWT_ACCESS_SECRET: 's'.repeat(48),
  CSRF_HMAC_SECRET: 's'.repeat(48),
  EMAIL_VERIFICATION_HMAC_SECRET: 's'.repeat(48),
};

function withEnv<T>(env: Record<string, string>, run: () => T): T {
  const saved = { ...process.env };
  for (const key of Object.keys(process.env)) {
    if (key.startsWith('INDIVIDUAL_KYC_') || key.startsWith('AWS_') || key === 'VERCEL' || key === 'VERCEL_ENV') delete process.env[key];
  }
  Object.assign(process.env, env);
  try { return run(); } finally { process.env = saved; }
}

function configFromEnv(env: Record<string, string>): ConfigService {
  return withEnv(env, () => new ConfigService(configuration()));
}

describe('Corporate KYC storage reuses the existing Individual KYC adapter and INDIVIDUAL_KYC_* settings', () => {
  const fullEnv = { ...NINE_DEPLOYMENT_VARIABLES, ...ALSO_REQUIRED_EXISTING, VERCEL: '1' };

  it('reads the nine deployment variables (plus the existing endpoint/credential reference/role) into the S3 adapter', () => {
    const storage = createCorporateKycDocumentStorage(configFromEnv(fullEnv));
    expect(storage).toBeInstanceOf(S3CompatibleIndividualKycDocumentStorage);
    const adapterConfig = (storage as unknown as { config: Record<string, unknown> }).config;
    expect(adapterConfig).toMatchObject({
      enabled: true,
      bucket: PROD_BUCKET,
      region: PROD_REGION,
      endpoint: 'https://s3.eu-west-1.amazonaws.com',
      credentialReference: 'workload-identity',
      isVercel: true,
      roleArn: SYNTHETIC_ROLE_ARN,
      capabilityProbePrefix: ONBOARDING_DOCUMENTS_CAPABILITY_PROBE_PREFIX,
    });
    // No static credential is ever part of the adapter configuration.
    expect(JSON.stringify(adapterConfig)).not.toMatch(/accessKey|secret/i);
  });

  it.each(CORPORATE_KYC_STORAGE_GATES.map((gate) => [gate.env]))(
    'stays disabled (503 FEATURE_UNAVAILABLE) when %s is not exactly "true"',
    async (envName) => {
      for (const value of ['false', '', 'TRUE', '1']) {
        const storage = createCorporateKycDocumentStorage(configFromEnv({ ...fullEnv, [envName]: value }));
        expect(storage).toBeInstanceOf(DisabledIndividualKycDocumentStorage);
        await expect(storage.putDocumentObject({
          documentId: randomUUID(), objectKey: `onboarding-documents/${randomUUID()}`, bytes: Buffer.from('x'),
          contentType: 'application/pdf', checksumSha256Hex: createHash('sha256').update('x').digest('hex'),
        })).rejects.toBeInstanceOf(ServiceUnavailableException);
      }
    },
  );

  it('the seven gates are exactly the Individual KYC storage gates (no new variable)', () => {
    expect(CORPORATE_KYC_STORAGE_GATES.map((gate) => gate.env).sort()).toEqual([
      'INDIVIDUAL_KYC_DATA_RESIDENCY_APPROVED',
      'INDIVIDUAL_KYC_DOCUMENT_UPLOAD_ENABLED',
      'INDIVIDUAL_KYC_S3_STORAGE_ENABLED',
      'INDIVIDUAL_KYC_STORAGE_PRIVATE_BUCKET_APPROVED',
      'INDIVIDUAL_KYC_STORAGE_RESIDENCY_APPROVED',
      'INDIVIDUAL_KYC_STORAGE_RETENTION_APPROVED',
      'INDIVIDUAL_KYC_STORAGE_TLS_POLICY_APPROVED',
    ]);
  });

  it('startup validation REJECTS the nine variables alone: the endpoint, credential reference and KMS key are also required', () => {
    const run = () => withEnv({}, () => validateEnv({ ...BASE, ...NINE_DEPLOYMENT_VARIABLES, AWS_REGION: PROD_REGION }));
    expect(run).toThrow(/INDIVIDUAL_KYC_S3_ENDPOINT/);
    expect(run).toThrow(/INDIVIDUAL_KYC_S3_CREDENTIAL_REFERENCE/);
    expect(run).toThrow(/Individual KYC KMS key/);
  });

  it('startup validation accepts the nine variables plus the existing endpoint/credential reference/KMS/role values', () => {
    const validated = withEnv({}, () => validateEnv({ ...BASE, ...fullEnv }));
    expect(validated.INDIVIDUAL_KYC_S3_BUCKET).toBe(PROD_BUCKET);
    expect(validated.INDIVIDUAL_KYC_S3_REGION).toBe(PROD_REGION);
    expect(validated.INDIVIDUAL_KYC_DOCUMENT_UPLOAD_ENABLED).toBe(true);
    // Static AWS keys are still refused.
    expect(() => withEnv({}, () => validateEnv({ ...BASE, ...fullEnv, AWS_ACCESS_KEY_ID: 'synthetic' }))).toThrow(/Static AWS access-key/);
  });
});

/** Fake S3 client that records every command so the exact IAM surface can be asserted. */
function recordingHarness(prefix?: typeof ONBOARDING_DOCUMENTS_CAPABILITY_PROBE_PREFIX | typeof INDIVIDUAL_KYC_CAPABILITY_PROBE_PREFIX) {
  const sent: unknown[] = [];
  const presigned: unknown[] = [];
  const send = jest.fn(async (command: unknown) => {
    sent.push(command);
    if (command instanceof GetBucketVersioningCommand) return { Status: 'Enabled' };
    if (command instanceof HeadObjectCommand) {
      const probe = (presigned[0] as PutObjectCommand).input;
      return {
        VersionId: 'probe-v1', ContentLength: probe.ContentLength, ContentType: probe.ContentType,
        ChecksumSHA256: probe.ChecksumSHA256, Metadata: probe.Metadata, ServerSideEncryption: probe.ServerSideEncryption,
      };
    }
    if (command instanceof PutObjectCommand) return { VersionId: 'doc-v1' };
    return {};
  });
  const presigner = jest.fn(async (_client: unknown, command: unknown) => {
    presigned.push(command);
    return 'https://s3.eu-west-1.amazonaws.com/signed?X-Amz-Signature=synthetic&X-Amz-Expires=60';
  });
  const fetcher = jest.fn()
    .mockResolvedValueOnce(new Response('', { status: 200, headers: { 'x-amz-version-id': 'probe-v1' } }))
    .mockResolvedValueOnce(new Response('', { status: 412 }));
  const storage = new S3CompatibleIndividualKycDocumentStorage({
    enabled: true, endpoint: 'https://s3.eu-west-1.amazonaws.com', bucket: PROD_BUCKET, region: PROD_REGION,
    credentialReference: 'workload-identity', forcePathStyle: false,
    residencyApproved: true, privateBucketApproved: true, tlsPolicyApproved: true,
    ...(prefix ? { capabilityProbePrefix: prefix } : {}),
  }, { send } as unknown as S3Client, presigner as never, fetcher as never);
  return { storage, sent, presigned };
}

/** IAM action + resource each recorded S3 operation requires (per AWS S3 authorization rules). */
function requiredPermission(command: unknown): string {
  const input = (command as { input: Record<string, unknown> }).input;
  if (input.Bucket !== PROD_BUCKET) throw new Error('unexpected bucket');
  if (command instanceof GetBucketVersioningCommand) return `s3:GetBucketVersioning arn:aws:s3:::${PROD_BUCKET}`;
  const key = String(input.Key);
  const object = `arn:aws:s3:::${PROD_BUCKET}/${key}`;
  if (command instanceof PutObjectCommand) return `s3:PutObject ${object}`;
  if (command instanceof HeadObjectCommand) return `${input.VersionId ? 's3:GetObjectVersion' : 's3:GetObject'} ${object}`;
  if (command instanceof GetObjectCommand) return `${input.VersionId ? 's3:GetObjectVersion' : 's3:GetObject'} ${object}`;
  if (command instanceof DeleteObjectCommand) return `${input.VersionId ? 's3:DeleteObjectVersion' : 's3:DeleteObject'} ${object}`;
  throw new Error(`unexpected S3 command ${(command as object).constructor.name}`);
}

describe('Corporate KYC S3 permission surface (fake client, synthetic bytes)', () => {
  it('upload, version-pinned view and failed-upload cleanup touch only onboarding-documents/* and need exactly the documented actions', async () => {
    const h = recordingHarness(ONBOARDING_DOCUMENTS_CAPABILITY_PROBE_PREFIX);
    const documentId = randomUUID();
    const objectKey = `${CORPORATE_KYC_OBJECT_PREFIX}${documentId}`;
    const bytes = Buffer.from('%PDF-1.7\nsynthetic\n%%EOF\n');
    const versionId = await h.storage.putDocumentObject({
      documentId, objectKey, bytes, contentType: 'application/pdf',
      checksumSha256Hex: createHash('sha256').update(bytes).digest('hex'),
    });
    const grant = await h.storage.createViewAuthorization({ objectKey, versionId, filename: 'memart-v1.pdf', expiresInSeconds: 60 });
    await h.storage.deleteObjectVersion(objectKey, versionId);

    const all = [...h.sent, ...h.presigned];
    const permissions = new Set(all.map(requiredPermission).map((entry) =>
      entry.replace(/onboarding-documents\/_capability-probe\/[0-9a-f-]{36}$/, 'onboarding-documents/_capability-probe/*')
        .replace(/onboarding-documents\/[0-9a-f-]{36}$/, 'onboarding-documents/*')));
    expect([...permissions].sort()).toEqual([
      `s3:DeleteObjectVersion arn:aws:s3:::${PROD_BUCKET}/onboarding-documents/*`,
      `s3:DeleteObjectVersion arn:aws:s3:::${PROD_BUCKET}/onboarding-documents/_capability-probe/*`,
      `s3:GetBucketVersioning arn:aws:s3:::${PROD_BUCKET}`,
      `s3:GetObject arn:aws:s3:::${PROD_BUCKET}/onboarding-documents/_capability-probe/*`,
      `s3:GetObjectVersion arn:aws:s3:::${PROD_BUCKET}/onboarding-documents/*`,
      `s3:PutObject arn:aws:s3:::${PROD_BUCKET}/onboarding-documents/*`,
      `s3:PutObject arn:aws:s3:::${PROD_BUCKET}/onboarding-documents/_capability-probe/*`,
    ].sort());

    // Every object operation stays under onboarding-documents/; no listing, no unversioned delete.
    for (const command of all) {
      const key = (command as { input: { Key?: string } }).input.Key;
      if (key !== undefined) expect(key.startsWith(CORPORATE_KYC_OBJECT_PREFIX)).toBe(true);
      expect(requiredPermission(command)).not.toMatch(/s3:DeleteObject |s3:ListBucket/);
    }

    // Upload is conditional, SSE-S3 encrypted and checksummed; view is version-pinned, 60 s, attachment.
    const put = h.sent.find((command) => command instanceof PutObjectCommand) as PutObjectCommand;
    expect(put.input).toMatchObject({ Key: objectKey, IfNoneMatch: '*', ServerSideEncryption: 'AES256' });
    expect(put.input.ChecksumSHA256).toBe(createHash('sha256').update(bytes).digest('base64'));
    const view = h.presigned.find((command) => command instanceof GetObjectCommand) as GetObjectCommand;
    expect(view.input).toMatchObject({ Key: objectKey, VersionId: 'doc-v1', ResponseContentType: 'application/octet-stream' });
    expect(view.input.ResponseContentDisposition).toMatch(/^attachment;/);
    expect(grant.expiresAt.getTime() - Date.now()).toBeLessThanOrEqual(60_000);
    const cleanup = h.sent.filter((command) => command instanceof DeleteObjectCommand).at(-1) as DeleteObjectCommand;
    expect(cleanup.input).toEqual({ Bucket: PROD_BUCKET, Key: objectKey, VersionId: 'doc-v1' });
  });

  it('leaves the Individual KYC adapter instance on its original probe prefix (default unchanged)', async () => {
    const h = recordingHarness();
    await h.storage.probeProviderCapabilities();
    const keys = h.presigned.map((command) => (command as PutObjectCommand).input.Key);
    expect(keys).toHaveLength(1);
    expect(keys[0]!.startsWith(INDIVIDUAL_KYC_CAPABILITY_PROBE_PREFIX)).toBe(true);
  });

  it('rejects any probe prefix outside the two allow-listed values', () => {
    expect(() => new S3CompatibleIndividualKycDocumentStorage({
      enabled: true, endpoint: 'https://s3.eu-west-1.amazonaws.com', bucket: PROD_BUCKET, region: PROD_REGION,
      credentialReference: 'workload-identity', forcePathStyle: false,
      residencyApproved: true, privateBucketApproved: true, tlsPolicyApproved: true,
      capabilityProbePrefix: 'customer-data/' as never,
    })).toThrow(ServiceUnavailableException);
  });
});
