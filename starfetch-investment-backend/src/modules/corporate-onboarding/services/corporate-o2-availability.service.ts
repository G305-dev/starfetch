import { CanActivate, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

const AWS_IAM_ROLE_ARN = /^arn:(?:aws|aws-us-gov|aws-cn):iam::\d{12}:role\/[A-Za-z0-9+=,.@_/-]{1,512}$/;

@Injectable()
export class CorporateO2AvailabilityService {
  constructor(private readonly config: ConfigService) {}

  isAvailable(): boolean {
    const isVercel = this.config.get<boolean>('platform.isVercel') === true;
    const vercelEnvironment = this.config.get<string>('platform.vercelEnvironment');
    const roleArn = this.config.get<string>('corporate.o2.awsRoleArn');

    // Vercel Preview/Development must never write Corporate O2 envelopes into a
    // possibly shared Production database. O2 activation is Production-only there.
    if (isVercel && vercelEnvironment !== 'production') return false;

    // Vercel requires exact role-based OIDC. Elsewhere the AWS SDK default
    // provider chain may supply workload identity; AWS_ROLE_ARN is optional.
    if (isVercel && (!roleArn || !AWS_IAM_ROLE_ARN.test(roleArn))) return false;
    if (!isVercel && roleArn && !AWS_IAM_ROLE_ARN.test(roleArn)) return false;

    return this.config.get<boolean>('corporate.o2.enabled') === true &&
      this.config.get<boolean>('corporate.o2.lawfulBasisApproved') === true &&
      this.config.get<boolean>('corporate.o2.privacyNoticeApproved') === true &&
      this.config.get<boolean>('corporate.o2.retentionApproved') === true &&
      Boolean(this.config.get<string>('corporate.o2.kmsKeyId')) &&
      Boolean(this.config.get<string>('corporate.o2.kmsKeyVersion')) &&
      Boolean(this.config.get<string>('corporate.o2.awsRegion')) &&
      Boolean(this.config.get<string>('corporate.o2.hmacActiveVersion')) &&
      Boolean(this.config.get<string>('corporate.o2.hmacKeysJson')) &&
      Boolean(this.config.get<string>('corporate.o2.rateLimitRedisRestUrl')) &&
      Boolean(this.config.get<string>('corporate.o2.rateLimitRedisRestToken')) &&
      Boolean(this.config.get<string>('corporate.o2.rateLimitHmacSecret'));
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
