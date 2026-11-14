import { DecryptCommand, GenerateDataKeyCommand, KMSClient } from '@aws-sdk/client-kms';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

export const INDIVIDUAL_KYC_ENCRYPTION = Symbol('INDIVIDUAL_KYC_ENCRYPTION');
const CONTEXT_VERSION = 1 as const;
const UNAVAILABLE = {
  code: 'FEATURE_UNAVAILABLE',
  message: 'Individual KYC encryption is unavailable until the dedicated KMS key and data-residency approval are configured.',
} as const;

export interface IndividualKycEncryptedPayload {
  readonly encryptedPayload: string;
  readonly payloadIv: string;
  readonly payloadAuthTag: string;
  readonly encryptedDataKey: string;
  readonly encryptionKeyProvider: 'AWS_KMS' | 'TEST_AES_GCM';
  readonly encryptionKeyId: string;
  readonly encryptionKeyVersion: string;
  readonly encryptionContextVersion: 1;
}

export interface IndividualKycEncryptionProvider {
  encrypt(plaintext: string, profileId: string, investorUserId: string): Promise<IndividualKycEncryptedPayload>;
  decrypt(envelope: IndividualKycEncryptedPayload, profileId: string, investorUserId: string): Promise<Buffer>;
}

function deploymentEnvironment(config: ConfigService): string {
  if (config.get<boolean>('platform.isVercel') === true) {
    return config.get<string>('platform.vercelEnvironment') ?? 'development';
  }
  return config.get<string>('nodeEnv') ?? 'development';
}

/** KMS context is purpose-separated from Corporate TIN and contains no customer identifiers. */
function kmsContext(environment: string): Record<string, string> {
  return {
    purpose: 'starfetch:individual-kyc-profile:v1',
    environment,
    contextVersion: String(CONTEXT_VERSION),
  };
}

/** AES-GCM AAD binds ciphertext to its owner/profile so envelopes cannot be swapped. */
function aad(profileId: string, investorUserId: string, environment: string): Buffer {
  return Buffer.from(JSON.stringify({
    contextVersion: CONTEXT_VERSION,
    environment,
    investorUserId,
    profileId,
    purpose: 'starfetch:individual-kyc-profile:payload:v1',
  }), 'utf8');
}

function sortedContext(context: Record<string, string>): Buffer {
  return Buffer.from(JSON.stringify(Object.fromEntries(Object.entries(context).sort(([a], [b]) => a.localeCompare(b)))), 'utf8');
}

function seal(plaintext: string, dataKey: Buffer, additionalData: Buffer) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', dataKey, iv);
  cipher.setAAD(additionalData);
  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  return { ciphertext, iv, authTag: cipher.getAuthTag() };
}

function open(envelope: IndividualKycEncryptedPayload, dataKey: Buffer, additionalData: Buffer): Buffer {
  const decipher = createDecipheriv('aes-256-gcm', dataKey, Buffer.from(envelope.payloadIv, 'base64'));
  decipher.setAAD(additionalData);
  decipher.setAuthTag(Buffer.from(envelope.payloadAuthTag, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(envelope.encryptedPayload, 'base64')),
    decipher.final(),
  ]);
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException(UNAVAILABLE);
}

function wipe(bytes: Uint8Array | undefined): void {
  bytes?.fill(0);
}

/** Production envelope encryption. The KMS key is dedicated to Individual KYC and never falls back to the Corporate TIN key. */
@Injectable()
export class AwsKmsIndividualKycEncryptionProvider implements IndividualKycEncryptionProvider {
  constructor(
    private readonly config: ConfigService,
    @Inject(KMSClient) private readonly kms: KMSClient,
  ) {}

  async encrypt(plaintext: string, profileId: string, investorUserId: string): Promise<IndividualKycEncryptedPayload> {
    let kmsPlaintext: Uint8Array | undefined;
    let dataKey: Buffer | undefined;
    try {
      const keyId = this.config.get<string>('individualKyc.kmsKeyId');
      const keyVersion = this.config.get<string>('individualKyc.kmsKeyVersion');
      if (this.config.get<boolean>('individualKyc.dataResidencyApproved') !== true || !keyId || !keyVersion || !plaintext) throw unavailable();
      const environment = deploymentEnvironment(this.config);
      const context = kmsContext(environment);
      const generated = await this.kms.send(new GenerateDataKeyCommand({ KeyId: keyId, KeySpec: 'AES_256', EncryptionContext: context }));
      kmsPlaintext = generated.Plaintext;
      if (!kmsPlaintext || kmsPlaintext.byteLength !== 32 || !generated.CiphertextBlob) throw unavailable();
      dataKey = Buffer.from(kmsPlaintext);
      wipe(kmsPlaintext);
      kmsPlaintext = undefined;
      const encrypted = seal(plaintext, dataKey, aad(profileId, investorUserId, environment));
      return {
        encryptedPayload: encrypted.ciphertext.toString('base64'),
        payloadIv: encrypted.iv.toString('base64'),
        payloadAuthTag: encrypted.authTag.toString('base64'),
        encryptedDataKey: Buffer.from(generated.CiphertextBlob).toString('base64'),
        encryptionKeyProvider: 'AWS_KMS',
        encryptionKeyId: generated.KeyId ?? keyId,
        encryptionKeyVersion: keyVersion,
        encryptionContextVersion: CONTEXT_VERSION,
      };
    } catch {
      throw unavailable();
    } finally {
      wipe(kmsPlaintext);
      dataKey?.fill(0);
    }
  }

