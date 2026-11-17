import { GetObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { createHash } from 'crypto';
import { IndividualKycScanJob } from './worker-types';
import { credentialProviderFromReference } from '../modules/individual-kyc/individual-kyc-s3-storage';
import { MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES } from '../modules/individual-kyc/individual-kyc-document-ports';

export interface ScannedObjectBytes {
  readonly bytes: Buffer;
  readonly sha256Base64: string;
}

/** Worker-only GetObject adapter. Never imported by the Nest/Vercel API module. */
export class NigerianKycScanObjectReader {
  private readonly client: S3Client;
  private readonly bucket: string;

  constructor(config: {
    endpoint: string;
    bucket: string;
    region: string;
    credentialReference: string;
    forcePathStyle: boolean;
  }, client?: S3Client) {
    const endpoint = new URL(config.endpoint);
    if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash) throw new Error('Scanner storage endpoint must be explicit HTTPS.');
    this.bucket = config.bucket;
    this.client = client ?? new S3Client({
      endpoint: endpoint.toString(), region: config.region, forcePathStyle: config.forcePathStyle,
      credentials: credentialProviderFromReference(config.credentialReference),
      requestChecksumCalculation: 'WHEN_REQUIRED', responseChecksumValidation: 'WHEN_REQUIRED', maxAttempts: 2,
    });
  }

  async readExactVersion(job: IndividualKycScanJob): Promise<ScannedObjectBytes> {
    if (!job.objectVersionId || !job.objectKey.startsWith('individual-kyc/quarantine/') ||
        job.sizeBytes < 1 || job.sizeBytes > MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES) throw new Error('Invalid scan job object reference.');
    const result = await this.client.send(new GetObjectCommand({
      Bucket: this.bucket,
      Key: job.objectKey,
      VersionId: job.objectVersionId,
      ChecksumMode: 'ENABLED',
    }));
    const body = result.Body as (AsyncIterable<Uint8Array> & { destroy?: () => void }) | undefined;
    if (!body || result.VersionId !== job.objectVersionId || Number(result.ContentLength) !== job.sizeBytes ||
        result.ContentType !== job.contentType || result.Metadata?.['kyc-document-id'] !== job.documentId ||
        result.ServerSideEncryption !== 'AES256' ||
        (result.ChecksumSHA256 !== undefined && result.ChecksumSHA256 !== job.checksumSha256)) {
      body?.destroy?.();
      throw new Error('Stored object metadata did not match scan job.');
    }
    const chunks: Buffer[] = [];
    let length = 0;
    try {
      for await (const chunk of body) {
        const bytes = Buffer.from(chunk);
        length += bytes.length;
        if (length > MAX_INDIVIDUAL_KYC_DOCUMENT_BYTES || length > job.sizeBytes) {
          body.destroy?.();
          throw new Error('Stored object exceeds approved size.');
        }
        chunks.push(bytes);
      }
    } catch (error) {
      for (const chunk of chunks) chunk.fill(0);
      throw error;
    }
    const bytes = Buffer.concat(chunks, length);
    for (const chunk of chunks) chunk.fill(0);
    if (length !== job.sizeBytes) { bytes.fill(0); throw new Error('Stored object size mismatch.'); }
    const sha256Base64 = createHash('sha256').update(bytes).digest('base64');
    return { bytes, sha256Base64 };
  }
}
