import { Inject, HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  OnboardingApplicationKind,
  OnboardingApplicationStatus,
  Prisma,
  VerificationRulesetLifecycle,
  ApplicationRulesetBindingEventKind,
  VerificationSubjectTargetKind,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  VERIFICATION_RULESET_BINDING_AUTHORIZER,
  VerificationRulesetBindingAuthorizer,
} from '../security/ruleset-binding-authorizer';

export interface ApplicationRulesetBindingReceipt {
  readonly bindingId: string;
  readonly applicationId: string;
  readonly accountKind: OnboardingApplicationKind;
  readonly rulesetVersionId: string;
  readonly boundAt: Date;
  readonly operationId: string;
}

const NOT_FOUND = { code: ERROR_CODES.NOT_FOUND, message: 'Application or ruleset version not found.' } as const;
const CONFLICT = { code: ERROR_CODES.CONFLICT, message: 'Application cannot be bound to this ruleset version.' } as const;
const FORBIDDEN = { code: ERROR_CODES.FORBIDDEN, message: 'You are not authorized to bind a verification ruleset.' } as const;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Internal initial-binding primitive. Authorization defaults to deny, no
 * rebinding/submission-pin method exists, and this module has no controller.
 */
@Injectable()
export class ApplicationRulesetBindingService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VERIFICATION_RULESET_BINDING_AUTHORIZER)
    private readonly authorizer: VerificationRulesetBindingAuthorizer,
  ) {}

  async bindApprovedVersion(
    principal: AuthPrincipal | null | undefined,
    applicationId: string,
    rulesetVersionId: string,
  ): Promise<ApplicationRulesetBindingReceipt> {
    if (!principal) {
      throw new HttpException(
        { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    if (!UUID_PATTERN.test(applicationId) || !UUID_PATTERN.test(rulesetVersionId)) {
      throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    }

    // The default production capability provider always denies. Authorization
    // is checked before reading either resource, preventing arbitrary applicant
    // version selection and resource-existence discovery.
    if (!await this.authorizer.authorizeInitialBinding({ principal, applicationId, rulesetVersionId })) {
      throw new HttpException(FORBIDDEN, HttpStatus.FORBIDDEN);
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const application = await tx.onboardingApplication.findUnique({
          where: { id: applicationId },
          select: { id: true, kind: true, status: true },
        });
        if (!application) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
        if (application.status !== OnboardingApplicationStatus.DRAFT) throw conflict();

        const existingBinding = await tx.onboardingApplicationRulesetBinding.findUnique({
          where: { applicationId: application.id },
        });
        if (existingBinding) throw conflict();
        const existingPin = await tx.onboardingApplicationRulesetPin.findUnique({
          where: { applicationId: application.id },
        });
        if (existingPin) throw conflict();

        const version = await tx.verificationRulesetVersion.findUnique({
          where: { id: rulesetVersionId },
          include: {
            subjectDefinitions: {
              include: { checks: { include: { acceptedEvidenceSources: true } } },
            },
          },
        });
        if (!version) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
        if (version.accountKind !== application.kind || !isApprovedAndComplete(version)) throw conflict();

        const operationId = randomUUID();
        const binding = await tx.onboardingApplicationRulesetBinding.create({
          data: {
            operationId,
            applicationId: application.id,
            accountKind: application.kind,
            rulesetVersionId: version.id,
            boundByUserId: principal.userId,
          },
        });
        await tx.applicationRulesetBindingEvent.create({
          data: {
            bindingId: binding.id,
            applicationId: application.id,
            accountKind: application.kind,
            rulesetVersionId: version.id,
            eventKind: ApplicationRulesetBindingEventKind.BOUND,
            operationId,
            actorUserId: principal.userId,
          },
        });
        return {
          bindingId: binding.id,
          applicationId: application.id,
          accountKind: application.kind,
          rulesetVersionId: version.id,
          boundAt: binding.boundAt,
          operationId,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        (error.code === 'P2002' || error.code === 'P2034')
      ) throw conflict();
      throw new HttpException(
        { code: ERROR_CODES.INTERNAL_ERROR, message: 'Ruleset binding could not be completed.' },
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}

function isApprovedAndComplete(
  version: Prisma.VerificationRulesetVersionGetPayload<{
    include: { subjectDefinitions: { include: { checks: { include: { acceptedEvidenceSources: true } } } } };
  }>,
): boolean {
  return version.lifecycle === VerificationRulesetLifecycle.PUBLISHED &&
    !!version.approvedByUserId && !!version.approvedAt &&
    !!version.publishedByUserId && !!version.publishedAt &&
    version.subjectDefinitions.length > 0 &&
    version.subjectDefinitions.every((subject) =>
      isSubjectTargetApplicable(version.accountKind, subject.targetKind) &&
      subject.checks.length > 0 && subject.checks.every((check) => check.acceptedEvidenceSources.length > 0),
    );
}

function isSubjectTargetApplicable(
  accountKind: OnboardingApplicationKind,
  targetKind: VerificationSubjectTargetKind | null,
): boolean {
  if (!targetKind) return false;
  if (accountKind === OnboardingApplicationKind.INDIVIDUAL) {
    return targetKind === VerificationSubjectTargetKind.INDIVIDUAL_APPLICANT;
  }
  if (accountKind === OnboardingApplicationKind.JOINT) {
    return targetKind === VerificationSubjectTargetKind.JOINT_ACCOUNT_MEMBER;
  }
  return targetKind === VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY ||
    targetKind === VerificationSubjectTargetKind.CORPORATE_AUTHORIZED_REPRESENTATIVE ||
    targetKind === VerificationSubjectTargetKind.CORPORATE_BENEFICIAL_OWNER;
}

function conflict(): HttpException {
  return new HttpException(CONFLICT, HttpStatus.CONFLICT);
}
