import { createHash } from 'crypto';
import { IndividualKycScannerWorker } from './worker';
import { NigerianKycScanObjectReader } from './s3-object-reader';
import { ClamAvClient } from './clamav-client';
import { IndividualKycScanJob } from './worker-types';

const DOC_ID = 'dc9b8a7a-9bbb-4b4c-8c24-8c43a260e7aa';
const PDF = Buffer.from('%PDF-1.7 synthetic only');
const checksum = (bytes: Buffer) => createHash('sha256').update(bytes).digest('base64');
const job: IndividualKycScanJob = {
  documentId: DOC_ID,
  objectKey: 'individual-kyc/quarantine/2c09f95a-3377-4842-9a5e-c560496e3f9a',
  objectVersionId: 's3-version-only',
  contentType: 'application/pdf',
  sizeBytes: PDF.length,
  checksumSha256: checksum(PDF),
  scanRequestedAt: new Date().toISOString(),
  scanJobToken: Buffer.alloc(32, 4).toString('base64url'),
};

function harness(bytes = PDF, scanImplementation: jest.Mock = jest.fn(async () => ({ clean: true, scannerVersion: 'ClamAV-1.4.3' }))) {
  const raw = Buffer.from(bytes);
  const reader = { readExactVersion: jest.fn(async () => ({ bytes: raw, sha256Base64: checksum(raw) })) } as unknown as NigerianKycScanObjectReader;
  const clamav = { scan: scanImplementation } as unknown as ClamAvClient;
  const fetcher = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    void input;
    void init;
    return new Response(JSON.stringify({ data: { accepted: true } }), { status: 200, headers: { 'content-type': 'application/json' } });
  });
  const worker = new IndividualKycScannerWorker({
    apiBaseUrl: 'https://api.example.invalid', workerId: 'scanner-nigeria-1', hmacKey: Buffer.alloc(32, 7),
    objectReader: reader, clamav, fetcher,
  });
  return { worker, raw, reader, clamav, fetcher };
}

describe('Nigerian Individual KYC scanner worker', () => {
  it('validates, scans, hashes and attests an exact synthetic PDF without sending bytes to API', async () => {
    const h = harness();
    const result = await h.worker.process(job);
    expect(result).toMatchObject({ outcome: 'CLEAN', objectVersionId: job.objectVersionId, sha256Base64: checksum(PDF), scannerEngine: 'clamd', scannerVersion: 'ClamAV-1.4.3' });
    expect((h.clamav.scan as jest.Mock)).toHaveBeenCalledWith(expect.any(Buffer));
    const body = (h.fetcher.mock.calls[0][1] as RequestInit).body as string;
    expect(body).not.toContain('%PDF-');
    expect(body).toContain(job.scanJobToken);
    expect(h.raw.every((byte) => byte === 0)).toBe(true);
  });

  it('rejects a file-signature mismatch without invoking ClamAV', async () => {
    const bad = Buffer.from('not really a PDF');
    const h = harness(bad);
    const result = await h.worker.process({ ...job, sizeBytes: bad.length, checksumSha256: checksum(bad) });
    expect(result.outcome).toBe('FAILED');
    expect(h.clamav.scan).not.toHaveBeenCalled();
  });

  it('does not attest a changed checksum as clean', async () => {
    const h = harness();
    const result = await h.worker.process({ ...job, checksumSha256: Buffer.alloc(32, 8).toString('base64') });
    expect(result.outcome).toBe('FAILED');
    expect(h.clamav.scan).not.toHaveBeenCalled();
  });

  it('returns INFECTED for the EICAR test string detected by the scanner interface', async () => {
    const eicarPdf = Buffer.concat([Buffer.from('%PDF-1.7\n'), Buffer.from('X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*')]);
    const detectEicar = jest.fn(async (bytes: Buffer) => ({ clean: !bytes.includes(Buffer.from('EICAR-STANDARD-ANTIVIRUS-TEST-FILE')), scannerVersion: 'ClamAV-test-fixture' }));
    const h = harness(eicarPdf, detectEicar);
    const result = await h.worker.process({ ...job, sizeBytes: eicarPdf.length, checksumSha256: checksum(eicarPdf) });
    expect(result.outcome).toBe('INFECTED');
  });

  it('keeps scanner failures unapproved and leaves unreachable objects for lease retry', async () => {
    const h = harness(PDF, jest.fn(async () => { throw new Error('scanner down'); }));
    const result = await h.worker.process(job);
    expect(result).toMatchObject({ outcome: 'FAILED', scannerVersion: null });
    const unavailableReader = { readExactVersion: jest.fn(async () => { throw new Error('S3 unavailable'); }) } as unknown as NigerianKycScanObjectReader;
    const noReadWorker = new IndividualKycScannerWorker({
      apiBaseUrl: 'https://api.example.invalid', workerId: 'scanner-nigeria-1', hmacKey: Buffer.alloc(32, 7),
      objectReader: unavailableReader, clamav: h.clamav, fetcher: h.fetcher,
    });
    const before = h.fetcher.mock.calls.length;
    await expect(noReadWorker.process(job)).rejects.toThrow();
    expect(h.fetcher).toHaveBeenCalledTimes(before);
  });
});
