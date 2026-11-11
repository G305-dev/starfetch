import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import {
  OnboardingApplicationKind,
  Prisma,
  VerificationRulesetLifecycle,
  VerificationSubjectTargetKind,
} from '@prisma/client';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import {
  VERIFICATION_RULESET_AUTHORING_AUTHORIZER,
  VerificationRulesetAuthoringAuthorizer,
} from '../security/ruleset-authoring-authorizer';
import {
  CanonicalRulesetDraftDefinitions,
  RulesetDraftDefinitionsInput,
  canonicalizeRulesetDraftDefinitions,
} from '../dto/ruleset-draft-definitions.input';

export interface CreateVerificationRulesetInput {
  rulesetKey: string;
  accountKind: OnboardingApplicationKind;
}

export interface VerificationRulesetDraftReceipt {
  rulesetId: string;
  rulesetVersionId: string;
  rulesetKey: string;
  accountKind: OnboardingApplicationKind;
  version: number;
  lifecycle: VerificationRulesetLifecycle;
}

const NOT_FOUND = { code: ERROR_CODES.NOT_FOUND, message: 'Ruleset version not found.' } as const;
const CONFLICT = { code: ERROR_CODES.CONFLICT, message: 'Ruleset version conflicts with its current state.' } as const;
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;
const MAX_SERIALIZATION_RETRIES = 3;

/**
 * Internal authoring primitives only. Draft content is policy data and remains
 * non-authoritative; this service deliberately has no approval/publication method.
 */
@Injectable()
export class VerificationRulesetDraftService {
  constructor(
    private readonly prisma: PrismaService,
    @Inject(VERIFICATION_RULESET_AUTHORING_AUTHORIZER)
    private readonly authorizer: VerificationRulesetAuthoringAuthorizer,
  ) {}

