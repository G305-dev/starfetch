import { CanActivate, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class CorporateO2AvailabilityService {
  constructor(private readonly config: ConfigService) {}

  isAvailable(): boolean {
    return this.config.get<boolean>('corporate.o2.enabled') === true &&
      this.config.get<boolean>('corporate.o2.lawfulBasisApproved') === true &&
      this.config.get<boolean>('corporate.o2.privacyNoticeApproved') === true &&
      this.config.get<boolean>('corporate.o2.retentionApproved') === true &&
      Boolean(this.config.get<string>('corporate.o2.kmsKeyId')) &&
      Boolean(this.config.get<string>('corporate.o2.kmsKeyVersion')) &&
      Boolean(this.config.get<string>('corporate.o2.awsRegion')) &&
      Boolean(this.config.get<string>('corporate.o2.hmacActiveVersion')) &&
      Boolean(this.config.get<string>('corporate.o2.hmacKeysJson'));
  }

  requireAvailable(): void {
    if (!this.isAvailable()) {
      throw new HttpException(
        { code: 'FEATURE_UNAVAILABLE', message: 'Corporate registration is currently unavailable.' },
        HttpStatus.SERVICE_UNAVAILABLE,
      );
    }
  }
}

/** Runs before auth so the disabled-by-default feature consistently returns safe 503. */
@Injectable()
export class CorporateO2ActivationGuard implements CanActivate {
  constructor(private readonly availability: CorporateO2AvailabilityService) {}

  canActivate(): boolean {
    this.availability.requireAvailable();
    return true;
  }
}
