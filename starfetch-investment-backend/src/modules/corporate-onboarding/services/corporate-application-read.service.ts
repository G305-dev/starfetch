import { HttpException, HttpStatus, Injectable } from '@nestjs/common';
import {
  OnboardingApplicationHistoryEvent,
  OnboardingApplicationStatus,
} from '@prisma/client';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CorporateApplicantContextService } from './corporate-applicant-context.service';
import { CorporateApplicationAccessService } from './corporate-application-access.service';
import { CorporateTinReadService } from './corporate-tin-read.service';

export interface CorporateApplicationReadModel {
  readonly corporateAccountId: string;
  readonly applicationId: string;
  readonly status: OnboardingApplicationStatus;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly details: {
    readonly institutionName: string;
    readonly dateOfIncorporation: string;
    readonly rcNumber: string;
    readonly businessPhoneNumber: string;
    readonly businessEmail: string;
    readonly taxIdentificationNumberMasked: string | null;
    readonly version: number;
    readonly createdAt: Date;
    readonly updatedAt: Date;
  };
}

export interface CorporateApplicationStatusReadModel {
  readonly corporateAccountId: string;
  readonly applicationId: string;
  readonly status: OnboardingApplicationStatus;
}

export interface CorporateApplicationHistoryReadModel {
  readonly id: string;
  readonly event: OnboardingApplicationHistoryEvent;
  readonly fromStatus: OnboardingApplicationStatus | null;
  readonly toStatus: OnboardingApplicationStatus;
  readonly createdAt: Date;
}

export interface CorporateDetailsAmendmentReadModel {
  readonly version: number;
  readonly changedFieldNames: readonly string[];
  readonly changedAt: Date;
}

export interface CorporateApplicationHistoryCollectionReadModel {
  readonly corporateAccountId: string;
  readonly applicationId: string;
  readonly history: readonly CorporateApplicationHistoryReadModel[];
  readonly detailsAmendments: readonly CorporateDetailsAmendmentReadModel[];
}

export interface CorporateApplicationDiscoveryReadModel {
  readonly corporateAccountId: string;
  readonly applicationId: string;
  readonly status: OnboardingApplicationStatus;
  readonly detailsVersion: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly accessVia: 'INITIATING_APPLICANT';
}

const NOT_FOUND = {
  code: ERROR_CODES.NOT_FOUND,
  message: 'Application not found.',
} as const;