  async createRuleset(
    principal: AuthPrincipal | null | undefined,
    input: CreateVerificationRulesetInput,
  ): Promise<VerificationRulesetDraftReceipt> {
    const actorUserId = await this.requireAuthoringActor(principal);
    if (!SAFE_KEY.test(input.rulesetKey)) {
      throw new HttpException(
        { code: ERROR_CODES.VALIDATION_FAILED, message: 'rulesetKey must be a stable key of at most 120 safe characters.' },
        HttpStatus.BAD_REQUEST,
      );
    }

    try {
      return await this.prisma.$transaction(async (tx) => {
        const ruleset = await tx.verificationRuleset.create({
          data: {
            rulesetKey: input.rulesetKey,
            accountKind: input.accountKind,
            createdByUserId: actorUserId,
          },
        });
        const version = await tx.verificationRulesetVersion.create({
          data: {
            rulesetId: ruleset.id,
            accountKind: ruleset.accountKind,
            version: 1,
            lifecycle: VerificationRulesetLifecycle.DRAFT,
            createdByUserId: actorUserId,
          },
        });
        return receipt(ruleset, version);
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
    } catch (error) {
      if (isPrismaCode(error, 'P2002') || isPrismaCode(error, 'P2034')) throw conflict();
      throw error;
    }
  }

  /** Creates an empty next draft version; policy definitions are never cloned implicitly. */
  async createNextDraftVersion(
    principal: AuthPrincipal | null | undefined,
    rulesetId: string,
  ): Promise<VerificationRulesetDraftReceipt> {
    const actorUserId = await this.requireAuthoringActor(principal);
    if (!isUuid(rulesetId)) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);

    for (let attempt = 0; attempt < MAX_SERIALIZATION_RETRIES; attempt += 1) {
      try {
        return await this.prisma.$transaction(async (tx) => {
          const ruleset = await tx.verificationRuleset.findUnique({ where: { id: rulesetId } });
          if (!ruleset) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
          const latest = await tx.verificationRulesetVersion.aggregate({
            where: { rulesetId: ruleset.id },
            _max: { version: true },
          });
          const version = await tx.verificationRulesetVersion.create({
            data: {
              rulesetId: ruleset.id,
              accountKind: ruleset.accountKind,
              version: (latest._max.version ?? 0) + 1,
              lifecycle: VerificationRulesetLifecycle.DRAFT,
              createdByUserId: actorUserId,
            },
          });
          return receipt(ruleset, version);
        }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
      } catch (error) {
        if (error instanceof HttpException) throw error;
        if ((isPrismaCode(error, 'P2034') || isPrismaCode(error, 'P2002')) && attempt + 1 < MAX_SERIALIZATION_RETRIES) continue;
        if (isPrismaCode(error, 'P2034') || isPrismaCode(error, 'P2002')) throw conflict();
        throw error;
      }
    }
    throw conflict();
  }

  /** Replace draft definitions atomically. Published versions fail both here and in PostgreSQL triggers. */
  async replaceDraftDefinitions(
    principal: AuthPrincipal | null | undefined,
    rulesetVersionId: string,
    input: RulesetDraftDefinitionsInput,
  ): Promise<{ rulesetVersionId: string; subjectCount: number; checkCount: number; evidenceSourceCount: number; documentRequirementCount: number }> {
    const actorUserId = await this.requireAuthoringActor(principal);
    if (!isUuid(rulesetVersionId)) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    const definitions = canonicalizeRulesetDraftDefinitions(input);

    try {
      return await this.prisma.$transaction(async (tx) => {
        const version = await tx.verificationRulesetVersion.findUnique({
          where: { id: rulesetVersionId },
          select: { id: true, lifecycle: true, accountKind: true },
        });
        if (!version) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
        if (version.lifecycle !== VerificationRulesetLifecycle.DRAFT) throw conflict();
        validateSubjectTargets(version.accountKind, definitions.requiredSubjects);

        await tx.acceptedEvidenceSourceDefinition.deleteMany({ where: { rulesetVersionId } });
        await tx.verificationCheckDefinition.deleteMany({ where: { rulesetVersionId } });
        await tx.verificationSubjectDefinition.deleteMany({ where: { rulesetVersionId } });
        await tx.conditionalDocumentRequirementDefinition.deleteMany({ where: { rulesetVersionId } });

        let checkCount = 0;
        let evidenceSourceCount = 0;
        for (const subject of definitions.requiredSubjects) {
          const createdSubject = await tx.verificationSubjectDefinition.create({
            data: { rulesetVersionId, subjectKey: subject.subjectKey, targetKind: subject.targetKind },
          });
          for (const check of subject.requiredChecks) {
            const createdCheck = await tx.verificationCheckDefinition.create({
              data: {
                rulesetVersionId,
                subjectDefinitionId: createdSubject.id,
                checkKindKey: check.checkKindKey,
              },
            });
            checkCount += 1;
            if (check.acceptedEvidenceSourceKeys.length > 0) {
              await tx.acceptedEvidenceSourceDefinition.createMany({
                data: check.acceptedEvidenceSourceKeys.map((evidenceSourceKey) => ({
                  rulesetVersionId,
                  checkDefinitionId: createdCheck.id,
                  evidenceSourceKey,
                })),
              });
              evidenceSourceCount += check.acceptedEvidenceSourceKeys.length;
            }
          }
        }
        for (const document of definitions.conditionalDocumentRequirements) {
          await tx.conditionalDocumentRequirementDefinition.create({
            data: {
              rulesetVersionId,
              requirementKey: document.requirementKey,
              documentKindKey: document.documentKindKey,
              condition: document.condition as Prisma.InputJsonValue,
              completeness: document.completeness as Prisma.InputJsonValue,
            },
          });
        }
        await tx.verificationRulesetVersion.update({
          where: { id: rulesetVersionId },
          data: { updatedByUserId: actorUserId },
        });
        return {
          rulesetVersionId,
          subjectCount: definitions.requiredSubjects.length,
          checkCount,
          evidenceSourceCount,
          documentRequirementCount: definitions.conditionalDocumentRequirements.length,
        };
      }, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5_000, timeout: 10_000 });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (isPrismaCode(error, 'P2034') || isPrismaCode(error, 'P2002')) throw conflict();
      throw error;
    }
  }
  private async requireAuthoringActor(principal: AuthPrincipal | null | undefined): Promise<string> {
    if (!principal || !isUuid(principal.userId) || typeof principal.sessionId !== 'string' || principal.sessionId.length === 0) {
      throw new HttpException(
        { code: ERROR_CODES.UNAUTHENTICATED, message: 'Authentication required.' },
        HttpStatus.UNAUTHORIZED,
      );
    }
    // Actor attribution always comes from the guard-derived principal. No caller-supplied actor id is accepted.
    if (!await this.authorizer.authorizeDraftWrite({ principal })) {
      throw new HttpException(
        { code: ERROR_CODES.FORBIDDEN, message: 'You are not authorized to author verification rulesets.' },
        HttpStatus.FORBIDDEN,
      );
    }
    return principal.userId;
  }
}

function validateSubjectTargets(
  accountKind: OnboardingApplicationKind,
  subjects: CanonicalRulesetDraftDefinitions['requiredSubjects'],
): void {
  const allowed: Record<OnboardingApplicationKind, ReadonlySet<VerificationSubjectTargetKind>> = {
    INDIVIDUAL: new Set([VerificationSubjectTargetKind.INDIVIDUAL_APPLICANT]),
    JOINT: new Set([VerificationSubjectTargetKind.JOINT_ACCOUNT_MEMBER]),
    CORPORATE: new Set([
      VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY,
      VerificationSubjectTargetKind.CORPORATE_AUTHORIZED_REPRESENTATIVE,
      VerificationSubjectTargetKind.CORPORATE_BENEFICIAL_OWNER,
    ]),
  };
  if (subjects.some((subject) => !allowed[accountKind].has(subject.targetKind))) {
    throw new HttpException(
      { code: ERROR_CODES.VALIDATION_FAILED, message: 'A required subject target is not applicable to this account kind.' },
      HttpStatus.BAD_REQUEST,
    );
  }
}

function receipt(
  ruleset: { id: string; rulesetKey: string; accountKind: OnboardingApplicationKind },
  version: { id: string; version: number; lifecycle: VerificationRulesetLifecycle },
): VerificationRulesetDraftReceipt {
  return {
    rulesetId: ruleset.id,
    rulesetVersionId: version.id,
    rulesetKey: ruleset.rulesetKey,
    accountKind: ruleset.accountKind,
    version: version.version,
    lifecycle: VerificationRulesetLifecycle.DRAFT,
  };
}

function conflict(): HttpException {
  return new HttpException(CONFLICT, HttpStatus.CONFLICT);
}

function isPrismaCode(error: unknown, code: string): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === code;
}

function isUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
}
