import { Injectable, ServiceUnavailableException } from '@nestjs/common';

export const INDIVIDUAL_KYC_DOCUMENT_STORAGE = Symbol('INDIVIDUAL_KYC_DOCUMENT_STORAGE');
export const MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS = 300;
export const INDIVIDUAL_KYC_UPLOAD_HEADERS = [
  'content-type',
  'content-length',
  'if-none-match',
  'x-amz-checksum-sha256',
  'x-amz-server-side-encryption',
  'x-amz-meta-kyc-document-id',
] as const;

export interface IndividualKycUploadIntent {
  readonly uploadUrl: string;
  readonly expiresAt: Date;
  /** Exact JavaScript-settable headers included in the SigV4 signature; browser must send these unchanged. */
  readonly requiredHeaders: Readonly<Record<string, string>>;
  /** Content-Length is signed, but browsers set it from the File body and forbid JavaScript from setting it. */
  readonly signedContentLength: number;
}

/** Metadata-only projection. This port intentionally has no object-byte read method. */
export interface IndividualKycObjectMetadata {
  readonly versionId: string | null;
  readonly sizeBytes: number;
  readonly contentType: string | null;
  readonly checksumSha256: string | null;
  readonly documentIdMetadata: string | null;
  readonly serverSideEncryption: string | null;
  readonly etag: string | null;
}

/** API-process storage port. Implementations must never return raw document bytes. */
export interface IndividualKycDocumentStorage {
  createUploadIntent(input: {
    readonly documentId: string;
    readonly objectKey: string;
    readonly contentType: string;
    readonly sizeBytes: number;
    readonly checksumSha256: string;
    readonly expiresInSeconds: number;
  }): Promise<IndividualKycUploadIntent>;
  headQuarantined(objectKey: string): Promise<IndividualKycObjectMetadata | null>;
  deleteObjectVersion(objectKey: string, versionId: string): Promise<void>;
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'FEATURE_UNAVAILABLE',
    message: 'Individual KYC document upload is disabled pending approved Nigerian storage and scanner configuration.',
  });
}

/** Production binding while any storage, scanner, residency, retention or provider capability gate is closed. */
@Injectable()
export class DisabledIndividualKycDocumentStorage implements IndividualKycDocumentStorage {
  async createUploadIntent(): Promise<IndividualKycUploadIntent> { throw unavailable(); }
  async headQuarantined(): Promise<IndividualKycObjectMetadata | null> { throw unavailable(); }
  async deleteObjectVersion(): Promise<void> { throw unavailable(); }
}

export interface TestStoredObject {
  readonly bytes: Buffer;
  readonly metadata: IndividualKycObjectMetadata;
}

/** Isolated in-memory fixture. It is never registered in a production module. */
export class IsolatedMemoryIndividualKycDocumentStorage implements IndividualKycDocumentStorage {
  private readonly objects = new Map<string, TestStoredObject>();
  private readonly intents = new Map<string, {
    documentId: string;
    objectKey: string;
    sizeBytes: number;
    contentType: string;
    checksumSha256: string;
    expiresAt: number;
  }>();

  constructor(private readonly nodeEnv: string) {
    if (nodeEnv !== 'test') throw new Error('In-memory Individual KYC storage is test-only.');
  }

  async createUploadIntent(input: {
    readonly documentId: string;
    readonly objectKey: string;
    readonly contentType: string;
    readonly sizeBytes: number;
    readonly checksumSha256: string;
    readonly expiresInSeconds: number;
  }): Promise<IndividualKycUploadIntent> {
    this.assertTest();
    if (input.sizeBytes < 1 || input.sizeBytes > MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES || input.expiresInSeconds !== INDIVIDUAL_KYC_UPLOAD_URL_TTL_SECONDS) throw unavailable();
    const token = `${this.intents.size + 1}-${input.documentId}`;
    const uploadUrl = `https://individual-kyc-upload.invalid/${encodeURIComponent(token)}`;
    const expiresAt = new Date(Date.now() + input.expiresInSeconds * 1000);
    this.intents.set(uploadUrl, { ...input, expiresAt: expiresAt.getTime() });
    return {
      uploadUrl,
      expiresAt,
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

  /** Test-only simulation of a direct browser PUT; a signed capability is consumed once. */
  stageUpload(uploadUrl: string, bytes: Buffer, contentType: string, checksumSha256: string): string {
    this.assertTest();
    const intent = this.intents.get(uploadUrl);
    if (!intent || intent.expiresAt <= Date.now() || this.objects.has(intent.objectKey) ||
      bytes.length !== intent.sizeBytes || bytes.length > MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES ||
      contentType !== intent.contentType || checksumSha256 !== intent.checksumSha256) throw unavailable();
    const versionId = `test-version-${this.objects.size + 1}`;
    const storedBytes = Buffer.from(bytes);
    this.objects.set(intent.objectKey, {
      bytes: storedBytes,
      metadata: {
        versionId,
        sizeBytes: storedBytes.length,
        contentType,
        checksumSha256,
        documentIdMetadata: intent.documentId,
        serverSideEncryption: 'AES256',
        etag: `"test-etag-${versionId}"`,
      },
    });
    return versionId;
  }

  async headQuarantined(objectKey: string): Promise<IndividualKycObjectMetadata | null> {
    this.assertTest();
    const object = this.objects.get(objectKey);
    return object ? { ...object.metadata } : null;
  }

  /** Worker-only test helper; not exposed by the production API storage port. */
  readTestVersion(objectKey: string, versionId: string): Buffer | null {
    this.assertTest();
    const object = this.objects.get(objectKey);
    if (!object || object.metadata.versionId !== versionId) return null;
    return Buffer.from(object.bytes);
  }

  async deleteObjectVersion(objectKey: string, versionId: string): Promise<void> {
    this.assertTest();
    const object = this.objects.get(objectKey);
    if (!object || object.metadata.versionId !== versionId) return;
    object.bytes.fill(0);
    this.objects.delete(objectKey);
  }

  private assertTest(): void {
    if (this.nodeEnv !== 'test') throw unavailable();
  }
}
