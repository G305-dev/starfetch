/** Starfetch Corporate O2 preflight — synthetic, no database writes or customer data. */
import { randomUUID, createHmac, timingSafeEqual } from 'node:crypto';
import { KMSClient, GenerateDataKeyCommand, DecryptCommand } from '@aws-sdk/client-kms';
import { awsCredentialsProvider } from '@vercel/oidc-aws-credentials-provider';
import { Redis } from '@upstash/redis';

const env = process.env;
function requireVars(...names) {
  const absent = names.filter((name) => !env[name]);
  if (absent.length) throw new Error(`Missing environment variable names: ${absent.join(', ')}`);
}

const lua = `
local count = redis.call('INCR', KEYS[1])
local ttl = redis.call('PTTL', KEYS[1])
if ttl <= 0 then
  redis.call('PEXPIRE', KEYS[1], tonumber(ARGV[1]))
  ttl = tonumber(ARGV[1])
end
if count > tonumber(ARGV[2]) then
  return {0, ttl}
end
return {1, ttl}
`;

async function redisCheck() {
  requireVars('CORPORATE_O2_RATE_LIMIT_REDIS_REST_URL', 'CORPORATE_O2_RATE_LIMIT_REDIS_REST_TOKEN', 'CORPORATE_O2_RATE_LIMIT_HMAC_SECRET');
  const secret = Buffer.from(env.CORPORATE_O2_RATE_LIMIT_HMAC_SECRET, 'base64');
  if (secret.length < 32) throw new Error('Rate-limit HMAC secret is too short');
  const syntheticUser = `o2-preflight-${randomUUID()}`;
  const digest = createHmac('sha256', secret)
    .update('starfetch:corporate-o2:rate-limit:v1\0')
    .update(syntheticUser, 'utf8')
    .digest('hex');
  secret.fill(0);
  const key = `sf:corporate:o2:rate:v1:${digest}`;
  const redis = new Redis({
    url: env.CORPORATE_O2_RATE_LIMIT_REDIS_REST_URL,
    token: env.CORPORATE_O2_RATE_LIMIT_REDIS_REST_TOKEN,
    retry: false,
    enableTelemetry: false,
    signal: () => AbortSignal.timeout(1500),
  });
  try {
    const pong = await redis.ping();
    if (pong !== 'PONG') throw new Error('Redis PING did not return PONG');
    for (let i = 1; i <= 6; i++) {
      const result = await redis.eval(lua, [key], [60000, 5]);
      if (!Array.isArray(result) || result.length !== 2) throw new Error('Redis EVAL returned an unexpected shape');
      const permitted = Number(result[0]);
      const ttl = Number(result[1]);
      if (permitted !== (i <= 5 ? 1 : 0) || !Number.isFinite(ttl) || ttl <= 0 || ttl > 60000) {
        throw new Error(`Redis fixed-window check failed on attempt ${i}`);
      }
    }
    console.log('PASS REDIS: ping, Lua EVAL, five permitted and sixth denied (synthetic key)');
  } finally {
    try { await redis.del(key); } catch { /* short test TTL clears any remaining key */ }
  }
}

function productionOidcToken() {
  const token = env.VERCEL_OIDC_TOKEN;
  if (!token) throw new Error('No VERCEL_OIDC_TOKEN in this process. Run a protected check inside the Vercel Production function runtime; do not substitute static AWS keys.');
  const part = token.split('.')[1];
  if (!part) throw new Error('Malformed OIDC token');
  const claims = JSON.parse(Buffer.from(part, 'base64url').toString('utf8'));
  const sub = String(claims.sub ?? '');
  if (!sub.includes('project:starfetch-api:environment:production')) {
    throw new Error('OIDC token is not for the starfetch-api Production project. Production KMS test was NOT attempted.');
  }
}

async function kmsCheck() {
  requireVars('AWS_REGION', 'AWS_ROLE_ARN', 'CORPORATE_O2_KMS_KEY_ID');
  productionOidcToken();
  const kms = new KMSClient({
    region: env.AWS_REGION,
    credentials: awsCredentialsProvider({ roleArn: env.AWS_ROLE_ARN }),
  });
  const applicationId = randomUUID();
  const context = {
    applicationId,
    environment: 'production',
    field: 'taxIdentificationNumber',
    purpose: 'starfetch:corporate-o2:tin:v1',
    contextVersion: '1',
  };
  let issuedKey;
  let unwrappedKey;
  try {
    const generated = await kms.send(new GenerateDataKeyCommand({
      KeyId: env.CORPORATE_O2_KMS_KEY_ID,
      KeySpec: 'AES_256',
      EncryptionContext: context,
    }));
    if (!generated.Plaintext || !generated.CiphertextBlob) throw new Error('KMS returned incomplete data-key materials');
    issuedKey = Buffer.from(generated.Plaintext);
    if (issuedKey.length !== 32) throw new Error('KMS generated data key is not 256 bits');
    const decrypted = await kms.send(new DecryptCommand({
      KeyId: env.CORPORATE_O2_KMS_KEY_ID,
      CiphertextBlob: generated.CiphertextBlob,
      EncryptionContext: context,
    }));
    unwrappedKey = Buffer.from(decrypted.Plaintext ?? []);
    if (unwrappedKey.length !== 32 || !timingSafeEqual(issuedKey, unwrappedKey)) {
      throw new Error('KMS context-bound Decrypt did not recover the same data key');
    }
    console.log('PASS KMS: production-scoped OIDC role, GenerateDataKey and context-bound Decrypt (synthetic context)');
    let denied = false;
    try {
      await kms.send(new DecryptCommand({
        KeyId: env.CORPORATE_O2_KMS_KEY_ID,
        CiphertextBlob: generated.CiphertextBlob,
        EncryptionContext: { ...context, applicationId: randomUUID() },
      }));
    } catch { denied = true; }
    if (!denied) throw new Error('KMS accepted a mismatched encryption context');
    console.log('PASS KMS: mismatched encryption context rejected');
  } finally {
    issuedKey?.fill(0);
    unwrappedKey?.fill(0);
    kms.destroy();
  }
}

let failed = false;
for (const [label, fn] of [['REDIS', redisCheck], ['KMS_OIDC', kmsCheck]]) {
  try { await fn(); }
  catch (error) {
    failed = true;
    console.error(`FAIL ${label}: ${error instanceof Error ? error.name + ': ' + error.message : 'unknown error'}`);
  }
}
if (failed) process.exitCode = 1;
else console.log('PREFLIGHT PASS: Redis and KMS/OIDC both passed; Vercel function runtime and O2 DB writes still require a separately authorized smoke test.');
