import { ClamAvClient } from './clamav-client';
import { NigerianKycScanObjectReader } from './s3-object-reader';
import { IndividualKycScannerWorker } from './worker';

async function bootstrap(): Promise<void> {
  const e = process.env;
  const isTest = e.NODE_ENV === 'test';
  if (e.VERCEL === '1') throw new Error('The raw-document scanner worker must never run on Vercel.');
  if (e.AWS_ACCESS_KEY_ID || e.AWS_SECRET_ACCESS_KEY) throw new Error('Static AWS access-key credentials are not permitted in the scanner worker.');
  if (!isTest && (e.INDIVIDUAL_KYC_SCANNER_WORKER_ENABLED !== 'true' ||
      e.INDIVIDUAL_KYC_DATA_RESIDENCY_APPROVED !== 'true' ||
      e.INDIVIDUAL_KYC_STORAGE_RESIDENCY_APPROVED !== 'true' ||
      e.INDIVIDUAL_KYC_STORAGE_PRIVATE_BUCKET_APPROVED !== 'true' ||
      e.INDIVIDUAL_KYC_STORAGE_TLS_POLICY_APPROVED !== 'true' ||
      e.INDIVIDUAL_KYC_STORAGE_RETENTION_APPROVED !== 'true' ||
      e.INDIVIDUAL_KYC_SCANNER_RESIDENCY_APPROVED !== 'true' ||
      !e.INDIVIDUAL_KYC_SCANNER_APPROVAL_REFERENCE ||
      !e.INDIVIDUAL_KYC_STORAGE_APPROVAL_REFERENCE)) {
    throw new Error('Scanner worker is not configured with explicit Nigerian residency and security approvals.');
  }
  const apiBaseUrl = required(e.INDIVIDUAL_KYC_WORKER_API_BASE_URL);
  const api = new URL(apiBaseUrl);
  if (!isTest && api.protocol !== 'https:') throw new Error('Scanner worker API must use HTTPS.');
  const workerId = required(e.INDIVIDUAL_KYC_SCANNER_WORKER_ID);
  const hmacEncoded = required(e.INDIVIDUAL_KYC_WORKER_HMAC_KEY);
  const hmacKey = Buffer.from(hmacEncoded, 'base64');
  if (hmacKey.length < 32 || hmacKey.toString('base64').replace(/=+$/, '') !== hmacEncoded.replace(/=+$/, '')) throw new Error('Scanner worker HMAC key is invalid.');
  const endpoint = required(e.INDIVIDUAL_KYC_S3_ENDPOINT);
  const bucket = required(e.INDIVIDUAL_KYC_S3_BUCKET);
  const region = required(e.INDIVIDUAL_KYC_S3_REGION);
  const credentialReference = required(e.INDIVIDUAL_KYC_S3_CREDENTIAL_REFERENCE);
  if (e.INDIVIDUAL_KYC_S3_STORAGE_ENABLED !== 'true') throw new Error('Scanner worker storage is disabled.');
  const clamdHost = required(e.INDIVIDUAL_KYC_CLAMD_HOST);
  if (!isTest && !isPrivateClamdHost(clamdHost)) throw new Error('ClamAV must be reachable only on the scanner private network.');
  const clamdPort = parsePort(e.INDIVIDUAL_KYC_CLAMD_PORT ?? '3310');
  const forcePathStyle = (e.INDIVIDUAL_KYC_S3_FORCE_PATH_STYLE ?? 'true') === 'true';
  const worker = new IndividualKycScannerWorker({
    apiBaseUrl,
    workerId,
    hmacKey,
    objectReader: new NigerianKycScanObjectReader({ endpoint, bucket, region, credentialReference, forcePathStyle }),
    clamav: new ClamAvClient(clamdHost, clamdPort),
  });
  const stop = () => worker.stop();
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  await worker.run();
}

function required(value: string | undefined): string {
  if (!value || value.trim() === '') throw new Error('Scanner worker configuration is incomplete.');
  return value.trim();
}
function parsePort(value: string): number {
  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Scanner worker configuration is incomplete.');
  return port;
}
function isPrivateClamdHost(host: string): boolean {
  const normalized = host.toLowerCase();
  if (['localhost', '127.0.0.1', '::1'].includes(normalized) || !normalized.includes('.')) return true;
  const m = /^(10|127)\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(normalized) ?? /^192\.168\.(\d{1,3})\.(\d{1,3})$/.exec(normalized);
  if (m) return true;
  const p = /^172\.(\d{1,2})\./.exec(normalized);
  return Boolean(p && Number(p[1]) >= 16 && Number(p[1]) <= 31) || normalized.startsWith('fd') || normalized.startsWith('fc');
}

void bootstrap().catch(() => {
  // Never print env values, provider URLs, object keys, attestation tokens, or document data.
  process.stderr.write('Individual KYC scanner worker stopped: configuration or service unavailable.\n');
  process.exitCode = 1;
});
