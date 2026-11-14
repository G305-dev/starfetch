import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthModule } from '../auth/auth.module';
import { CorporateOnboardingModule } from '../corporate-onboarding/corporate-onboarding.module';
import {
  AwsKmsIndividualKycEncryptionProvider,
  INDIVIDUAL_KYC_ENCRYPTION,
} from './individual-kyc-encryption';
import {
  DisabledIndividualKycDocumentStorage,
  INDIVIDUAL_KYC_DOCUMENT_STORAGE,
} from './individual-kyc-document-ports';
import { S3CompatibleIndividualKycDocumentStorage } from './individual-kyc-s3-storage';
import { IndividualKycController } from './individual-kyc.controller';
import { IndividualKycGuard } from './individual-kyc.guard';
import { IndividualKycWorkerAuthGuard } from './individual-kyc-worker-auth';
import { IndividualKycWorkerController } from './individual-kyc-worker.controller';
import { IndividualKycWorkerService } from './individual-kyc-worker.service';
import { IndividualKycService } from './individual-kyc.service';

@Module({
  imports: [AuthModule, CorporateOnboardingModule],
  controllers: [IndividualKycController, IndividualKycWorkerController],
  providers: [
    IndividualKycService,
    IndividualKycWorkerService,
    IndividualKycGuard,
    IndividualKycWorkerAuthGuard,
    { provide: INDIVIDUAL_KYC_ENCRYPTION, useClass: AwsKmsIndividualKycEncryptionProvider },
    {
      provide: INDIVIDUAL_KYC_DOCUMENT_STORAGE,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const allowed = config.get<boolean>('individualKyc.s3.enabled') === true &&
          config.get<boolean>('individualKyc.documentUploadEnabled') === true &&
          config.get<boolean>('individualKyc.scannerWorkerEnabled') === true &&
          config.get<boolean>('individualKyc.dataResidencyApproved') === true &&
          config.get<boolean>('individualKyc.s3.storageResidencyApproved') === true &&
          config.get<boolean>('individualKyc.s3.privateBucketApproved') === true &&
          config.get<boolean>('individualKyc.s3.tlsPolicyApproved') === true &&
          config.get<boolean>('individualKyc.s3.retentionApproved') === true &&
          config.get<boolean>('individualKyc.scanner.residencyApproved') === true;
        if (!allowed) return new DisabledIndividualKycDocumentStorage();
        return new S3CompatibleIndividualKycDocumentStorage({
          enabled: true,
          endpoint: config.get<string>('individualKyc.s3.endpoint'),
          bucket: config.get<string>('individualKyc.s3.bucket'),
          region: config.get<string>('individualKyc.s3.region'),
          credentialReference: config.get<string>('individualKyc.s3.credentialReference'),
          forcePathStyle: config.get<boolean>('individualKyc.s3.forcePathStyle') ?? true,
          residencyApproved: true,
          privateBucketApproved: true,
          tlsPolicyApproved: true,
          isVercel: config.get<boolean>('platform.isVercel') === true,
          roleArn: config.get<string>('individualKyc.awsRoleArn'),
        });
      },
    },
  ],
  exports: [IndividualKycService],
})
export class IndividualKycModule {}
