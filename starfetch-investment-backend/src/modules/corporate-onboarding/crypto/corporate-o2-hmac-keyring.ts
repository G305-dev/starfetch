import { createHmac } from 'crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const CORPORATE_O2_HMAC_KEYRING = Symbol('CORPORATE_O2_HMAC_KEYRING');

export interface CorporateO2HmacKey {
  readonly version: string;
  readonly key: Buffer;
}

export interface CorporateO2HmacKeyring {
  readonly activeVersion: string;
  /** Keep prior versions available for idempotency/duplicate detection through retention. */
  readonly keys: readonly CorporateO2HmacKey[];
}

export interface CorporateO2Payload {
  readonly institutionName: string;
  readonly dateOfIncorporation: string;
  readonly rcNumber: string;
  readonly taxIdentificationNumber: string;
  readonly businessPhoneNumber: string;
  readonly businessEmail: string;
}

export interface VersionedDigest {
  readonly keyVersion: string;
  readonly digest: string;
}

@Injectable()
export class ConfigCorporateO2HmacKeyring implements CorporateO2HmacKeyring {
  constructor(private readonly config: ConfigService) {}

  get activeVersion(): string {
    return this.read().activeVersion;
  }

  get keys(): readonly CorporateO2HmacKey[] {
    return this.read().keys;
  }

  private read(): { activeVersion: string; keys: CorporateO2HmacKey[] } {
    try {
      const activeVersion = this.config.get<string>('corporate.o2.hmacActiveVersion');
      const serialized = this.config.get<string>('corporate.o2.hmacKeysJson');
      if (!activeVersion || !serialized) throw new Error('missing');
      const parsed: unknown = JSON.parse(serialized);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
      const keys = Object.entries(parsed as Record<string, unknown>).map(([version, encoded]) => {
        if (!/^[A-Za-z0-9._-]{1,32}$/.test(version) || typeof encoded !== 'string') throw new Error('invalid');
        const key = Buffer.from(encoded, 'base64');
        if (key.length < 32 || key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) throw new Error('invalid');
        return { version, key };
      });
      if (!keys.some(({ version }) => version === activeVersion)) throw new Error('active key absent');
      return { activeVersion, keys };
    } catch {
      throw unavailable();
    }
  }
}

/** Payload HMAC includes all six normalized fields, including TIN, never persists plaintext. */
export function corporateO2PayloadDigests(payload: CorporateO2Payload, keyring: CorporateO2HmacKeyring): VersionedDigest[] {
  const canonical = JSON.stringify({
    institutionName: payload.institutionName,
    dateOfIncorporation: payload.dateOfIncorporation,
    rcNumber: payload.rcNumber,
    taxIdentificationNumber: payload.taxIdentificationNumber,
    businessPhoneNumber: payload.businessPhoneNumber,
    businessEmail: payload.businessEmail,
  });
  return keyring.keys.map(({ version, key }) => ({
    keyVersion: version,
    digest: mac(key, 'payload-fingerprint', canonical),
  }));
}

/** Raw Idempotency-Key is purpose-separated, user/operation-scoped and never stored. */
export function corporateO2IdempotencyDigests(
  userId: string,
  operation: string,
  rawKey: string,
  keyring: CorporateO2HmacKeyring,
): VersionedDigest[] {
  const material = JSON.stringify({ userId, operation, rawKey });
  return keyring.keys.map(({ version, key }) => ({
    keyVersion: version,
    digest: mac(key, 'idempotency-key', material),
  }));
}

function mac(rootKey: Buffer, purpose: string, material: string): string {
  const derivedKey = createHmac('sha256', rootKey)
    .update(`starfetch:corporate-o2:key-derivation:v1:${purpose}`, 'utf8')
    .digest();
  return createHmac('sha256', derivedKey)
    .update(`starfetch:corporate-o2:${purpose}:v1\n`, 'utf8')
    .update(material, 'utf8')
    .digest('hex');
}

function unavailable(): ServiceUnavailableException {
  return new ServiceUnavailableException({
    code: 'SERVICE_UNAVAILABLE',
    message: 'Corporate registration is temporarily unavailable.',
  });
}
