import { createHmac } from 'crypto';
import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export const VERIFICATION_OPERATION_KEYRING = Symbol('VERIFICATION_OPERATION_KEYRING');

export interface VerificationOperationKeyring {
  readonly activeVersion: string;
  readonly keys: readonly { readonly version: string; readonly key: Buffer }[];
}

export interface VersionedVerificationDigest {
  readonly keyVersion: string;
  readonly digest: string;
}

@Injectable()
export class ConfigVerificationOperationKeyring implements VerificationOperationKeyring {
  constructor(private readonly config: ConfigService) {}

  get activeVersion(): string {
    return this.read().activeVersion;
  }

  get keys(): readonly { readonly version: string; readonly key: Buffer }[] {
    return this.read().keys;
  }

  private read(): { activeVersion: string; keys: { version: string; key: Buffer }[] } {
    try {
      const activeVersion = this.config.get<string>('verification.operationHmacActiveVersion');
      const serialized = this.config.get<string>('verification.operationHmacKeysJson');
      if (!activeVersion || !serialized) throw new Error('missing');
      const parsed: unknown = JSON.parse(serialized);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error('invalid');
      const keys = Object.entries(parsed as Record<string, unknown>).map(([version, encoded]) => {
        if (!/^[A-Za-z0-9._-]{1,32}$/.test(version) || typeof encoded !== 'string') throw new Error('invalid');
        const key = Buffer.from(encoded, 'base64');
        if (key.length < 32 || key.toString('base64').replace(/=+$/, '') !== encoded.replace(/=+$/, '')) throw new Error('invalid');
        return { version, key };
      });
      if (!keys.some((candidate) => candidate.version === activeVersion)) throw new Error('active key missing');
      return { activeVersion, keys };
    } catch {
      throw new ServiceUnavailableException({
        code: 'FEATURE_UNAVAILABLE',
        message: 'Verification operation security configuration is unavailable.',
      });
    }
  }
}

/** Purpose-separated, rotating HMAC digests; neither the input key nor root key is persisted. */
export function verificationOperationDigests(
  keyring: VerificationOperationKeyring,
  purpose: 'consent-operation' | 'provider-operation',
  scope: Readonly<Record<string, string>>,
  rawOperationKey: string,
): VersionedVerificationDigest[] {
  if (typeof rawOperationKey !== 'string' || rawOperationKey.length < 16 || rawOperationKey.length > 256) {
    throw new Error('Invalid verification operation key.');
  }
  const material = JSON.stringify({ scope, rawOperationKey });
  return keyring.keys.map(({ version, key }) => {
    const derived = createHmac('sha256', key)
      .update(`starfetch:verification:key-derivation:v1:${purpose}`, 'utf8')
      .digest();
    const digest = createHmac('sha256', derived)
      .update(`starfetch:verification:${purpose}:v1\n`, 'utf8')
      .update(version, 'utf8')
      .update('\n', 'utf8')
      .update(material, 'utf8')
      .digest('hex');
    return { keyVersion: version, digest };
  });
}
