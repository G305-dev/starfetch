#!/usr/bin/env node
/**
 * One-off Vercel production-build OIDC/S3 smoke test.
 * Synthetic bytes only; ListObjectVersions is prefix-scoped to this run's random key.
 * No bucket-wide list, GetObject, KYC approval changes, or public route.
 */
import { createHash, randomUUID } from 'node:crypto';
import { Buffer } from 'node:buffer';
import process from 'node:process';
import { URL } from 'node:url';
import {
  DeleteObjectCommand,
  GetBucketVersioningCommand,
  HeadObjectCommand,
  ListObjectVersionsCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { GetCallerIdentityCommand, STSClient } from '@aws-sdk/client-sts';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';

const EXPECTED = Object.freeze({
  region: 'eu-west-1',
  bucket: 'starfetch-kyc-dev-2026-01',
  roleName: 'StarfetchCorporateO2VercelProductionRole',
  issuer: 'https://oidc.vercel.com/seyii',
  subject: 'owner:seyii:project:starfetch-api:environment:production',
  prefix: 'individual-kyc/_capability-probe/',
  confirm: 'starfetch-api-production-one-off',
});

const output = {
  runtimeGuard: 'NOT_RUN',
  roleAssumption: 'NOT_RUN',
  bucketVersioning: 'NOT_RUN',
  syntheticPut: 'NOT_RUN',
  metadataChecksum: 'NOT_RUN',
  conditionalReplayRejected: 'NOT_RUN',
  exactVersionDelete: 'NOT_RUN',
  cleanup: 'NOT_RUN',
};

function fail(message) {
  throw new Error(message);
}

function decodeOidcClaims(token) {
  const parts = token.split('.');
  if (parts.length !== 3) fail('OIDC token is not a JWT.');
  let claims;
  try {
    claims = JSON.parse(Buffer.from(parts[1], 'base64url').toString('utf8'));
  } catch {
    fail('OIDC token claims could not be parsed.');
  }
  return claims;
}

function getSafeContext(env) {
  if (env.STARFETCH_S3_OIDC_SMOKE_RUN !== 'true' || env.STARFETCH_S3_OIDC_SMOKE_CONFIRM !== EXPECTED.confirm) {
    fail('One-off smoke confirmation is missing.');
  }
  if (env.VERCEL !== '1' || env.VERCEL_ENV !== 'production') fail('Smoke test must run in a Vercel production build/runtime.');
  if (env.AWS_ACCESS_KEY_ID || env.AWS_SECRET_ACCESS_KEY) fail('Static AWS credentials are forbidden for this smoke test.');
  if (['INDIVIDUAL_KYC_S3_STORAGE_ENABLED', 'INDIVIDUAL_KYC_DOCUMENT_UPLOAD_ENABLED', 'INDIVIDUAL_KYC_SCANNER_WORKER_ENABLED']
    .some((name) => env[name] === 'true')) {
    fail('Storage, document-upload, and scanner feature flags must remain disabled during this smoke test.');
  }
  if (!env.AWS_ROLE_ARN) fail('Existing AWS_ROLE_ARN is missing.');
  const role = /^arn:aws:iam::(\d{12}):role\/(?:[^\s]+\/)?([^/]+)$/.exec(env.AWS_ROLE_ARN);
  if (!role || role[2] !== EXPECTED.roleName) fail('AWS_ROLE_ARN is not the expected existing role.');
  if (!env.VERCEL_OIDC_TOKEN) fail('Vercel OIDC token is unavailable in this build/runtime context.');
  const claims = decodeOidcClaims(env.VERCEL_OIDC_TOKEN);
  if (claims.iss !== EXPECTED.issuer || claims.sub !== EXPECTED.subject) {
    fail('Vercel OIDC issuer/project/environment claims do not match the authorized target.');
  }
  return { roleAccountId: role[1], roleArn: env.AWS_ROLE_ARN };
}

function responseCode(error) {
  const code = error?.name ?? error?.Code ?? error?.code;
  const status = error?.$metadata?.httpStatusCode;
  return `${typeof code === 'string' ? code : 'AwsError'}${Number.isInteger(status) ? `:${status}` : ''}`;
}

async function listVersionsForExactKey(s3, objectKey) {
  const versions = [];
  const deleteMarkers = [];
  let keyMarker;
  let versionIdMarker;
  const seenCursors = new Set();
  for (let page = 0; page < 20; page += 1) {
    const response = await s3.send(new ListObjectVersionsCommand({
      Bucket: EXPECTED.bucket,
      Prefix: objectKey,
      MaxKeys: 1000,
      ...(keyMarker ? { KeyMarker: keyMarker } : {}),
      ...(versionIdMarker ? { VersionIdMarker: versionIdMarker } : {}),
    }));
    for (const version of response.Versions ?? []) {
      if (version.Key === objectKey && typeof version.VersionId === 'string') versions.push(version.VersionId);
    }
    for (const marker of response.DeleteMarkers ?? []) {
      if (marker.Key === objectKey && typeof marker.VersionId === 'string') deleteMarkers.push(marker.VersionId);
    }
    if (!response.IsTruncated) return { versions, deleteMarkers };
    if (typeof response.NextKeyMarker !== 'string') fail('Version listing pagination was incomplete.');
    keyMarker = response.NextKeyMarker;
    versionIdMarker = response.NextVersionIdMarker;
    const cursor = `${keyMarker}\n${versionIdMarker ?? ''}`;
    if (seenCursors.has(cursor)) fail('Version listing pagination repeated a cursor.');
    seenCursors.add(cursor);
  }
  fail('Version listing exceeded the synthetic-key pagination safety limit.');
}

async function run() {
  const context = getSafeContext(process.env);
  output.runtimeGuard = 'PASS';

  // Exactly the same Vercel provider and role-ARN input used by the existing
  // Corporate KMS provider. No static credentials or KYC approval flags.
  const credentials = awsCredentialsProvider({ roleArn: context.roleArn });
  const sts = new STSClient({ region: EXPECTED.region, credentials, maxAttempts: 1 });
  const s3 = new S3Client({
    region: EXPECTED.region,
    forcePathStyle: process.env.INDIVIDUAL_KYC_S3_FORCE_PATH_STYLE !== 'false',
    credentials,
    maxAttempts: 1,
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  });
  let bucketVersioning;
  let objectKey;
  let documentId;
  let content;
  let checksum;
  let putAttempted = false;
  let originalVersionId;
  let replayWasRejected = false;
  let objectWasVerified = false;
  const versionsToDelete = new Set();
  const deletedVersions = new Set();
  let primaryFailure;

  try {
    const identity = await sts.send(new GetCallerIdentityCommand({}));
    const expectedArnPrefix = `arn:aws:sts::${context.roleAccountId}:assumed-role/${EXPECTED.roleName}/`;
    if (identity.Account !== context.roleAccountId || typeof identity.Arn !== 'string' || !identity.Arn.startsWith(expectedArnPrefix)) {
      fail('STS caller identity is not the expected assumed IAM role.');
    }
    output.roleAssumption = 'PASS';

    bucketVersioning = await s3.send(new GetBucketVersioningCommand({ Bucket: EXPECTED.bucket }));
    if (bucketVersioning.Status !== 'Enabled') fail('Target bucket versioning is not Enabled.');
    output.bucketVersioning = 'PASS';

    objectKey = `${EXPECTED.prefix}${randomUUID()}`;
    documentId = randomUUID();
    content = Buffer.from(`%PDF-1.7\nStarfetch OIDC smoke test synthetic bytes only\nprobe=${randomUUID()}\n`, 'utf8');
    checksum = createHash('sha256').update(content).digest('base64');
    const putCommand = new PutObjectCommand({
      Bucket: EXPECTED.bucket,
      Key: objectKey,
      ContentLength: content.length,
      ContentType: 'application/pdf',
      ChecksumSHA256: checksum,
      IfNoneMatch: '*',
      ServerSideEncryption: 'AES256',
      Metadata: { 'kyc-document-id': documentId },
    });
    const signedUrl = await getSignedUrl(s3, putCommand, {
      expiresIn: 300,
      signableHeaders: new Set([
        'content-type', 'content-length', 'if-none-match',
        'x-amz-checksum-sha256', 'x-amz-server-side-encryption', 'x-amz-meta-kyc-document-id',
      ]),
    });
    if (new URL(signedUrl).protocol !== 'https:') fail('Signed synthetic PUT URL was not HTTPS.');
    const signedHeaders = {
      'content-type': 'application/pdf',
      'content-length': String(content.length),
      'if-none-match': '*',
      'x-amz-checksum-sha256': checksum,
      'x-amz-server-side-encryption': 'AES256',
      'x-amz-meta-kyc-document-id': documentId,
    };
    putAttempted = true;
    const putResponse = await globalThis.fetch(signedUrl, { method: 'PUT', headers: signedHeaders, body: content, redirect: 'error' });
    originalVersionId = putResponse.headers.get('x-amz-version-id') ?? undefined;
    if (!putResponse.ok || !originalVersionId || originalVersionId === 'null') fail('Synthetic signed PUT failed or returned no S3 version ID.');
    versionsToDelete.add(originalVersionId);
    output.syntheticPut = 'PASS';

    const head = await s3.send(new HeadObjectCommand({
      Bucket: EXPECTED.bucket,
      Key: objectKey,
      ChecksumMode: 'ENABLED',
    }));
    if (head.VersionId !== originalVersionId || Number(head.ContentLength) !== content.length ||
        head.ContentType !== 'application/pdf' || head.ChecksumSHA256 !== checksum ||
        head.Metadata?.['kyc-document-id'] !== documentId || head.ServerSideEncryption !== 'AES256') {
      fail('Synthetic object metadata/checksum/version verification failed.');
    }
    objectWasVerified = true;
    output.metadataChecksum = 'PASS';

    const replay = await globalThis.fetch(signedUrl, { method: 'PUT', headers: signedHeaders, body: content, redirect: 'error' });
    const replayVersionId = replay.headers.get('x-amz-version-id') ?? undefined;
    if (replay.ok) {
      if (replayVersionId && replayVersionId !== 'null') versionsToDelete.add(replayVersionId);
      fail('Conditional replay unexpectedly succeeded.');
    }
    replayWasRejected = replay.status === 409 || replay.status === 412;
    if (!replayWasRejected) fail(`Conditional replay returned unexpected HTTP status ${replay.status}.`);
    const afterReplay = await s3.send(new HeadObjectCommand({
      Bucket: EXPECTED.bucket,
      Key: objectKey,
      ChecksumMode: 'ENABLED',
    }));
    if (afterReplay.VersionId !== originalVersionId || afterReplay.ChecksumSHA256 !== checksum) {
      fail('Conditional replay changed the synthetic object version or checksum.');
    }
    output.conditionalReplayRejected = 'PASS';
  } catch (error) {
    primaryFailure = error;
  } finally {
    // If PUT reached S3 but its response was lost, only inspect our random key
    // and delete a version whose unique synthetic metadata matches this run.
    if (putAttempted && objectKey && documentId) {
      try {
        const current = await s3.send(new HeadObjectCommand({
          Bucket: EXPECTED.bucket,
          Key: objectKey,
          ChecksumMode: 'ENABLED',
        }));
        if (current.Metadata?.['kyc-document-id'] === documentId && current.VersionId && current.VersionId !== 'null') {
          versionsToDelete.add(current.VersionId);
        }
      } catch (error) {
        if (error?.$metadata?.httpStatusCode !== 404 && error?.name !== 'NotFound' && !primaryFailure) primaryFailure = error;
      }
    }
    let cleanupFailed = false;
    for (const versionId of versionsToDelete) {
      try {
        await s3.send(new DeleteObjectCommand({ Bucket: EXPECTED.bucket, Key: objectKey, VersionId: versionId }));
        deletedVersions.add(versionId);
      } catch (error) {
        cleanupFailed = true;
        if (!primaryFailure) primaryFailure = error;
      }
    }
    if (putAttempted && objectKey) {
      try {
        const listed = await listVersionsForExactKey(s3, objectKey);
        if (originalVersionId && !listed.versions.includes(originalVersionId)) {
          output.exactVersionDelete = 'PASS';
        } else if (originalVersionId) {
          output.exactVersionDelete = 'FAIL';
          cleanupFailed = true;
          if (!primaryFailure) primaryFailure = new Error('Exact synthetic version is still present in ListObjectVersions.');
        }
        if (listed.versions.length > 0 || listed.deleteMarkers.length > 0) {
          cleanupFailed = true;
          if (!primaryFailure) primaryFailure = new Error('Synthetic object versions remain after cleanup.');
        }
      } catch (error) {
        // AccessDenied/403 and every other listing error are inconclusive, never proof of deletion.
        cleanupFailed = true;
        if (!primaryFailure) primaryFailure = error;
      }
    }
    output.cleanup = cleanupFailed ? 'FAIL' : (versionsToDelete.size > 0 && deletedVersions.size === versionsToDelete.size ? 'PASS' : 'INCOMPLETE');
    if (content) content.fill(0);
    s3.destroy();
    sts.destroy();
  }

  if (primaryFailure) {
    const safeCode = responseCode(primaryFailure);
    globalThis.console.error(JSON.stringify({ ...output, result: 'FAIL', errorCode: safeCode }));
    process.exitCode = 1;
    return;
  }
  if (!objectWasVerified || !replayWasRejected || output.exactVersionDelete !== 'PASS' || output.cleanup !== 'PASS') {
    globalThis.console.error(JSON.stringify({ ...output, result: 'FAIL', errorCode: 'SmokeCheckIncomplete' }));
    process.exitCode = 1;
    return;
  }
  globalThis.console.log(JSON.stringify({ ...output, result: 'PASS', target: 'approved synthetic prefix only' }));
}

run().catch((error) => {
  // Do not print provider errors, token data, object keys, bucket listings, or credentials.
  globalThis.console.error(JSON.stringify({ result: 'FAIL', errorCode: responseCode(error) }));
  process.exitCode = 1;
});
