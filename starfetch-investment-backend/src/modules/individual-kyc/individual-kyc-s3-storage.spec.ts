import { Logger, ServiceUnavailableException } from '@nestjs/common';
import { DeleteObjectCommand, GetBucketVersioningCommand, GetObjectCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { S3CompatibleIndividualKycDocumentStorage } from './individual-kyc-s3-storage';

const key = 'individual-kyc/quarantine/1e52bf47-28b3-4702-a80d-622359b4f0d7';
const documentId = 'c00b2873-a2d5-4cc1-973a-9eb41c1ee8cd';
const bytes = Buffer.from('%PDF-1.7 synthetic');
const checksum = 'UnobBJWHNhUdLb3S/VXx0SNsEu3TvEIibN5uLmnHOLw=';
const config = {
  enabled: true, endpoint: 'https://s3.example.invalid', bucket: 'synthetic-kyc-bucket', region: 'test-signing-region',
  credentialReference: 'workload-identity', forcePathStyle: true,
  residencyApproved: true, privateBucketApproved: true, tlsPolicyApproved: true,
};

function response(status: number, version?: string): Response {
  return new Response('', { status, headers: version ? { 'x-amz-version-id': version } : undefined });
}

function harness(secondStatus = 412, versioning = 'Enabled') {
  const presignerArgs: any[][] = [];
  const send = jest.fn(async (command: any) => {
    if (command instanceof GetBucketVersioningCommand) return { Status: versioning };
    if (command instanceof HeadObjectCommand) {
      if (command.input.Key === key) return {
        VersionId: 'v1', ContentLength: bytes.length, ContentType: 'application/pdf',
        ChecksumSHA256: checksum, Metadata: { 'kyc-document-id': documentId },
        ServerSideEncryption: 'AES256', ETag: 'synthetic-etag',
      };
      const input = presignerArgs[0]?.[1]?.input ?? {};
      return {
        VersionId: 'v1', ContentLength: input.ContentLength, ContentType: input.ContentType,
        ChecksumSHA256: input.ChecksumSHA256, Metadata: input.Metadata,
        ServerSideEncryption: input.ServerSideEncryption, ETag: 'synthetic-probe-etag',
      };
    }
    if (command instanceof DeleteObjectCommand) return {};
    return {};
  });
  const client = { send } as unknown as S3Client;
  const presigner = jest.fn(async (...args: any[]) => {
    presignerArgs.push(args);
    return 'https://s3.example.invalid/signed?X-Amz-Signature=synthetic&X-Amz-Expires=300';
  });
  const fetcher = jest.fn()
    .mockResolvedValueOnce(response(200, 'v1'))
    .mockResolvedValueOnce(response(secondStatus, secondStatus === 200 ? 'v2' : undefined));
  const storage = new S3CompatibleIndividualKycDocumentStorage(config, client, presigner as any, fetcher as any);
  return { storage, send, presigner, fetcher };
}

describe('S3-compatible Individual KYC quarantine storage', () => {
  it('probes actual presigned conditional PUT/replay behavior and returns a 5-minute limited PUT capability', async () => {
    const h = harness();
    const intent = await h.storage.createUploadIntent({
      documentId, objectKey: key, contentType: 'application/pdf', sizeBytes: bytes.length,
      checksumSha256: checksum, expiresInSeconds: 300,
    });
    expect(intent.uploadUrl).toMatch(/^https:\/\//);
    expect(intent.expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(intent.signedContentLength).toBe(bytes.length);
    expect(intent.requiredHeaders).toMatchObject({
      'if-none-match': '*', 'x-amz-checksum-sha256': checksum,
      'x-amz-server-side-encryption': 'AES256',
    });
    expect(intent.requiredHeaders).not.toHaveProperty('content-length');
    expect(h.fetcher).toHaveBeenCalledTimes(2);
    expect(h.presigner).toHaveBeenCalledTimes(2); // capability probe + actual authorization
    const presignerCalls = h.presigner.mock.calls as unknown as [unknown, unknown, any][];
    const actualOptions = presignerCalls[1][2];
    expect(actualOptions.expiresIn).toBe(300);
    expect(actualOptions.signableHeaders.has('if-none-match')).toBe(true);
    expect(actualOptions.signableHeaders.has('content-length')).toBe(true);
    const expectedUnhoistable = [
      'x-amz-checksum-sha256',
      'x-amz-server-side-encryption',
      'x-amz-meta-kyc-document-id',
    ].sort();
    for (const [, , options] of presignerCalls) {
      expect([...options.unhoistableHeaders].sort()).toEqual(expectedUnhoistable);
    }
    const deleteCommands = h.send.mock.calls.filter(([command]) => command instanceof DeleteObjectCommand);
    expect(deleteCommands).toHaveLength(1);
    expect((deleteCommands[0][0] as DeleteObjectCommand).input.VersionId).toBe('v1');
  });

  it('generates SigV4 with security headers signed in headers, not hoisted to query parameters', async () => {
    const client = new S3Client({
      endpoint: config.endpoint,
      region: config.region,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: 'synthetic-access-key', secretAccessKey: 'synthetic-secret-key-for-test-only' },
      requestChecksumCalculation: 'WHEN_REQUIRED',
      responseChecksumValidation: 'WHEN_REQUIRED',
      maxAttempts: 1,
    });
    const presignerArgs: any[][] = [];
    const send = jest.fn(async (command: any) => {
      if (command instanceof GetBucketVersioningCommand) return { Status: 'Enabled' };
      if (command instanceof HeadObjectCommand) {
        const input = presignerArgs[0]?.[1]?.input ?? {};
        return {
          VersionId: 'version-1', ContentLength: input.ContentLength, ContentType: input.ContentType,
          ChecksumSHA256: input.ChecksumSHA256, Metadata: input.Metadata,
          ServerSideEncryption: input.ServerSideEncryption,
        };
      }
      if (command instanceof DeleteObjectCommand) return {};
      return {};
    });
    client.send = send as any;
    const presigner = jest.fn(async (...args: any[]) => {
      presignerArgs.push(args);
      return getSignedUrl(args[0], args[1], args[2]);
    });
    const fetcher = jest.fn()
      .mockResolvedValueOnce(response(200, 'version-1'))
      .mockResolvedValueOnce(response(412));
    try {
      const storage = new S3CompatibleIndividualKycDocumentStorage(config, client, presigner as any, fetcher as any);
      const intent = await storage.createUploadIntent({
        documentId, objectKey: key, contentType: 'application/pdf', sizeBytes: bytes.length,
        checksumSha256: checksum, expiresInSeconds: 300,
      });
      const signedUrl = new URL(intent.uploadUrl);
      const signedHeaders = (signedUrl.searchParams.get('X-Amz-SignedHeaders') ?? '').split(';');
      expect(signedHeaders).toEqual(expect.arrayContaining([
        'content-length', 'content-type', 'if-none-match', 'x-amz-checksum-sha256',
        'x-amz-meta-kyc-document-id', 'x-amz-server-side-encryption', 'host',
      ]));
      const queryKeys = [...signedUrl.searchParams.keys()].map((name) => name.toLowerCase());
      expect(queryKeys).not.toContain('x-amz-checksum-sha256');
      expect(queryKeys).not.toContain('x-amz-server-side-encryption');
      expect(queryKeys).not.toContain('x-amz-meta-kyc-document-id');
      expect(signedUrl.pathname).toBe(`/synthetic-kyc-bucket/${key}`);
    } finally {
      client.destroy();
    }
  });

  it('logs only an allowlisted S3 error code and safe request diagnostics for a failed signed PUT', async () => {
    const h = harness();
    h.fetcher.mockReset().mockResolvedValueOnce(new Response(
      '<Error><Code>SignatureDoesNotMatch</Code><Message>body-secret-must-not-be-logged</Message></Error>',
      { status: 403, headers: { 'x-amz-request-id': 'safe-request-id-123' } },
    ));
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      await expect(h.storage.probeProviderCapabilities()).rejects.toBeInstanceOf(ServiceUnavailableException);
      const logged = warning.mock.calls.map(([message]) => String(message)).join('\\n');
      expect(logged).toContain('"stage":"signed_put"');
      expect(logged).toContain('"awsErrorCode":"SignatureDoesNotMatch"');
      expect(logged).toContain('"httpStatus":403');
      expect(logged).toContain('"requestId":"safe-request-id-123"');
      expect(logged).not.toContain('body-secret-must-not-be-logged');
    } finally {
      warning.mockRestore();
    }
  });

  it('fails closed if provider accepts a replay/overwrite', async () => {
    const h = harness(200);
    await expect(h.storage.probeProviderCapabilities()).rejects.toBeInstanceOf(ServiceUnavailableException);
    const deleted = h.send.mock.calls.filter(([command]) => command instanceof DeleteObjectCommand);
    expect(deleted.length).toBeGreaterThanOrEqual(1);
  });

  it('fails closed without bucket versioning', async () => {
    const h = harness(412, 'Suspended');
    await expect(h.storage.probeProviderCapabilities()).rejects.toBeInstanceOf(ServiceUnavailableException);
    expect(h.fetcher).not.toHaveBeenCalled();
  });

  it('does not create an adapter without explicit HTTPS endpoint and approvals', () => {
    expect(() => new S3CompatibleIndividualKycDocumentStorage({ ...config, endpoint: 'http://s3.invalid' })).toThrow(ServiceUnavailableException);
    expect(() => new S3CompatibleIndividualKycDocumentStorage({ ...config, residencyApproved: false })).toThrow(ServiceUnavailableException);
  });

  it('returns metadata only for the customer API; object reads are version-pinned and used only by isolated internal ports', async () => {
    const h = harness();
    await h.storage.createUploadIntent({ documentId, objectKey: key, contentType: 'application/pdf', sizeBytes: bytes.length, checksumSha256: checksum, expiresInSeconds: 300 });
    const metadata = await h.storage.headQuarantined(key);
    expect(metadata).toMatchObject({ versionId: 'v1', sizeBytes: bytes.length, contentType: 'application/pdf', checksumSha256: checksum, documentIdMetadata: documentId, serverSideEncryption: 'AES256' });
    expect((h.storage as any).readQuarantined).toBeUndefined();
    expect(typeof h.storage.readDocumentObject).toBe('function');
  });

  it('creates a short-lived version-pinned attachment authorization for a staff review', async () => {
    const h = harness();
    const view = await h.storage.createViewAuthorization({ objectKey: key, versionId: 'v1', filename: 'review.pdf', expiresInSeconds: 45 });
    expect(view.viewUrl).toMatch(/^https:\/\//);
    expect(view.disposition).toBe('attachment');
    expect(view.expiresAt.getTime()).toBeGreaterThan(Date.now());
    const call = (h.presigner.mock.calls as unknown as [unknown, unknown, any][]).at(-1)!;
    expect(call[1]).toBeInstanceOf(GetObjectCommand);
    expect((call[1] as GetObjectCommand).input).toMatchObject({ Bucket: config.bucket, Key: key, VersionId: 'v1', ResponseContentType: 'application/octet-stream', ResponseCacheControl: 'private, no-store, max-age=0' });
    expect(call[2].expiresIn).toBe(45);
  });

  it('writes approved shared onboarding objects with versioned private keys and signed integrity metadata', async () => {
    const h = harness();
    h.send.mockImplementation(async (command: any): Promise<any> => {
      if (command instanceof GetBucketVersioningCommand) return { Status: 'Enabled' };
      if (command instanceof HeadObjectCommand) {
        const probe = (h.presigner.mock.calls as unknown as [unknown, unknown, any][]).find((call) => (call[1] as any)?.input?.Key?.includes('_capability-probe'));
        const input = (probe?.[1] as any)?.input ?? {};
        return { VersionId: 'v1', ContentLength: input.ContentLength, ContentType: input.ContentType, ChecksumSHA256: input.ChecksumSHA256, Metadata: input.Metadata, ServerSideEncryption: input.ServerSideEncryption };
      }
      if (command instanceof PutObjectCommand) return { VersionId: 'onboarding-version-1' };
      if (command instanceof DeleteObjectCommand) return {};
      return {};
    });
    const objectBytes = Buffer.from('%PDF-1.7 synthetic onboarding');
    const { createHash } = await import('crypto');
    const versionId = await h.storage.putDocumentObject({
      documentId, objectKey: `onboarding-documents/${documentId}`, bytes: objectBytes, contentType: 'application/pdf', checksumSha256Hex: createHash('sha256').update(objectBytes).digest('hex'),
    });
    expect(versionId).toBe('onboarding-version-1');
    const put = h.send.mock.calls.map(([command]) => command).find((command) => command instanceof PutObjectCommand) as PutObjectCommand;
    expect(put.input).toMatchObject({ Bucket: config.bucket, Key: `onboarding-documents/${documentId}`, IfNoneMatch: '*', ServerSideEncryption: 'AES256', Metadata: { 'kyc-document-id': documentId } });
  });
});
