import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import { OnboardingApplicationKind } from '@prisma/client';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NOT_FOUND = { code: ERROR_CODES.NOT_FOUND, message: 'Application not found.' } as const;
const UNAUTHENTICATED = { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' } as const;

export type SnapshotFreshnessIssue =
  | 'SNAPSHOT_MISSING'
  | 'ACCOUNT_KIND_CHANGED'
  | 'CORPORATE_DETAILS_VERSION_CHANGED'
  | 'JOINT_MEMBERSHIP_VERSION_CHANGED';

export interface ApplicationVerificationSnapshotFreshness {
  readonly applicationId: string;
  readonly snapshotId: string | null;
  readonly generation: number | null;
  readonly isFresh: boolean;
  readonly issues: readonly SnapshotFreshnessIssue[];
}

/**
 * Read-only C1.4 safety check for mutable source context. It never modifies an
 * immutable snapshot and is not an eligibility or submission endpoint.
 */
@Injectable()
export class ApplicationVerificationSnapshotFreshnessService {
  constructor(private readonly prisma: PrismaService) {}

  async assess(
    principal: AuthPrincipal | null | undefined,
    applicationId: string,
  ): Promise<ApplicationVerificationSnapshotFreshness> {
    if (!principal || !UUID_PATTERN.test(principal.userId) || !principal.sessionId) {
      throw new HttpException(UNAUTHENTICATED, HttpStatus.UNAUTHORIZED);
    }
    if (!UUID_PATTERN.test(applicationId)) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);

    const application = await this.prisma.onboardingApplication.findFirst({
      where: {
        id: applicationId,
        OR: [
          { kind: OnboardingApplicationKind.INDIVIDUAL, ownerUserId: principal.userId },
          { kind: OnboardingApplicationKind.JOINT, jointOwner: { members: { some: { userId: principal.userId } } } },
          { kind: OnboardingApplicationKind.CORPORATE, initiatingUserId: principal.userId },
        ],
      },
      select: {
        id: true,
        kind: true,
        corporateDetails: { select: { version: true } },
        jointOwner: { select: { membershipVersion: true } },
        verificationSnapshots: {
          orderBy: { generation: 'desc' },
          take: 1,
          select: {
            id: true,
            generation: true,
            accountKind: true,
            corporateDetailsVersion: true,
            jointMembershipVersion: true,
          },
        },
      },
    });
    if (!application) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);

    const snapshot = application.verificationSnapshots[0] ?? null;
    if (!snapshot) {
      return { applicationId: application.id, snapshotId: null, generation: null, isFresh: false, issues: ['SNAPSHOT_MISSING'] };
    }
    const issues: SnapshotFreshnessIssue[] = [];
    if (snapshot.accountKind !== application.kind) issues.push('ACCOUNT_KIND_CHANGED');
    if (application.kind === OnboardingApplicationKind.CORPORATE &&
      snapshot.corporateDetailsVersion !== (application.corporateDetails?.version ?? null)) {
      issues.push('CORPORATE_DETAILS_VERSION_CHANGED');
    }
    if (application.kind === OnboardingApplicationKind.JOINT &&
      snapshot.jointMembershipVersion !== (application.jointOwner?.membershipVersion ?? null)) {
      issues.push('JOINT_MEMBERSHIP_VERSION_CHANGED');
    }
    return {
      applicationId: application.id,
      snapshotId: snapshot.id,
      generation: snapshot.generation,
      isFresh: issues.length === 0,
      issues,
    };
  }
}