  async decrypt(envelope: IndividualKycEncryptedPayload, profileId: string, investorUserId: string): Promise<Buffer> {
    let kmsPlaintext: Uint8Array | undefined;
    let dataKey: Buffer | undefined;
    try {
      if (this.config.get<boolean>('individualKyc.dataResidencyApproved') !== true ||
        envelope.encryptionKeyProvider !== 'AWS_KMS' || envelope.encryptionContextVersion !== CONTEXT_VERSION ||
        !envelope.encryptionKeyId || !envelope.encryptionKeyVersion) throw unavailable();
      const environment = deploymentEnvironment(this.config);
      const unwrapped = await this.kms.send(new DecryptCommand({
        KeyId: envelope.encryptionKeyId,
        CiphertextBlob: Buffer.from(envelope.encryptedDataKey, 'base64'),
        EncryptionContext: kmsContext(environment),
      }));
      kmsPlaintext = unwrapped.Plaintext;
      if (!kmsPlaintext || kmsPlaintext.byteLength !== 32) throw unavailable();
      dataKey = Buffer.from(kmsPlaintext);
      wipe(kmsPlaintext);
      kmsPlaintext = undefined;
      return open(envelope, dataKey, aad(profileId, investorUserId, environment));
    } catch {
      throw unavailable();
    } finally {
      wipe(kmsPlaintext);
      dataKey?.fill(0);
    }
  }
}

/** Synthetic envelope provider; constructor refuses every non-test runtime. */
export class TestIndividualKycEncryptionProvider implements IndividualKycEncryptionProvider {
  constructor(private readonly nodeEnv: string, private readonly wrappingKey: Buffer) {
    if (nodeEnv !== 'test') throw new Error('Synthetic Individual KYC encryption is test-only.');
    if (wrappingKey.length !== 32) throw new Error('Synthetic test wrapping key must be 32 bytes.');
  }

  async encrypt(plaintext: string, profileId: string, investorUserId: string): Promise<IndividualKycEncryptedPayload> {
    if (this.nodeEnv !== 'test' || !plaintext) throw unavailable();
    const dataKey = randomBytes(32);
    const environment = 'test';
    const additionalData = aad(profileId, investorUserId, environment);
    const context = sortedContext(kmsContext(environment));
    const wrapIv = randomBytes(12);
    try {
      const encrypted = seal(plaintext, dataKey, additionalData);
      const wrapCipher = createCipheriv('aes-256-gcm', this.wrappingKey, wrapIv);
      wrapCipher.setAAD(context);
      const wrappedKey = Buffer.concat([wrapCipher.update(dataKey), wrapCipher.final()]);
      return {
        encryptedPayload: encrypted.ciphertext.toString('base64'),
        payloadIv: encrypted.iv.toString('base64'),
        payloadAuthTag: encrypted.authTag.toString('base64'),
        encryptedDataKey: Buffer.concat([wrapIv, wrapCipher.getAuthTag(), wrappedKey]).toString('base64'),
        encryptionKeyProvider: 'TEST_AES_GCM',
        encryptionKeyId: 'synthetic-individual-kyc-test-key',
        encryptionKeyVersion: 'test-v1',
        encryptionContextVersion: CONTEXT_VERSION,
      };
    } finally {
      dataKey.fill(0);
    }
  }

  async decrypt(envelope: IndividualKycEncryptedPayload, profileId: string, investorUserId: string): Promise<Buffer> {
    let dataKey: Buffer | undefined;
    try {
      if (this.nodeEnv !== 'test' || envelope.encryptionKeyProvider !== 'TEST_AES_GCM' || envelope.encryptionContextVersion !== CONTEXT_VERSION) throw unavailable();
      const wrapped = Buffer.from(envelope.encryptedDataKey, 'base64');
      if (wrapped.length !== 60) throw unavailable();
      const environment = 'test';
      const context = sortedContext(kmsContext(environment));
      const decipher = createDecipheriv('aes-256-gcm', this.wrappingKey, wrapped.subarray(0, 12));
      decipher.setAAD(context);
      decipher.setAuthTag(wrapped.subarray(12, 28));
      dataKey = Buffer.concat([decipher.update(wrapped.subarray(28)), decipher.final()]);
      if (dataKey.length !== 32) throw unavailable();
      return open(envelope, dataKey, aad(profileId, investorUserId, environment));
    } catch {
      throw unavailable();
    } finally {
      dataKey?.fill(0);
    }
  }
}
