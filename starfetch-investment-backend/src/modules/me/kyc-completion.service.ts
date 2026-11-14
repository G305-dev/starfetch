import { Injectable, Logger } from '@nestjs/common';
import { OnboardingApplicationKind, OnboardingApplicationStatus, UserRole } from '@prisma/client';
import { AuthPrincipal } from '../../common/types/auth-principal';
import { PrismaService } from '../../infrastructure/database/prisma.service';
import { CorporateInvestmentEligibilityService } from '../corporate-onboarding/services/corporate-investment-eligibility.service';

export type KycCompletionValue = 'REQUIRED' | 'COMPLETE';

export interface KycCompletionStatus {
  readonly individual: KycCompletionValue;
  readonly corporate: KycCompletionValue;
}

const REQUIRED: KycCompletionStatus = Object.freeze({
  individual: 'REQUIRED',
  corporate: 'REQUIRED',
});

/**
 * Read-only completion projection for GET /me.
 *
 * Individual has no implemented final KYC approval source in this backend, so
 * it remains REQUIRED. Corporate can be COMPLETE only when every Corporate
 * application initiated by this authenticated user passes the existing
 * current-snapshot, approved-ruleset, completed-evidence, approved-application
 * and independent-final-compliance gate. This projection never grants access.
 */
@Injectable()
export class KycCompletionService {
  private readonly logger = new Logger(KycCompletionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly corporateEligibility: CorporateInvestmentEligibilityService,
  ) {}

  async forPrincipal(
    principal: AuthPrincipal,
    context: { readonly role: UserRole; readonly emailVerifiedAt: Date | null },
  ): Promise<KycCompletionStatus> {
    if (principal.role !== UserRole.INVESTOR || context.role !== UserRole.INVESTOR || !context.emailVerifiedAt) {
      return REQUIRED;
    }

    try {
      const applications = await this.prisma.onboardingApplication.findMany({
        where: {
          kind: OnboardingApplicationKind.CORPORATE,
          initiatingUserId: principal.userId,
          ownerCorporateAccountId: { not: null },
        },
        select: { id: true, status: true },
      });

      // No associated Corporate application, or any unfinished/rejected sibling,
      // is not evidence of completed KYC/KYB for the user's overall context.
      if (applications.length === 0 || applications.some((app) => app.status !== OnboardingApplicationStatus.APPROVED)) {
        return REQUIRED;
      }

      const assessments = await Promise.all(
        applications.map((app) => this.corporateEligibility.assess(principal, app.id)),
      );
      if (!assessments.every((assessment) => assessment.eligible)) return REQUIRED;
      return { individual: 'REQUIRED', corporate: 'COMPLETE' };
    } catch {
      // A failed/uncertain evidence read is not completion. Keep the safe
      // public response shape and log no applicant or verification details.
      this.logger.warn('KYC completion evidence could not be confirmed; returning REQUIRED.');
      return REQUIRED;
    }
  }
}
