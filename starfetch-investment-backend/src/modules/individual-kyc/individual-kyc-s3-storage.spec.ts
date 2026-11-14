import { ServiceUnavailableException } from '@nestjs/common';
import { DeleteObjectCommand, GetBucketVersioningCommand, HeadObjectCommand, S3Client } from '@aws-sdk/client-s3';
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
    const deleteCommands = h.send.mock.calls.filter(([command]) => command instanceof DeleteObjectCommand);
    expect(deleteCommands).toHaveLength(1);
    expect((deleteCommands[0][0] as DeleteObjectCommand).input.VersionId).toBe('v1');
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

  it('returns metadata only and exposes no object-byte read method', async () => {
    const h = harness();
    await h.storage.createUploadIntent({ documentId, objectKey: key, contentType: 'application/pdf', sizeBytes: bytes.length, checksumSha256: checksum, expiresInSeconds: 300 });
    const metadata = await h.storage.headQuarantined(key);
    expect(metadata).toMatchObject({ versionId: 'v1', sizeBytes: bytes.length, contentType: 'application/pdf', checksumSha256: checksum, documentIdMetadata: documentId, serverSideEncryption: 'AES256' });
    expect((h.storage as any).readQuarantined).toBeUndefined();
  });
});
