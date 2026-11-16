import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import {
  DeleteObjectCommand, GetBucketVersioningCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AwsCredentialIdentityProvider } from '@aws-sdk/types';
import { createHash, randomUUID } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { IndividualKycDocumentStorage, IndividualKycObjectMetadata, IndividualKycUploadIntent, IndividualKycViewAuthorization, INDIVIDUAL_KYC_UPLOAD_HEADERS, INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS, MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES } from './individual-kyc-document-ports';

export interface IndividualKycS3Config {
  readonly enabled: boolean;
  readonly endpoint?: string;
  readonly bucket?: string;
  readonly region?: string;
  readonly credentialReference?: string;
  readonly forcePathStyle: boolean;
  readonly residencyApproved: boolean;
  readonly privateBucketApproved: boolean;
  readonly tlsPolicyApproved: boolean;
  readonly isVercel?: boolean;
  readonly roleArn?: string;
}

export type S3CredentialProvider = AwsCredentialIdentityProvider;
export type S3Presigner = typeof getSignedUrl;
export type FetchLike = typeof fetch;

type CapabilityCheckStage =
  | 'credential_acquisition_oidc'
  | 'bucket_versioning'
  | 'signed_put'
  | 'metadata_head'
  | 'replay_protection'
  | 'cleanup';

const capabilityLogger = new Logger('S3CompatibleIndividualKycDocumentStorage');
const reportedCapabilityErrors = new WeakSet<object>();

function safeDiagnosticValue(value: unknown, maxLength = 128): string | undefined {
  if (typeof value !== 'string' || value.length > maxLength || !/^[A-Za-z0-9._:-]+$/.test(value)) return undefined;
  return value;
}

function safeRequestId(value: unknown): string | undefined {
  if (typeof value !== 'string' || value.length > 512 || !/^[A-Za-z0-9._:/+=-]+$/.test(value)) return undefined;
  return value;
}

function logCapabilityCheckFailure(
  stage: CapabilityCheckStage,
  error?: unknown,
  response?: { readonly status?: number; readonly requestId?: string; readonly awsErrorName?: string },
): void {
  if (error && typeof error === 'object') {
    if (reportedCapabilityErrors.has(error)) return;
    reportedCapabilityErrors.add(error);
  }
  const candidate = error && typeof error === 'object' ? error as {
    name?: unknown;
    $metadata?: { httpStatusCode?: unknown; requestId?: unknown; extendedRequestId?: unknown };
  } : undefined;
  const metadata = candidate?.$metadata;
  const awsErrorName = safeDiagnosticValue(response?.awsErrorName, 80) ?? safeDiagnosticValue(candidate?.name, 80);
  const statusValue = response?.status ?? metadata?.httpStatusCode;
  const httpStatus = typeof statusValue === 'number' && Number.isInteger(statusValue) && statusValue >= 100 && statusValue <= 599
    ? statusValue : undefined;
  const requestId = safeRequestId(response?.requestId)
    ?? safeRequestId(metadata?.requestId)
    ?? safeRequestId(metadata?.extendedRequestId);
  capabilityLogger.warn(JSON.stringify({
    stage,
    ...(awsErrorName ? { awsErrorName } : {}),
    ...(httpStatus !== undefined ? { httpStatus } : {}),
    ...(requestId ? { requestId } : {}),
  }));
}

function responseDiagnostics(response: Response): { status: number; requestId?: string; awsErrorName?: string } {
  return {
    status: response.status,
    requestId: response.headers.get('x-amz-request-id') ?? response.headers.get('x-amz-id-2') ?? undefined,
    awsErrorName: response.headers.get('x-amz-error-code') ?? undefined,
  };
}

function disabled(): ServiceUnavailableException {
  return new ServiceUnavailableException({ code: 'FEATURE_UNAVAILABLE', message: 'Private KYC object storage is not enabled or its provider capability checks have not passed.' });
}

/**
 * Resolve a credential *reference*, never credentials from application config.
 * Nigerian S3 vendors can mount a rotated provider credential file in /run/secrets;
 * AWS-hosted deployments may use their workload identity chain. Long-lived AWS
 * access-key environment variables are rejected by startup configuration.
 */
