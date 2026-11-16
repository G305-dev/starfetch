import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CorporateOnboardingModule } from '../corporate-onboarding/corporate-onboarding.module';
import { DashboardController } from './dashboard.controller';
import { DashboardService } from './dashboard.service';
import { MeController } from './me.controller';
import { ProfileController } from './profile.controller';
import { ProfileService } from './profile.service';
import { KycCompletionService } from './kyc-completion.service';

@Module({
  imports: [AuthModule, CorporateOnboardingModule],
  controllers: [MeController, ProfileController, DashboardController],
  providers: [ProfileService, DashboardService, KycCompletionService],
})
export class MeModule {}
