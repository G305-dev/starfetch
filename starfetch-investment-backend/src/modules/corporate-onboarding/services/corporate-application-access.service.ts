import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { OnboardingApplication, OnboardingApplicationStatus, OnboardingApplicationKind } from '@prisma/client';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CorporateApplicantContext } from './corporate-applicant-context.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = {
  code: ERROR_CODES.NOT_FOUND,
  message: 'Application not found.',
} as const;

@Injectable()
export class CorporateApplicationAccessService {
  constructor(private readonly prisma: PrismaService) {}

  /** Ownership is re-proved from the immutable session-derived initiator. */
  async requireInitiatorOwnedCorporateApplication(
    applicant: CorporateApplicantContext,
    applicationId: string,
  ): Promise<OnboardingApplication> {
    if (!UUID_PATTERN.test(applicationId)) {
      throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const application = await this.prisma.onboardingApplication.findFirst({
      where: {
        id: applicationId,
        kind: OnboardingApplicationKind.CORPORATE,
        initiatingUserId: applicant.initiatingUserId,
        ownerCorporateAccountId: { not: null },
      },
    });
    if (!application) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    return application;
  }

  /**
   * Resolves the route's corporateAccountId to its distinct owned application.
   * Never treats a CorporateAccount UUID as an application UUID.
   */
  async requireInitiatorOwnedCorporateAccount(
    applicant: CorporateApplicantContext,
    corporateAccountId: string,
  ): Promise<OnboardingApplication> {
    if (!UUID_PATTERN.test(corporateAccountId)) {
      throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    }
    const application = await this.prisma.onboardingApplication.findFirst({
      where: {
        ownerCorporateAccountId: corporateAccountId,
        kind: OnboardingApplicationKind.CORPORATE,
        initiatingUserId: applicant.initiatingUserId,
      },
    });
    if (!application) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    return application;
  }

  /** Validate state only after ownership has been proved. */
  requireApplicationState(
    application: Pick<OnboardingApplication, 'status'>,
    allowed: readonly OnboardingApplicationStatus[],
  ): void {
    if (!allowed.includes(application.status)) {
      throw new HttpException(
        { code: ERROR_CODES.CONFLICT, message: 'This application cannot be changed in its current state.' },
        HttpStatus.CONFLICT,
      );
    }
  }

  /** Consistent generic 404 for missing or non-owned account contexts. */
  async requireOwnedInState(
    applicant: CorporateApplicantContext,
    applicationId: string,
    allowed: readonly OnboardingApplicationStatus[],
  ): Promise<OnboardingApplication> {
    const application = await this.requireInitiatorOwnedCorporateApplication(applicant, applicationId);
    this.requireApplicationState(application, allowed);
    return application;
  }
}
