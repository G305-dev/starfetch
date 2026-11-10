import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from './config/configuration';
import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './infrastructure/database/database.module';
import { AuthModule } from './modules/auth/auth.module';
import { HealthModule } from './modules/health/health.module';
import { JointModule } from './modules/joint/joint.module';
import { MeModule } from './modules/me/me.module';
import { CorporateOnboardingModule } from './modules/corporate-onboarding/corporate-onboarding.module';
import { VerificationRulesetsModule } from './modules/verification-rulesets/verification-rulesets.module';
import { MonoVerificationModule } from './modules/verification-providers/mono/mono-verification.module';
import { VerificationDocumentsModule } from './modules/verification-documents/verification-documents.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validate: validateEnv,
      cache: true,
    }),
    DatabaseModule,
    HealthModule,
    AuthModule,
    MeModule,
    JointModule,
    CorporateOnboardingModule,
    VerificationRulesetsModule,
    MonoVerificationModule,
    VerificationDocumentsModule,
  ],
})
export class AppModule {}
