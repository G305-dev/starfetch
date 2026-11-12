import {
  DecryptCommand,
  GenerateDataKeyCommand,
  KMSClient,
} from '@aws-sdk/client-kms';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export const CORPORATE_TIN_ENCRYPTION_PROVIDER = Symbol('CORPORATE_TIN_ENCRYPTION_PROVIDER');

export interface EncryptedCorporateTin {
  readonly ciphertext: string;
  readonly iv: string;
  readonly authTag: string;
  readonly encryptedDataKey: string;
  readonly keyProvider: 'AWS_KMS' | 'TEST_AES_GCM';
  readonly keyId: string;
  readonly keyVersion: string;
  readonly contextVersion: 1;
}

/** The sole cryptographic port allowed to encrypt/decrypt a persisted Corporate TIN. */
export interface CorporateTinEncryptionProvider {
  encrypt(plaintext: string, applicationId: string): Promise<EncryptedCorporateTin>;
  decrypt(record: EncryptedCorporateTin, applicationId: string): Promise<Buffer>;
}

const CONTEXT_VERSION = 1 as const;
const SERVICE_UNAVAILABLE = {
  code: 'SERVICE_UNAVAILABLE',
  message: 'Corporate registration is temporarily unavailable.',
} as const;

function encryptionContext(applicationId: string, environment: string): Record<string, string> {
  return {
    applicationId,
    environment,
    field: 'taxIdentificationNumber',
    purpose: 'starfetch:corporate-o2:tin:v1',
    contextVersion: String(CONTEXT_VERSION),
  };
}

function canonicalContext(context: Record<string, string>): Buffer {
  const ordered = Object.fromEntries(Object.entries(context).sort(([a], [b]) => a.localeCompare(b)));
  return Buffer.from(JSON.stringify(ordered), 'utf8');
}

function deploymentEnvironment(config: ConfigService): string {
  // Vercel Preview functions commonly run with NODE_ENV=production. Only trust
  // VERCEL_ENV when the platform marker is present; otherwise use NODE_ENV.
  if (config.get<boolean>('platform.isVercel') === true) {
    return config.get<string>('platform.vercelEnvironment') ?? 'development';
  }
  return config.get<string>('nodeEnv') ?? 'development';
}

function encryptAesGcm(plaintext: string, dataKey: Buffer, aad: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dataKey, iv);
  cipher.setAAD(aad);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

