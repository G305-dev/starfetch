import { DecryptCommand, GenerateDataKeyCommand, KMSClient } from '@aws-sdk/client-kms';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export interface EncryptedCorporateBankAccount {
  ciphertext: string;
  iv: string;
  authTag: string;
  encryptedDataKey: string;
  keyProvider: 'AWS_KMS';
  keyId: string;
  keyVersion: string;
  contextVersion: 1;
}

const CONTEXT_VERSION = 1 as const;
const unavailable = () => new ServiceUnavailableException({
  code: 'SERVICE_UNAVAILABLE', message: 'Corporate bank details are temporarily unavailable.',
});

function context(applicationId: string, environment: string): Record<string, string> {
  return {
    applicationId,
    contextVersion: String(CONTEXT_VERSION),
    environment,
    field: 'bankAccountNumber',
    purpose: 'starfetch:corporate-profile:bank-account:v1',
  };
}
function aad(value: Record<string, string>): Buffer {
  return Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(value).sort(([a], [b]) => a.localeCompare(b)))), 'utf8');
}
function env(config: ConfigService): string {
  if (config.get<boolean>('platform.isVercel') === true) return config.get<string>('platform.vercelEnvironment') ?? 'development';
  return config.get<string>('nodeEnv') ?? 'development';
}

/** Dedicated KMS key + purpose/context; never reuses the Corporate O2 TIN key. */
@Injectable()
export class CorporateBankAccountEncryptionService {
  constructor(private readonly config: ConfigService, @Inject(KMSClient) private readonly kms: KMSClient) {}

  async encrypt(accountNumber: string, applicationId: string): Promise<EncryptedCorporateBankAccount> {
    let plaintextKey: Uint8Array | undefined;
    let key: Buffer | undefined;
    try {
      const keyId = this.config.get<string>('corporate.bank.kmsKeyId');
      const keyVersion = this.config.get<string>('corporate.bank.kmsKeyVersion');
      if (!keyId || !keyVersion || !/^\d{10}$/.test(accountNumber)) throw unavailable();
      const encryptionContext = context(applicationId, env(this.config));
      const generated = await this.kms.send(new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: 'AES_256', EncryptionContext: encryptionContext }));
      plaintextKey = generated.Plaintext;
      if (!plaintextKey || plaintextKey.byteLength !== 32 || !generated.CiphertextBlob) throw unavailable();
      key = Buffer.from(plaintextKey);
      plaintextKey.fill(0);
      plaintextKey = undefined;
      const iv = randomBytes(12);
      const cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(aad(encryptionContext));
      const ciphertext = Buffer.concat([cipher.update(accountNumber, 'utf8'), cipher.final()]);
      return {
        ciphertext: ciphertext.toString('base64'),
        iv: iv.toString('base64'),
        authTag: cipher.getAuthTag().toString('base64'),
        encryptedDataKey: Buffer.from(generated.CiphertextBlob).toString('base64'),
        keyProvider: 'AWS_KMS',
        keyId: generated.KeyId ?? keyId,
        keyVersion,
        contextVersion: CONTEXT_VERSION,
      };
    } catch {
      throw unavailable();
    } finally {
      plaintextKey?.fill(0);
      key?.fill(0);
    }
  }

  async mask(envelope: EncryptedCorporateBankAccount | null, applicationId: string): Promise<string | null> {
    if (!envelope) return null;
    let plaintextKey: Uint8Array | undefined;
    let key: Buffer | undefined;
    let plaintext: Buffer | undefined;
    try {
      if (envelope.keyProvider !== 'AWS_KMS' || envelope.contextVersion !== CONTEXT_VERSION) throw unavailable();
      const encryptionContext = context(applicationId, env(this.config));
      const unwrapped = await this.kms.send(new DecryptCommand({
        KeyId: envelope.keyId,
        CiphertextBlob: Buffer.from(envelope.encryptedDataKey, 'base64'),
        EncryptionContext: encryptionContext,
      }));
      plaintextKey = unwrapped.Plaintext;
      if (!plaintextKey || plaintextKey.byteLength !== 32) throw unavailable();
      key = Buffer.from(plaintextKey);
      plaintextKey.fill(0);
      plaintextKey = undefined;
      const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(envelope.iv, 'base64'));
      decipher.setAAD(aad(encryptionContext));
      decipher.setAuthTag(Buffer.from(envelope.authTag, 'base64'));
      plaintext = Buffer.concat([decipher.update(Buffer.from(envelope.ciphertext, 'base64')), decipher.final()]);
      const value = plaintext.toString('utf8');
      if (!/^\d{10}$/.test(value)) throw unavailable();
      return `••••••${value.slice(-4)}`;
    } catch {
      throw unavailable();
    } finally {
      plaintextKey?.fill(0);
      key?.fill(0);
      plaintext?.fill(0);
    }
  }
}

export function bankEnvelopeFromColumns(value: {
  bankAccountNumberCiphertext: string | null;
  bankAccountNumberIv: string | null;
  bankAccountNumberAuthTag: string | null;
  bankAccountNumberEncryptedDataKey: string | null;
  bankAccountNumberKeyProvider: string | null;
  bankAccountNumberKeyId: string | null;
  bankAccountNumberKeyVersion: string | null;
  bankAccountNumberContextVersion: number | null;
}): EncryptedCorporateBankAccount | null {
  const parts = [value.bankAccountNumberCiphertext, value.bankAccountNumberIv, value.bankAccountNumberAuthTag,
    value.bankAccountNumberEncryptedDataKey, value.bankAccountNumberKeyProvider, value.bankAccountNumberKeyId,
    value.bankAccountNumberKeyVersion, value.bankAccountNumberContextVersion];
  if (parts.every((part) => part === null)) return null;
  if (parts.some((part) => part === null) || value.bankAccountNumberKeyProvider !== 'AWS_KMS' || value.bankAccountNumberContextVersion !== 1) throw unavailable();
  return {
    ciphertext: value.bankAccountNumberCiphertext!, iv: value.bankAccountNumberIv!, authTag: value.bankAccountNumberAuthTag!,
    encryptedDataKey: value.bankAccountNumberEncryptedDataKey!, keyProvider: 'AWS_KMS', keyId: value.bankAccountNumberKeyId!,
    keyVersion: value.bankAccountNumberKeyVersion!, contextVersion: 1,
  };
}
