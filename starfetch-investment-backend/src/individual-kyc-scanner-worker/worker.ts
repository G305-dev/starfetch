import { randomBytes, createHash } from 'crypto';
import { ClamAvClient } from './clamav-client';
import { NigerianKycScanObjectReader } from './s3-object-reader';
import { IndividualKycScanJob, IndividualKycScanJobResult } from './worker-types';
import { canonicalJson, workerSignature } from '../modules/individual-kyc/individual-kyc-worker-auth';

export interface KycScannerWorkerConfig {
  readonly apiBaseUrl: string;
  readonly workerId: string;
  readonly hmacKey: Buffer;
  readonly objectReader: NigerianKycScanObjectReader;
  readonly clamav: ClamAvClient;
  readonly fetcher?: typeof fetch;
  readonly now?: () => number;
}

export class IndividualKycScannerWorker {
  private readonly fetcher: typeof fetch;
  private readonly now: () => number;
  private stopped = false;

  constructor(private readonly config: KycScannerWorkerConfig) {
    const api = new URL(config.apiBaseUrl);
    if (api.protocol !== 'https:' || api.username || api.password || api.search || api.hash || api.pathname !== '/' ||
        !/^[A-Za-z0-9._-]{1,80}$/.test(config.workerId) || config.hmacKey.length < 32) {
      throw new Error('Scanner worker requires an approved HTTPS API endpoint and workload identity.');
    }
    this.fetcher = config.fetcher ?? fetch;
    this.now = config.now ?? Date.now;
  }

  stop(): void { this.stopped = true; }

  async run(): Promise<void> {
    while (!this.stopped) {
      try {
        const job = await this.claim();
        if (job) await this.process(job);
        else await delay(1500);
      } catch {
        // Never print document keys, signatures, signed URLs, or scan bytes.
        await delay(5000);
      }
    }
  }

  async claim(): Promise<IndividualKycScanJob | null> {
    const path = '/api/v1/internal/individual-kyc/scan-jobs/claim';
    const response = await this.request('POST', path, {});
    if (!response || typeof response !== 'object') throw new Error('Invalid scan-job response.');
    return response as IndividualKycScanJob | null;
  }

  async process(job: IndividualKycScanJob): Promise<IndividualKycScanJobResult> {
    validateJob(job);
    let bytes: Buffer | undefined;
    let result: IndividualKycScanJobResult;
    try {
      const stored = await this.config.objectReader.readExactVersion(job);
      bytes = stored.bytes;
      if (stored.sha256Base64 !== job.checksumSha256) {
        result = failedAttestation(job, stored.sha256Base64, null, this.now());
      } else if (!hasMatchingSignature(bytes, job.contentType)) {
        result = failedAttestation(job, stored.sha256Base64, null, this.now());
      } else {
        try {
          const scan = await this.config.clamav.scan(bytes);
          result = {
            outcome: scan.clean ? 'CLEAN' : 'INFECTED',
            objectVersionId: job.objectVersionId,
            sha256Base64: stored.sha256Base64,
            scannerEngine: 'clamd',
            scannerVersion: scan.scannerVersion,
            scannedAt: new Date(this.now()).toISOString(),
            scanJobToken: job.scanJobToken,
          };
        } catch {
          result = failedAttestation(job, stored.sha256Base64, null, this.now());
        }
      }
    } catch {
      // A missing/unreadable object is not attested. The lease expires and the
      // API can retry; no document is marked CLEAN or sent overseas.
      throw new Error('Quarantined object could not be safely scanned.');
    } finally {
      // Raw bytes live only in the approved worker process and are wiped after use.
      bytes?.fill(0);
    }
    const path = `/api/v1/internal/individual-kyc/scan-jobs/${encodeURIComponent(job.documentId)}/result`;
    await this.request('POST', path, result);
    return result;
  }

  private async request(method: string, path: string, body: unknown): Promise<unknown> {
    const timestamp = String(this.now());
    const nonce = randomBytes(24).toString('base64url');
    const signature = workerSignature({
      method, path, timestamp, nonce, workerId: this.config.workerId,
      body, key: this.config.hmacKey,
    });
    const response = await this.fetcher(new URL(path, this.config.apiBaseUrl), {
      method,
      headers: {
        'content-type': 'application/json',
        'x-starfetch-kyc-worker-id': this.config.workerId,
        'x-starfetch-kyc-worker-timestamp': timestamp,
        'x-starfetch-kyc-worker-nonce': nonce,
        'x-starfetch-kyc-worker-signature': signature,
      },
      body: canonicalJson(body),
      signal: AbortSignal.timeout(20_000),
      redirect: 'error',
    });
    if (!response.ok) throw new Error('Scanner worker API request failed.');
    const envelope: unknown = await response.json();
    if (envelope && typeof envelope === 'object' && 'data' in envelope) return (envelope as { data: unknown }).data;
    return envelope;
  }
}

function failedAttestation(job: IndividualKycScanJob, sha256Base64: string, scannerVersion: string | null, time: number): IndividualKycScanJobResult {
  return {
    outcome: 'FAILED',
    objectVersionId: job.objectVersionId,
    sha256Base64,
    scannerEngine: 'clamd',
    scannerVersion,
    scannedAt: new Date(time).toISOString(),
    scanJobToken: job.scanJobToken,
  };
}

function validateJob(job: IndividualKycScanJob): void {
  if (!job || !/^[0-9a-f-]{36}$/i.test(job.documentId) || !job.objectKey.startsWith('individual-kyc/quarantine/') ||
      !job.objectVersionId || job.objectVersionId.length > 256 ||
      !['application/pdf', 'image/jpeg', 'image/png'].includes(job.contentType) ||
      !Number.isInteger(job.sizeBytes) || job.sizeBytes < 1 || job.sizeBytes > 10 * 1024 * 1024 ||
      !/^[A-Za-z0-9+/]{43}=$/.test(job.checksumSha256) ||
      !/^[A-Za-z0-9_-]{40,128}$/.test(job.scanJobToken)) throw new Error('Invalid scanner job.');
  const requestedAt = Date.parse(job.scanRequestedAt);
  if (!Number.isFinite(requestedAt) || Math.abs(Date.now() - requestedAt) > 24 * 60 * 60 * 1000) throw new Error('Expired scanner job.');
}

function hasMatchingSignature(bytes: Buffer, contentType: string): boolean {
  if (contentType === 'application/pdf') return bytes.subarray(0, 5).equals(Buffer.from('%PDF-'));
  if (contentType === 'image/jpeg') return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  if (contentType === 'image/png') return bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  return false;
}

export function scanAttestationDigest(result: Omit<IndividualKycScanJobResult, 'scanJobToken'>): string {
  return createHash('sha256').update(canonicalJson(result)).digest('hex');
}

function delay(ms: number): Promise<void> { return new Promise((resolve) => setTimeout(resolve, ms)); }