export function credentialProviderFromReference(
  reference: string,
  options: { readonly isVercel?: boolean; readonly roleArn?: string } = {},
): S3CredentialProvider {
  if (reference === 'workload-identity') {
    if (options.isVercel) {
      if (!options.roleArn) return async () => { throw disabled(); };
      let provider: S3CredentialProvider | undefined;
      return async () => {
        try {
          provider ??= (await import('@vercel/oidc-aws-credentials-provider')).awsCredentialsProvider({ roleArn: options.roleArn! });
          return provider();
        } catch (error) { throw error; }
      };
    }
    if (process.env.AWS_ACCESS_KEY_ID || process.env.AWS_SECRET_ACCESS_KEY) throw disabled();
    return defaultProvider();
  }
  const match = /^file:(\/run\/secrets\/[A-Za-z0-9._/-]{1,160})$/.exec(reference);
  if (!match || match[1].includes('..')) throw disabled();
  const path = match[1];
  return async () => {
    const fileStat = await stat(path);
    if (!fileStat.isFile() || (fileStat.mode & 0o077) !== 0) throw disabled();
    const parsed: unknown = JSON.parse(await readFile(path, 'utf8'));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw disabled();
    const value = parsed as Record<string, unknown>;
    if (typeof value.accessKeyId !== 'string' || value.accessKeyId.length < 8 ||
        typeof value.secretAccessKey !== 'string' || value.secretAccessKey.length < 16 ||
        (value.sessionToken !== undefined && typeof value.sessionToken !== 'string')) throw disabled();
    return {
      accessKeyId: value.accessKeyId,
      secretAccessKey: value.secretAccessKey,
      ...(typeof value.sessionToken === 'string' ? { sessionToken: value.sessionToken } : {}),
    };
  };
}

/**
 * Configurable S3-compatible private document adapter. Customer-facing KYC uploads
 * use short-lived conditional PUT grants and HEAD-only completion. A version-pinned
 * attachment grant is available only after staff authorization; internal read/write
 * methods support shared application documents and optional future worker plumbing.
 * Every provider must pass a live conditional-write/replay probe before use.
 */
@Injectable()
export class S3CompatibleIndividualKycDocumentStorage implements IndividualKycDocumentStorage {
  private readonly client: S3Client;
  private readonly bucket: string;
  private capabilityCheck?: Promise<void>;

  constructor(
    private readonly config: IndividualKycS3Config,
    client?: S3Client,
    private readonly presigner: S3Presigner = getSignedUrl,
    private readonly fetcher: FetchLike = fetch,
  ) {
    if (!config.enabled || !config.endpoint || !config.bucket || !config.region || !config.credentialReference ||
      !config.residencyApproved || !config.privateBucketApproved || !config.tlsPolicyApproved) throw disabled();
    const endpoint = new URL(config.endpoint);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw disabled();
    this.bucket = config.bucket;
    const credentialProvider = credentialProviderFromReference(config.credentialReference, { isVercel: config.isVercel, roleArn: config.roleArn });
    this.client = client ?? new S3Client({
      region: config.region,
      endpoint: endpoint.toString(),
      forcePathStyle: config.forcePathStyle,
      credentials: async () => {
        try {
          return await credentialProvider();
        } catch (error) {
          logCapabilityCheckFailure('credential_acquisition_oidc', error);
          throw error;
        }
      },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 2,
    });
  }

  async createUploadIntent(input: {
    readonly documentId: string;
    readonly objectKey: string;
    readonly contentType: string;
    readonly sizeBytes: number;
    readonly checksumSha256: string;
    readonly expiresInSeconds: number;
  }): Promise<IndividualKycUploadIntent> {
    if (input.sizeBytes < 1 || input.sizeBytes > MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES ||
        input.expiresInSeconds !== INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS ||
        !/^[A-Za-z0-9+/]{43}=$/.test(input.checksumSha256)) throw disabled();
    await this.ensureProviderCapabilities();
    const command = this.putCommand(input, input.objectKey);
    const issuedAt = Date.now();
    const uploadUrl = await this.presigner(this.client, command, {
      expiresIn: INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS,
      signableHeaders: new Set(INDIVIDUAL_KYC_UPLOAD_HEADERS),
    });
    const parsed = new URL(uploadUrl);
    if (parsed.protocol !== 'https:' || !parsed.searchParams.get('X-Amz-Signature') || !parsed.searchParams.get('X-Amz-Expires')) throw disabled();
    return {
      uploadUrl,
      expiresAt: new Date(issuedAt + INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS * 1000),
      signedContentLength: input.sizeBytes,
      requiredHeaders: {
        'content-type': input.contentType,
        'if-none-match': '*',
        'x-amz-checksum-sha256': input.checksumSha256,
        'x-amz-server-side-encryption': 'AES256',
        'x-amz-meta-kyc-document-id': input.documentId,
      },
    };
  }

  async headQuarantined(objectKey: string): Promise<IndividualKycObjectMetadata | null> {
    await this.ensureProviderCapabilities();
    try {
      const result = await this.client.send(new HeadObjectCommand({
        Bucket: this.bucket,
        Key: objectKey,
        ChecksumMode: 'ENABLED',
      }));
      return {
        versionId: result.VersionId ?? null,
        sizeBytes: Number(result.ContentLength ?? -1),
        contentType: result.ContentType ?? null,
        checksumSha256: result.ChecksumSHA256 ?? null,
        documentIdMetadata: result.Metadata?.['kyc-document-id'] ?? null,
        serverSideEncryption: result.ServerSideEncryption ?? null,
        etag: result.ETag ?? null,
      };
    } catch (error) {
      const candidate = error as { name?: string; $metadata?: { httpStatusCode?: number } };
      if (candidate.name === 'NotFound' || candidate.name === 'NoSuchKey' || candidate.$metadata?.httpStatusCode === 404) return null;
      throw disabled();
    }
  }

