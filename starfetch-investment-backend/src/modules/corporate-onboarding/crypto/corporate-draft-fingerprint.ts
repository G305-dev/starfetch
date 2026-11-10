import { createHash, createHmac } from 'crypto';
import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

/** Exact non-TIN shape accepted by the internal C1.1A bootstrap only. */
export interface CorporateDraftBootstrapPayload {
  institutionName: string;
  dateOfIncorporation: string;
  rcNumber: string;
  businessPhoneNumber: string;
  businessEmail: string;
}

export const CORPORATE_DRAFT_FINGERPRINT_KEY_PROVIDER = Symbol(
  'CORPORATE_DRAFT_FINGERPRINT_KEY_PROVIDER',
);

/**
 * Purpose-specific key port. This provider is for the non-TIN bootstrap only;
 * it must not be reused for auth secrets or the future six-field O2 payload.
 */
export interface CorporateDraftFingerprintKeyProvider {
  getNonTinBootstrapKey(): string | undefined;
}

@Injectable()
export class ConfigCorporateDraftFingerprintKeyProvider
  implements CorporateDraftFingerprintKeyProvider
{
  constructor(private readonly config: ConfigService) {}

  getNonTinBootstrapKey(): string | undefined {
    return this.config.get<string>('corporate.nonTinDraftFingerprintHmacSecret');
  }
}

@Injectable()
export class CorporateDraftPayloadFingerprinter {
  constructor(
    @Inject(CORPORATE_DRAFT_FINGERPRINT_KEY_PROVIDER)
    private readonly keys: CorporateDraftFingerprintKeyProvider,
  ) {}

  fingerprint(payload: CorporateDraftBootstrapPayload): string {
    const secret = this.keys.getNonTinBootstrapKey();
    if (!secret || Buffer.byteLength(secret, 'utf8') < 32) {
      // Fail closed before any database write. This internal capability is not
      // exposed as a controller and does not configure the production O2 route.
      throw new ServiceUnavailableException({
        code: 'INTERNAL_ERROR',
        message: 'Corporate draft bootstrap is unavailable.',
      });
    }

    // Stable, fixed-order, domain-separated payload. The type has no TIN field;
    // unexpected runtime properties are rejected instead of silently hashed.
    const expected = [
      'institutionName',
      'dateOfIncorporation',
      'rcNumber',
      'businessPhoneNumber',
      'businessEmail',
    ];
    const keys = Object.keys(payload);
    if (keys.length !== expected.length || expected.some((key) => !keys.includes(key))) {
      throw new ServiceUnavailableException({
        code: 'INTERNAL_ERROR',
        message: 'Corporate draft bootstrap is unavailable.',
      });
    }

    const canonical = JSON.stringify({
      institutionName: payload.institutionName,
      dateOfIncorporation: payload.dateOfIncorporation,
      rcNumber: payload.rcNumber,
      businessPhoneNumber: payload.businessPhoneNumber,
      businessEmail: payload.businessEmail,
    });
    return createHmac('sha256', secret)
      .update('starfetch:corporate-draft-bootstrap:non-tin:v1\n', 'utf8')
      .update(canonical, 'utf8')
      .digest('hex');
  }
}

/**
 * SHA-256 digest for the request's Idempotency-Key. It is purpose-separated,
 * user/operation scoped in the unique database key, and the raw key is never
 * persisted. This digest is not a payload fingerprint and contains no fields.
 */
export function digestCorporateDraftIdempotencyKey(
  initiatingUserId: string,
  operation: string,
  idempotencyKey: string,
): string {
  return createHash('sha256')
    .update('starfetch:corporate-draft-idempotency-key:v1\n', 'utf8')
    .update(initiatingUserId, 'utf8')
    .update('\n', 'utf8')
    .update(operation, 'utf8')
    .update('\n', 'utf8')
    .update(idempotencyKey, 'utf8')
    .digest('hex');
}