/** O3 read projection. Public controller routes are read-only and owner-scoped. */
@Injectable()
export class CorporateApplicationReadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applicants: CorporateApplicantContextService,
    private readonly access: CorporateApplicationAccessService,
    private readonly tinRead: CorporateTinReadService,
  ) {}

  /** Internal application-ID lookup retained for backend callers; no public route accepts this as an account ID. */
  async listInitiatedApplications(
    principal: AuthPrincipal | null | undefined,
  ): Promise<CorporateApplicationDiscoveryReadModel[]> {
    const applicant = await this.applicants.requireVerifiedInvestor(principal);
    const applications = await this.prisma.onboardingApplication.findMany({
      where: {
        kind: 'CORPORATE',
        initiatingUserId: applicant.initiatingUserId,
        ownerCorporateAccountId: { not: null },
      },
      orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
      select: {
        id: true,
        ownerCorporateAccountId: true,
        status: true,
        createdAt: true,
        updatedAt: true,
        corporateDetails: { select: { version: true } },
      },
    });
    return applications.map((application) => {
      if (!application.ownerCorporateAccountId || !application.corporateDetails) {
        throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
      }
      return {
        corporateAccountId: application.ownerCorporateAccountId,
        applicationId: application.id,
        status: application.status,
        detailsVersion: application.corporateDetails.version,
        createdAt: application.createdAt,
        updatedAt: application.updatedAt,
        accessVia: 'INITIATING_APPLICANT',
      };
    });
  }

  async getApplication(
    principal: AuthPrincipal | null | undefined,
    applicationId: string,
  ): Promise<CorporateApplicationReadModel> {
    return this.readApplication(await this.requireOwnedByApplicationId(principal, applicationId));
  }

  /** Public O3 mapping: the route ID is explicitly a CorporateAccount ID. */
  async getApplicationByCorporateAccountId(
    principal: AuthPrincipal | null | undefined,
    corporateAccountId: string,
  ): Promise<CorporateApplicationReadModel> {
    return this.readApplication(await this.requireOwnedByCorporateAccountId(principal, corporateAccountId));
  }

  async getStatus(
    principal: AuthPrincipal | null | undefined,
    applicationId: string,
  ): Promise<CorporateApplicationStatusReadModel> {
    return this.statusProjection(await this.requireOwnedByApplicationId(principal, applicationId));
  }

  async getStatusByCorporateAccountId(
    principal: AuthPrincipal | null | undefined,
    corporateAccountId: string,
  ): Promise<CorporateApplicationStatusReadModel> {
    return this.statusProjection(await this.requireOwnedByCorporateAccountId(principal, corporateAccountId));
  }

  /** Internal application-ID history lookup retained for backend callers. */
  async getHistory(
    principal: AuthPrincipal | null | undefined,
    applicationId: string,
  ): Promise<CorporateApplicationHistoryReadModel[]> {
    return this.readHistory(await this.requireOwnedByApplicationId(principal, applicationId));
  }

  /** Public O11 history response with both identifiers explicit and no actor/auth metadata. */
  async getHistoryByCorporateAccountId(
    principal: AuthPrincipal | null | undefined,
    corporateAccountId: string,
  ): Promise<CorporateApplicationHistoryCollectionReadModel> {
    const owned = await this.requireOwnedByCorporateAccountId(principal, corporateAccountId);
    return {
      corporateAccountId: this.requireCorporateAccountId(owned.ownerCorporateAccountId),
      applicationId: owned.id,
      history: await this.readHistory(owned),
      detailsAmendments: await this.readAmendments(owned.id),
    };
  }

  private async readApplication(owned: Awaited<ReturnType<CorporateApplicationAccessService['requireInitiatorOwnedCorporateApplication']>>) {
    const details = await this.prisma.corporateOnboardingDetails.findUnique({
      where: { applicationId: owned.id },
      select: {
        institutionName: true,
        dateOfIncorporation: true,
        rcNumber: true,
        businessPhoneNumber: true,
        businessEmail: true,
        taxIdentificationNumberCiphertext: true,
        taxIdentificationNumberIv: true,
        taxIdentificationNumberAuthTag: true,
        taxIdentificationNumberEncryptedDataKey: true,
        taxIdentificationNumberKeyProvider: true,
        taxIdentificationNumberKeyId: true,
        taxIdentificationNumberKeyVersion: true,
        taxIdentificationNumberContextVersion: true,
        version: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    // The schema's deferred constraint requires exactly one canonical row. A
    // missing row is treated as unavailable, never as a second details source.
    if (!details) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);

    const taxIdentificationNumberMasked = await this.tinRead.maskedProjection(owned.id, details);
    return {
      corporateAccountId: this.requireCorporateAccountId(owned.ownerCorporateAccountId),
      applicationId: owned.id,
      status: owned.status,
      createdAt: owned.createdAt,
      updatedAt: owned.updatedAt,
      details: {
        institutionName: details.institutionName,
        dateOfIncorporation: details.dateOfIncorporation.toISOString().slice(0, 10),
        rcNumber: details.rcNumber,
        businessPhoneNumber: details.businessPhoneNumber,
        businessEmail: details.businessEmail,
        taxIdentificationNumberMasked,
        version: details.version,
        createdAt: details.createdAt,
        updatedAt: details.updatedAt,
      },
    };
  }

  private statusProjection(
    owned: Awaited<ReturnType<CorporateApplicationAccessService['requireInitiatorOwnedCorporateApplication']>>,
  ): CorporateApplicationStatusReadModel {
    return {
      corporateAccountId: this.requireCorporateAccountId(owned.ownerCorporateAccountId),
      applicationId: owned.id,
      status: owned.status,
    };
  }

  private async readHistory(
    owned: Awaited<ReturnType<CorporateApplicationAccessService['requireInitiatorOwnedCorporateApplication']>>,
  ): Promise<CorporateApplicationHistoryReadModel[]> {
    return this.prisma.onboardingApplicationHistory.findMany({
      where: { applicationId: owned.id },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      select: {
        id: true,
        event: true,
        fromStatus: true,
        toStatus: true,
        createdAt: true,
      },
    });
  }

  private async readAmendments(applicationId: string): Promise<CorporateDetailsAmendmentReadModel[]> {
    const revisions = await this.prisma.corporateDetailsRevision.findMany({
      where: { applicationId },
      orderBy: [{ version: 'asc' }, { id: 'asc' }],
      select: { version: true, changedFieldNames: true, createdAt: true },
    });
    return revisions.map((revision) => ({
      version: revision.version,
      changedFieldNames: revision.changedFieldNames,
      changedAt: revision.createdAt,
    }));
  }

  private async requireOwnedByApplicationId(
    principal: AuthPrincipal | null | undefined,
    applicationId: string,
  ) {
    const applicant = await this.applicants.requireVerifiedInvestor(principal);
    return this.access.requireInitiatorOwnedCorporateApplication(applicant, applicationId);
  }

  private async requireOwnedByCorporateAccountId(
    principal: AuthPrincipal | null | undefined,
    corporateAccountId: string,
  ) {
    const applicant = await this.applicants.requireVerifiedInvestor(principal);
    return this.access.requireInitiatorOwnedCorporateAccount(applicant, corporateAccountId);
  }

  private requireCorporateAccountId(corporateAccountId: string | null): string {
    if (!corporateAccountId) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    return corporateAccountId;
  }
}