function decryptAesGcm(ciphertext: Buffer, dataKey: Buffer, iv: Buffer, authTag: Buffer, aad: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', dataKey, iv);
  decipher.setAAD(aad);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

function failedClosed(): ServiceUnavailableException {
  return new ServiceUnavailableException(SERVICE_UNAVAILABLE);
}

function wipeBytes(value: Uint8Array | undefined): void {
  value?.fill(0);
}

/**
 * Production adapter: AWS KMS GenerateDataKey( AES_256 ) + local AES-256-GCM.
 * Vercel uses its OIDC-to-STS credential provider; non-Vercel deployments may
 * use the AWS SDK default credential chain. No static AWS credential is embedded.
 */
@Injectable()
export class AwsKmsCorporateTinEncryptionProvider implements CorporateTinEncryptionProvider {
  constructor(
    private readonly config: ConfigService,
    @Inject(KMSClient) private readonly kms: KMSClient,
  ) {}

  async encrypt(plaintext: string, applicationId: string): Promise<EncryptedCorporateTin> {
    let dataKey: Buffer | undefined;
    let kmsPlaintext: Uint8Array | undefined;
    try {
      const keyId = this.config.get<string>('corporate.o2.kmsKeyId');
      const keyVersion = this.config.get<string>('corporate.o2.kmsKeyVersion');
      const environment = deploymentEnvironment(this.config);
      if (!keyId || !keyVersion || typeof plaintext !== 'string' || plaintext.length === 0) throw failedClosed();
      const context = encryptionContext(applicationId, environment);
      const generated = await this.kms.send(new GenerateDataKeyCommand({
        KeyId: keyId,
        KeySpec: 'AES_256',
        EncryptionContext: context,
      }));
      kmsPlaintext = generated.Plaintext;
      if (!kmsPlaintext || !generated.CiphertextBlob || kmsPlaintext.byteLength !== 32) {
        throw failedClosed();
      }
      dataKey = Buffer.from(kmsPlaintext);
      wipeBytes(kmsPlaintext);
      kmsPlaintext = undefined;
      const encrypted = encryptAesGcm(plaintext, dataKey, canonicalContext(context));
      return {
        ciphertext: encrypted.ciphertext.toString('base64'),
        iv: encrypted.iv.toString('base64'),
        authTag: encrypted.authTag.toString('base64'),
        encryptedDataKey: Buffer.from(generated.CiphertextBlob).toString('base64'),
        keyProvider: 'AWS_KMS',
        keyId: generated.KeyId ?? keyId,
        keyVersion,
        contextVersion: CONTEXT_VERSION,
      };
    } catch {
      throw failedClosed();
    } finally {
      wipeBytes(kmsPlaintext);
      dataKey?.fill(0);
    }
  }

  async decrypt(record: EncryptedCorporateTin, applicationId: string): Promise<Buffer> {
    let dataKey: Buffer | undefined;
    let kmsPlaintext: Uint8Array | undefined;
    try {
      if (record.keyProvider !== 'AWS_KMS' || record.contextVersion !== CONTEXT_VERSION ||
          !record.keyId || !record.keyVersion) throw failedClosed();
      const context = encryptionContext(applicationId, deploymentEnvironment(this.config));
      const unwrapped = await this.kms.send(new DecryptCommand({
        KeyId: record.keyId,
        CiphertextBlob: Buffer.from(record.encryptedDataKey, 'base64'),
        EncryptionContext: context,
      }));
      kmsPlaintext = unwrapped.Plaintext;
      if (!kmsPlaintext || kmsPlaintext.byteLength !== 32) throw failedClosed();
      dataKey = Buffer.from(kmsPlaintext);
      wipeBytes(kmsPlaintext);
      kmsPlaintext = undefined;
      return decryptAesGcm(
        Buffer.from(record.ciphertext, 'base64'),
        dataKey,
        Buffer.from(record.iv, 'base64'),
        Buffer.from(record.authTag, 'base64'),
        canonicalContext(context),
      );
    } catch {
      throw failedClosed();
    } finally {
      wipeBytes(kmsPlaintext);
      dataKey?.fill(0);
    }
  }
}

/**
 * Secure test-only envelope provider. A synthetic in-memory 256-bit wrapping
 * key encrypts random per-value data keys; it is never registered in production.
 */
export class TestCorporateTinEncryptionProvider implements CorporateTinEncryptionProvider {
  constructor(private readonly testWrappingKey: Buffer) {
    if (testWrappingKey.length !== 32) throw new Error('Synthetic test wrapping key must be 32 bytes.');
  }

  async encrypt(plaintext: string, applicationId: string): Promise<EncryptedCorporateTin> {
    if (plaintext.length === 0) throw failedClosed();
    const context = encryptionContext(applicationId, 'test');
    const aad = canonicalContext(context);
    const dataKey = randomBytes(32);
    const wrapIv = randomBytes(12);
    try {
      const encrypted = encryptAesGcm(plaintext, dataKey, aad);
      const wrapCipher = createCipheriv('aes-256-gcm', this.testWrappingKey, wrapIv);
      wrapCipher.setAAD(aad);
      const wrapped = Buffer.concat([wrapCipher.update(dataKey), wrapCipher.final()]);
      const encryptedDataKey = Buffer.concat([wrapIv, wrapCipher.getAuthTag(), wrapped]).toString('base64');
      return {
        ciphertext: encrypted.ciphertext.toString('base64'),
        iv: encrypted.iv.toString('base64'),
        authTag: encrypted.authTag.toString('base64'),
        encryptedDataKey,
        keyProvider: 'TEST_AES_GCM',
        keyId: 'test-only-synthetic-key',
        keyVersion: 'test-v1',
        contextVersion: CONTEXT_VERSION,
      };
    } finally {
      dataKey.fill(0);
    }
  }

  async decrypt(record: EncryptedCorporateTin, applicationId: string): Promise<Buffer> {
    let dataKey: Buffer | undefined;
    try {
      if (record.keyProvider !== 'TEST_AES_GCM' || record.contextVersion !== CONTEXT_VERSION) throw failedClosed();
      const context = encryptionContext(applicationId, 'test');
      const aad = canonicalContext(context);
      const envelope = Buffer.from(record.encryptedDataKey, 'base64');
      if (envelope.length !== 60) throw failedClosed();
      const wrapDecipher = createDecipheriv('aes-256-gcm', this.testWrappingKey, envelope.subarray(0, 12));
      wrapDecipher.setAAD(aad);
      wrapDecipher.setAuthTag(envelope.subarray(12, 28));
      dataKey = Buffer.concat([wrapDecipher.update(envelope.subarray(28)), wrapDecipher.final()]);
      if (dataKey.length !== 32) throw failedClosed();
      return decryptAesGcm(
        Buffer.from(record.ciphertext, 'base64'),
        dataKey,
        Buffer.from(record.iv, 'base64'),
        Buffer.from(record.authTag, 'base64'),
        aad,
      );
    } catch {
      throw failedClosed();
    } finally {
      dataKey?.fill(0);
    }
  }
}

/** Converts nullable Prisma columns to the cryptographic adapter value object. */
export function encryptedCorporateTinFromColumns(value: {
  taxIdentificationNumberCiphertext: string | null;
  taxIdentificationNumberIv: string | null;
  taxIdentificationNumberAuthTag: string | null;
  taxIdentificationNumberEncryptedDataKey: string | null;
  taxIdentificationNumberKeyProvider: string | null;
  taxIdentificationNumberKeyId: string | null;
  taxIdentificationNumberKeyVersion: string | null;
  taxIdentificationNumberContextVersion: number | null;
}): EncryptedCorporateTin | null {
  const fields = [
    value.taxIdentificationNumberCiphertext,
    value.taxIdentificationNumberIv,
    value.taxIdentificationNumberAuthTag,
    value.taxIdentificationNumberEncryptedDataKey,
    value.taxIdentificationNumberKeyProvider,
    value.taxIdentificationNumberKeyId,
    value.taxIdentificationNumberKeyVersion,
    value.taxIdentificationNumberContextVersion,
  ];
  if (fields.every((field) => field === null)) return null;
  if (fields.some((field) => field === null || field === undefined) || value.taxIdentificationNumberContextVersion !== CONTEXT_VERSION) throw failedClosed();
  if (value.taxIdentificationNumberKeyProvider !== 'AWS_KMS' && value.taxIdentificationNumberKeyProvider !== 'TEST_AES_GCM') {
    throw failedClosed();
  }
  return {
    ciphertext: value.taxIdentificationNumberCiphertext!,
    iv: value.taxIdentificationNumberIv!,
    authTag: value.taxIdentificationNumberAuthTag!,
    encryptedDataKey: value.taxIdentificationNumberEncryptedDataKey!,
    keyProvider: value.taxIdentificationNumberKeyProvider,
    keyId: value.taxIdentificationNumberKeyId!,
    keyVersion: value.taxIdentificationNumberKeyVersion!,
    contextVersion: value.taxIdentificationNumberContextVersion as 1,
  };
}
