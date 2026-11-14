import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  DeleteObjectCommand, GetBucketVersioningCommand, HeadObjectCommand, PutObjectCommand, S3Client,
} from '@aws-sdk/client-s3';
import { defaultProvider } from '@aws-sdk/credential-provider-node';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { AwsCredentialIdentityProvider } from '@aws-sdk/types';
import { createHash, randomUUID } from 'crypto';
import { readFile, stat } from 'fs/promises';
import { IndividualKycDocumentStorage, IndividualKycObjectMetadata, IndividualKycUploadIntent, INDIVIDUAL_KYC_UPLOAD_HEADERS, INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS, MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES } from './individual-kyc-document-ports';

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
        } catch { throw disabled(); }
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
 * Configurable S3-compatible private quarantine adapter. API process can PUT-sign,
 * HEAD metadata, and delete pinned versions; it deliberately has no GetObject.
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
    this.client = client ?? new S3Client({
      region: config.region,
      endpoint: endpoint.toString(),
      forcePathStyle: config.forcePathStyle,
      credentials: credentialProviderFromReference(config.credentialReference, { isVercel: config.isVercel, roleArn: config.roleArn }),
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
    const versioning = await this.client.send(new GetBucketVersioningCommand({ Bucket: this.bucket }));
    if (versioning.Status !== 'Enabled') throw disabled();
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
    const url = await this.presigner(this.client, command, {
      expiresIn: INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS,
      signableHeaders: new Set(INDIVIDUAL_KYC_UPLOAD_HEADERS),
    });
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
      const first = await this.fetcher(url, { method: 'PUT', headers, body: bytes as unknown as BodyInit, redirect: 'error' });
      firstVersionId = first.headers.get('x-amz-version-id') ?? undefined;
      if (!first.ok || !firstVersionId) throw disabled();
      const head = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key, ChecksumMode: 'ENABLED' }));
      if (head.VersionId !== firstVersionId || Number(head.ContentLength) !== bytes.length ||
          head.ContentType !== input.contentType || head.ChecksumSHA256 !== checksum ||
          head.Metadata?.['kyc-document-id'] !== documentId || head.ServerSideEncryption !== 'AES256') throw disabled();
      const replay = await this.fetcher(url, { method: 'PUT', headers, body: bytes as unknown as BodyInit, redirect: 'error' });
      duplicateVersionId = replay.headers.get('x-amz-version-id') ?? undefined;
      if (replay.ok || ![409, 412].includes(replay.status)) throw disabled();
      const afterReplay = await this.client.send(new HeadObjectCommand({ Bucket: this.bucket, Key: key, ChecksumMode: 'ENABLED' }));
      if (afterReplay.VersionId !== firstVersionId || afterReplay.ChecksumSHA256 !== checksum) throw disabled();
    } finally {
      // A provider that accepted the replay may have created a second version;
      // clean only these synthetic probe versions, never list a customer bucket.
      if (duplicateVersionId && duplicateVersionId !== firstVersionId) {
        await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key, VersionId: duplicateVersionId })).catch(() => undefined);
      }
      if (firstVersionId) await this.client.send(new DeleteObjectCommand({ Bucket: this.bucket, Key: key, VersionId: firstVersionId })).catch(() => undefined);
    }
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
