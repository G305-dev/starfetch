import { Inject, Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  CORPORATE_TIN_ENCRYPTION_PROVIDER,
  CorporateTinEncryptionProvider,
  encryptedCorporateTinFromColumns,
} from '../crypto/corporate-tin-encryption';
import { CorporateO2AvailabilityService } from './corporate-o2-availability.service';

export type CorporateTinCipherColumns = Parameters<typeof encryptedCorporateTinFromColumns>[0];

/** Dedicated decryption boundary. Callers receive only a masked projection. */
@Injectable()
export class CorporateTinReadService {
  constructor(
    @Inject(CORPORATE_TIN_ENCRYPTION_PROVIDER)
    private readonly encryption: CorporateTinEncryptionProvider,
    private readonly availability: CorporateO2AvailabilityService,
  ) {}

  async maskedProjection(applicationId: string, columns: CorporateTinCipherColumns): Promise<string | null> {
    // Do not inspect or decrypt stored envelope columns before every privacy/KMS
    // activation prerequisite is ready.
    if (!this.availability.isAvailable()) return null;
    const envelope = encryptedCorporateTinFromColumns(columns);
    if (!envelope) return null;
    let plaintext: Buffer | undefined;
    try {
      plaintext = await this.encryption.decrypt(envelope, applicationId);
      const characters = Array.from(plaintext.toString('utf8'));
      if (characters.length === 0) throw new Error('invalid plaintext');

      // Keep short identifiers from being mostly or completely exposed. Values
      // up to eight code points share a constant mask; longer values reveal at
      // most 25% of their suffix, capped at four code points.
      if (characters.length <= 8) return '••••';
      const visibleSuffixLength = Math.min(4, Math.floor(characters.length / 4));
      return `${'•'.repeat(characters.length - visibleSuffixLength)}${characters.slice(-visibleSuffixLength).join('')}`;
    } catch {
      throw new ServiceUnavailableException({
        code: 'SERVICE_UNAVAILABLE',
        message: 'Corporate details are temporarily unavailable.',
      });
    } finally {
      plaintext?.fill(0);
    }
  }
}