  async createViewAuthorization(input: { objectKey: string; versionId: string; filename: string; expiresInSeconds: number }): Promise<IndividualKycViewAuthorization> {
    if (!input.objectKey || input.objectKey.length > 256 || !input.versionId || input.versionId.length > 256 ||
      !Number.isInteger(input.expiresInSeconds) || input.expiresInSeconds < 1 || input.expiresInSeconds > 60) throw disabled();
    await this.ensureProviderCapabilities();
    const safeFilename = sanitizeDownloadFilename(input.filename);
    try {
      const url = await this.presigner(this.client, new GetObjectCommand({
        Bucket: this.bucket,
        Key: input.objectKey,
        VersionId: input.versionId,
        ResponseContentType: 'application/octet-stream',
        ResponseContentDisposition: `attachment; filename="${safeFilename}"`,
        ResponseCacheControl: 'private, no-store, max-age=0',
      }), { expiresIn: input.expiresInSeconds });
      const parsed = new URL(url);
      if (parsed.protocol !== 'https:' || !parsed.searchParams.get('X-Amz-Signature')) throw disabled();
      return { viewUrl: url, expiresAt: new Date(Date.now() + input.expiresInSeconds * 1000), disposition: 'attachment' };
    } catch { throw disabled(); }
  }

  async putDocumentObject(input: { documentId: string; objectKey: string; bytes: Buffer; contentType: string; checksumSha256Hex: string }): Promise<string> {
    if (!/^[0-9a-f-]{36}$/i.test(input.documentId) || !/^onboarding-documents\/[0-9a-f-]{36}$/i.test(input.objectKey) ||
      !Buffer.isBuffer(input.bytes) || input.bytes.length < 1 || input.bytes.length > 25 * 1024 * 1024 ||
      !/^[A-Za-z0-9!#$&^_.+-]+\/[A-Za-z0-9!#$&^_.+-]+$/.test(input.contentType) || !/^[0-9a-f]{64}$/.test(input.checksumSha256Hex) ||
      createHash('sha256').update(input.bytes).digest('hex') !== input.checksumSha256Hex) throw disabled();
    await this.ensureProviderCapabilities();
    try {
      const result = await this.client.send(new PutObjectCommand({
        Bucket: this.bucket, Key: input.objectKey, Body: input.bytes, ContentType: input.contentType,
        ContentLength: input.bytes.length, ChecksumSHA256: createHash('sha256').update(input.bytes).digest('base64'),
        IfNoneMatch: '*', ServerSideEncryption: 'AES256', Metadata: { 'kyc-document-id': input.documentId },
      }));
      if (!result.VersionId || result.VersionId.length > 256) throw disabled();
      return result.VersionId;
    } catch { throw disabled(); }
  }

  async readDocumentObject(objectKey: string, versionId: string): Promise<Buffer> {
    if (!/^onboarding-documents\/[0-9a-f-]{36}$/i.test(objectKey) || !versionId || versionId.length > 256) throw disabled();
    await this.ensureProviderCapabilities();
    try {
      const result = await this.client.send(new GetObjectCommand({ Bucket: this.bucket, Key: objectKey, VersionId: versionId }));
      if (!result.Body) throw disabled();
      const bytes = Buffer.from(await result.Body.transformToByteArray());
      if (bytes.length > 25 * 1024 * 1024) { bytes.fill(0); throw disabled(); }
      return bytes;
    } catch { throw disabled(); }
  }

  async deleteObjectVersion(objectKey: string, versionId: string): Promise<void> {
    if (!versionId || versionId.length > 256) throw disabled();
    await this.ensureProviderCapabilities();
    try {
      await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: objectKey, VersionId: versionId }));
    } catch {
      throw disabled();
    }
  }

  /** Public for deployment capability tests; uses synthetic bytes and a random scratch key only. */
  async probeProviderCapabilities(): Promise<void> {
    const versioning = await this.runCapabilityCheck('bucket_versioning', () =>
      this.client.send(new GetBucketVersioningCommand({ Bucket: this.bucket })));
    if (versioning.Status !== 'Enabled') this.failCapabilityCheck('bucket_versioning');
    const key = `individual-kyc/_capability-probe/${randomUUID()}`;
    const documentId = randomUUID();
    const bytes = Buffer.from('%PDF-1.7\nsynthetic-storage-capability-probe\n');
    const checksum = createHash('sha256').update(bytes).digest('base64');
    const input = {
      documentId,
      objectKey: key,
      contentType: 'application/pdf',
      sizeBytes: bytes.length,
      checksumSha256: checksum,
      expiresInSeconds: INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS,
    } as const;
    const command = this.putCommand(input, key);
    const url = await this.runCapabilityCheck('signed_put', () => this.presigner(this.client, command, {
      expiresIn: INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS,
      signableHeaders: new Set(INDIVIDUAL_KYC_UPLOAD_HEADERS),
    }));
    const headers = {
      'content-type': input.contentType,
      'content-length': String(bytes.length),
      'if-none-match': '*',
      'x-amz-checksum-sha256': checksum,
      'x-amz-server-side-encryption': 'AES256',
      'x-amz-meta-kyc-document-id': documentId,
    };
    let firstVersionId: string | undefined;
    let duplicateVersionId: string | undefined;
    try {
      const first = await this.runCapabilityCheck('signed_put', () =>
        this.fetcher(url, { method: 'PUT', headers, body: bytes as unknown as BodyInit, redirect: 'error' }));
      firstVersionId = first.headers.get('x-amz-version-id') ?? undefined;
      if (!first.ok || !firstVersionId) {
        this.failCapabilityCheck('signed_put', undefined, responseDiagnostics(first));
      }
      const head = await this.runCapabilityCheck('metadata_head', () =>
        this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key, ChecksumMode: 'ENABLED' })));
      if (head.VersionId !== firstVersionId || Number(head.ContentLength) !== bytes.length ||
          head.ContentType !== input.contentType || head.ChecksumSHA256 !== checksum ||
          head.Metadata?.['kyc-document-id'] !== documentId || head.ServerSideEncryption !== 'AES256') {
        this.failCapabilityCheck('metadata_head');
      }
      const replay = await this.runCapabilityCheck('replay_protection', () =>
        this.fetcher(url, { method: 'PUT', headers, body: bytes as unknown as BodyInit, redirect: 'error' }));
      duplicateVersionId = replay.headers.get('x-amz-version-id') ?? undefined;
      if (replay.ok || ![409, 412].includes(replay.status)) {
        this.failCapabilityCheck('replay_protection', undefined, responseDiagnostics(replay));
      }
      const afterReplay = await this.runCapabilityCheck('replay_protection', () =>
        this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key, ChecksumMode: 'ENABLED' })));
      if (afterReplay.VersionId !== firstVersionId || afterReplay.ChecksumSHA256 !== checksum) {
        this.failCapabilityCheck('replay_protection');
      }
    } finally {
      // A provider that accepted the replay may have created a second version;
      // clean only these synthetic probe versions, never list a customer bucket.
      if (duplicateVersionId && duplicateVersionId !== firstVersionId) {
        await this.runCapabilityCheck('cleanup', () =>
          this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key, VersionId: duplicateVersionId! })))
          .catch(() => undefined);
      }
      if (firstVersionId) {
        await this.runCapabilityCheck('cleanup', () =>
          this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key, VersionId: firstVersionId! })))
          .catch(() => undefined);
      }
    }
  }

  private async runCapabilityCheck<T>(stage: CapabilityCheckStage, operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      logCapabilityCheckFailure(stage, error);
      throw error;
    }
  }

  private failCapabilityCheck(
    stage: CapabilityCheckStage,
    error?: unknown,
    response?: { readonly status?: number; readonly requestId?: string; readonly awsErrorName?: string },
  ): never {
    logCapabilityCheckFailure(stage, error, response);
    throw disabled();
  }

  private async ensureProviderCapabilities(): Promise<void> {
    this.capabilityCheck ??= this.probeProviderCapabilities().catch(() => { throw disabled(); });
    await this.capabilityCheck;
  }

  private putCommand(input: {
    readonly documentId: string;
    readonly objectKey: string;
    readonly contentType: string;
    readonly sizeBytes: number;
    readonly checksumSha256: string;
    readonly expiresInSeconds: number;
  }, objectKey: string): PutObjectCommand {
    return new PutObjectCommand({
      Bucket: this.bucket,
      Key: objectKey,
      ContentType: input.contentType,
      ContentLength: input.sizeBytes,
      ChecksumSHA256: input.checksumSha256,
      IfNoneMatch: '*',
      ServerSideEncryption: 'AES256',
      Metadata: { 'kyc-document-id': input.documentId },
    });
  }
}

function sanitizeDownloadFilename(value: string): string {
  const cleaned = Array.from(value.normalize('NFKC')).filter((character) => {
    const code = character.codePointAt(0) ?? 0;
    return code >= 0x20 && !(code >= 0x7f && code <= 0x9f) && !/[\\/";\r\n]/.test(character);
  }).join('');
  return cleaned.slice(0, 96) || 'review-document.bin';
}
