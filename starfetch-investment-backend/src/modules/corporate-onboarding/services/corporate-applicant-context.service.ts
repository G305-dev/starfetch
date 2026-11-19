import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { PrimaryAccountType, UserRole } from '@prisma/client';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

export interface CorporateApplicantContext {
  /** Always copied from the validated, session-bound auth principal. */
  readonly initiatingUserId: string;
  readonly role: typeof UserRole.INVESTOR;
}

@Injectable()
export class CorporateApplicantContextService {
  constructor(private readonly prisma: PrismaService) {}

  async requireVerifiedInvestor(
    principal: AuthPrincipal | null | undefined,
  ): Promise<CorporateApplicantContext> {
    if (!principal) {
      throw new HttpException(
        { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' },
        HttpStatus.UNAUTHORIZED,
      );
    }

    // Check the validated token role and current database role. The body can
    // never choose or override the initiating-user identity.
    if (principal.role !== UserRole.INVESTOR) {
      throw new HttpException(
        { code: ERROR_CODES.FORBIDDEN, message: 'You do not have access to this resource.' },
        HttpStatus.FORBIDDEN,
      );
    }

    const user = await this.prisma.user.findUnique({
      where: { id: principal.userId },
      select: {
        id: true,
        role: true,
        emailVerifiedAt: true,
        primaryAccountType: true,
        corporateApplicantProfile: { select: { id: true } },
        initiatedOnboardingApplications: {
          where: { kind: 'CORPORATE', ownerCorporateAccountId: { not: null } },
          select: { id: true },
          take: 1,
        },
      },
    });
    if (!user) {
      throw new HttpException(
        { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (user.role !== UserRole.INVESTOR) {
      throw new HttpException(
        { code: ERROR_CODES.FORBIDDEN, message: 'You do not have access to this resource.' },
        HttpStatus.FORBIDDEN,
      );
    }
    if (!user.emailVerifiedAt) {
      throw new HttpException(
        {
          code: ERROR_CODES.EMAIL_NOT_VERIFIED,
          message: 'Verify your email before accessing Corporate applications.',
        },
        HttpStatus.FORBIDDEN,
      );
    }

    // Registration classification is authoritative for new users. For legacy
    // rows only, allow unclassified access when the database proves Corporate
    // applicant identity (profile) or an existing initiator-owned Corporate
    // application. An Individual-only session never obtains Corporate access
    // by selecting a different portal in the browser.
    const hasCorporateEvidence = Boolean(user.corporateApplicantProfile) || (user.initiatedOnboardingApplications?.length ?? 0) > 0;
    if (user.primaryAccountType === PrimaryAccountType.INDIVIDUAL ||
        (user.primaryAccountType !== PrimaryAccountType.CORPORATE && !hasCorporateEvidence)) {
      throw new HttpException(
        { code: ERROR_CODES.FORBIDDEN, message: 'Corporate applications are not available for this account.' },
        HttpStatus.FORBIDDEN,
      );
    }

    return Object.freeze({ initiatingUserId: user.id, role: UserRole.INVESTOR });
  }
}
