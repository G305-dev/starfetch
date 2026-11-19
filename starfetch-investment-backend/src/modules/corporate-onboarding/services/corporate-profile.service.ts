import { HttpException, HttpStatus, Inject, Injectable } from '@nestjs/common';
import { CorporateProfileSectionStatus, OnboardingApplicationStatus, Prisma, PrimaryAccountType } from '@prisma/client';
import { ERROR_CODES } from '../../../common/errors/error-codes';
import { AuthPrincipal } from '../../../common/types/auth-principal';
import { PrismaService } from '../../../infrastructure/database/prisma.service';
import { CorporateBankAccountEncryptionService, bankEnvelopeFromColumns } from '../crypto/corporate-bank-account-encryption';
import { CORPORATE_TIN_ENCRYPTION_PROVIDER, CorporateTinEncryptionProvider } from '../crypto/corporate-tin-encryption';
import { CorporateDetailsUpdateInput, canonicalizeCorporateDetailsPatch } from '../dto/corporate-details-update.input';
import {
  CorporateProfileBankDetailsDto,
  CorporateProfileCompanyDetailsDto,
  CorporateProfileInvestmentDto,
  CorporateProfileSourceOfFundsDto,
  koboToNaira,
  ngnToKobo,
  withdrawalsToKobo,
} from '../dto/corporate-profile.dto';
import { CorporateApplicantContextService } from './corporate-applicant-context.service';
import { CorporateApplicationAccessService } from './corporate-application-access.service';
import { CorporateO2AvailabilityService } from './corporate-o2-availability.service';
import { CORPORATE_DETAILS_EDITABLE_STATES, detailsSnapshot } from './corporate-details-edit.service';
import { CorporateTinReadService } from './corporate-tin-read.service';
const CONFLICT = { code: ERROR_CODES.CONFLICT, message: 'Corporate Profile has changed. Reload and retry with the current version.' };
const NOT_FOUND = { code: ERROR_CODES.NOT_FOUND, message: 'Corporate account not found.' };
const SECTIONS = ['companyDetails', 'investmentProfile', 'sourceOfFunds', 'bankDetails'] as const;
type Section = typeof SECTIONS[number];

export interface CorporateProfileView {
  corporateAccountId: string;
  applicationId: string;
  applicant: { companyName: string | null; companyPhoneNumber: string | null; email: string };
  canonicalDetails: {
    institutionName: string; dateOfIncorporation: string; rcNumber: string;
    businessPhoneNumber: string; businessEmail: string; taxIdentificationNumberMasked: string | null;
  };
  companyDetails: { registeredAddress: string | null; city: string | null; state: string | null };
  investmentProfile: {
    primaryObjective: string | null; riskTolerance: string | null; investmentHorizon: string | null;
    expectedWithdrawals: string | null; withdrawalFrequency: string | null; restrictionsOrExclusions: string | null;
  };
  sourceOfFunds: {
    selectedSources: string[]; otherSource: string | null; expectedAnnualInflow: string | null; expectedTransactionFrequency: string | null;
  };
  bankDetails: {
    bankName: string | null; accountNumberMasked: string | null; accountName: string | null;
    accountType: string | null; bvnLinkedToAccount: boolean | null;
  };
  profileVersion: number;
  detailsVersion: number;
  sectionStatuses: Record<Section, CorporateProfileSectionStatus>;
  progress: {
    percentage: number; nextSection: Section | null; canSubmit: false;
    meaning: 'SAVED_FORM_COMPLETION_ONLY';
  };
  updatedAt: string | null;
}

@Injectable()
export class CorporateProfileService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly applicants: CorporateApplicantContextService,
    private readonly access: CorporateApplicationAccessService,
    @Inject(CORPORATE_TIN_ENCRYPTION_PROVIDER) private readonly tinEncryption: CorporateTinEncryptionProvider,
    private readonly availability: CorporateO2AvailabilityService,
    private readonly tinRead: CorporateTinReadService,
    private readonly bankEncryption: CorporateBankAccountEncryptionService,
  ) {}

  async getByCorporateAccountId(principal: AuthPrincipal | null | undefined, corporateAccountId: string): Promise<CorporateProfileView> {
    const applicant = await this.applicants.requireVerifiedInvestor(principal);
    const application = await this.access.requireInitiatorOwnedCorporateAccount(applicant, corporateAccountId);
    const [details, profile, identity] = await Promise.all([
      this.prisma.corporateOnboardingDetails.findUnique({ where: { applicationId: application.id } }),
      this.prisma.corporateProfile.findUnique({ where: { applicationId: application.id } }),
      this.prisma.user.findUnique({
        where: { id: applicant.initiatingUserId },
        select: { email: true, corporateApplicantProfile: { select: { companyName: true, companyPhoneNumber: true } } },
      }),
    ]);
    if (!details || !identity) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    const [tinMasked, bankMasked] = await Promise.all([
      this.tinRead.maskedProjection(application.id, details),
      this.bankEncryption.mask(profile ? bankEnvelopeFromColumns(profile) : null, application.id),
    ]);
    const companyVersionCurrent = !profile || profile.companyDetailsDetailsVersion === details.version;
    const companyIsStale = Boolean(profile && profile.companyDetailsStatus === CorporateProfileSectionStatus.COMPLETE && !companyVersionCurrent);
    const status = {
      companyDetails: companyIsStale ? CorporateProfileSectionStatus.DRAFT : profile?.companyDetailsStatus ?? CorporateProfileSectionStatus.NOT_STARTED,
      investmentProfile: companyIsStale && profile?.investmentProfileStatus === CorporateProfileSectionStatus.COMPLETE ? CorporateProfileSectionStatus.DRAFT : profile?.investmentProfileStatus ?? CorporateProfileSectionStatus.NOT_STARTED,
      sourceOfFunds: companyIsStale && profile?.sourceOfFundsStatus === CorporateProfileSectionStatus.COMPLETE ? CorporateProfileSectionStatus.DRAFT : profile?.sourceOfFundsStatus ?? CorporateProfileSectionStatus.NOT_STARTED,
      bankDetails: companyIsStale && profile?.bankDetailsStatus === CorporateProfileSectionStatus.COMPLETE ? CorporateProfileSectionStatus.DRAFT : profile?.bankDetailsStatus ?? CorporateProfileSectionStatus.NOT_STARTED,
    };
    const completed = SECTIONS.filter((key) => status[key] === CorporateProfileSectionStatus.COMPLETE).length;
    return {
      corporateAccountId: application.ownerCorporateAccountId!,
      applicationId: application.id,
      applicant: {
        companyName: identity.corporateApplicantProfile?.companyName ?? null,
        companyPhoneNumber: identity.corporateApplicantProfile?.companyPhoneNumber ?? null,
        email: identity.email,
      },
      canonicalDetails: {
        institutionName: details.institutionName,
        dateOfIncorporation: details.dateOfIncorporation.toISOString().slice(0, 10),
        rcNumber: details.rcNumber,
        businessPhoneNumber: details.businessPhoneNumber,
        businessEmail: details.businessEmail,
        taxIdentificationNumberMasked: tinMasked,
      },
      companyDetails: {
        registeredAddress: profile?.registeredAddress ?? null,
        city: profile?.city ?? null,
        state: profile?.state ?? null,
      },
      investmentProfile: {
        primaryObjective: profile?.primaryObjective ?? null,
        riskTolerance: profile?.riskTolerance ?? null,
        investmentHorizon: profile?.investmentHorizon ?? null,
        expectedWithdrawals: profile?.expectedWithdrawals ?? null,
        withdrawalFrequency: profile?.withdrawalFrequency ?? null,
        restrictionsOrExclusions: profile?.restrictionsOrExclusions ?? null,
      },
      sourceOfFunds: {
        selectedSources: profile?.selectedSources ?? [],
        otherSource: profile?.otherSource ?? null,
        expectedAnnualInflow: koboToNaira(profile?.expectedAnnualInflowMinor ?? null),
        expectedTransactionFrequency: profile?.expectedTransactionFrequency ?? null,
      },
      bankDetails: {
        bankName: profile?.bankName ?? null,
        accountNumberMasked: bankMasked,
        accountName: profile?.accountName ?? null,
        accountType: profile?.accountType ?? null,
        bvnLinkedToAccount: profile?.bvnLinkedToAccount ?? null,
      },
      profileVersion: profile?.profileVersion ?? 0,
      detailsVersion: details.version,
      sectionStatuses: status,
      progress: {
        percentage: completed * 25,
        nextSection: SECTIONS.find((key) => status[key] !== CorporateProfileSectionStatus.COMPLETE) ?? null,
        canSubmit: false,
        meaning: 'SAVED_FORM_COMPLETION_ONLY',
      },
      updatedAt: profile?.updatedAt.toISOString() ?? null,
    };
  }

  async saveCompanyDetails(
    principal: AuthPrincipal | null | undefined, corporateAccountId: string,
    expectedProfileVersion: number, expectedDetailsVersion: number, dto: CorporateProfileCompanyDetailsDto,
  ): Promise<CorporateProfileView> {
    const app = await this.authorize(principal, corporateAccountId);
    const o4Input: CorporateDetailsUpdateInput = {
      rcNumber: dto.rcNumber,
      dateOfIncorporation: dto.dateOfIncorporation,
      ...(dto.taxIdentificationNumber !== undefined ? { taxIdentificationNumber: dto.taxIdentificationNumber } : {}),
    };
    const canonical = canonicalizeCorporateDetailsPatch(o4Input);
    const today = new Date().toISOString().slice(0, 10);
    if (dto.dateOfIncorporation > today) this.validation('dateOfIncorporation', 'Date of incorporation cannot be in the future.');
    if (dto.taxIdentificationNumber !== undefined) this.availability.requireAvailable();
    await this.transact(async (tx) => {
      const lockedApp = await this.lockApplicationForWrite(tx, app.id, corporateAccountId, app.initiatingUserId);
      this.requireEditable(lockedApp.status);
      const { details, profile } = await this.loadForWrite(tx, lockedApp.id);
      this.expectProfileVersion(profile?.profileVersion ?? 0, expectedProfileVersion);
      this.expectDetailsVersion(details.version, expectedDetailsVersion);

      const o4Changed = canonical.rcNumber !== details.rcNumber ||
        canonical.dateOfIncorporation?.getTime() !== details.dateOfIncorporation.getTime() ||
        canonical.taxIdentificationNumber !== undefined;
      if (canonical.taxIdentificationNumber !== undefined && !this.availability.isAvailable()) this.availability.requireAvailable();
      if (o4Changed) {
        let encryptedPatch: Prisma.CorporateOnboardingDetailsUpdateManyMutationInput = {};
        if (canonical.taxIdentificationNumber !== undefined) {
          const env = await this.tinEncryption.encrypt(canonical.taxIdentificationNumber, app.id);
          encryptedPatch = {
            taxIdentificationNumberCiphertext: env.ciphertext,
            taxIdentificationNumberIv: env.iv,
            taxIdentificationNumberAuthTag: env.authTag,
            taxIdentificationNumberEncryptedDataKey: env.encryptedDataKey,
            taxIdentificationNumberKeyProvider: env.keyProvider,
            taxIdentificationNumberKeyId: env.keyId,
            taxIdentificationNumberKeyVersion: env.keyVersion,
            taxIdentificationNumberContextVersion: env.contextVersion,
          };
        }
        const changed = await tx.corporateOnboardingDetails.updateMany({
          where: { applicationId: app.id, version: expectedDetailsVersion },
          data: {
            ...(canonical.rcNumber !== details.rcNumber ? { rcNumber: canonical.rcNumber } : {}),
            ...(canonical.dateOfIncorporation?.getTime() !== details.dateOfIncorporation.getTime() ? { dateOfIncorporation: canonical.dateOfIncorporation } : {}),
            ...encryptedPatch,
            version: { increment: 1 },
          },
        });
        if (changed.count !== 1) throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
        const after = await tx.corporateOnboardingDetails.findUniqueOrThrow({ where: { applicationId: app.id } });
        await tx.corporateDetailsRevision.create({
          data: {
            applicationId: app.id,
            version: after.version,
            changedByUserId: app.initiatingUserId,
            changedFieldNames: [
              ...(canonical.rcNumber !== details.rcNumber ? ['rcNumber'] : []),
              ...(canonical.dateOfIncorporation?.getTime() !== details.dateOfIncorporation.getTime() ? ['dateOfIncorporation'] : []),
              ...(canonical.taxIdentificationNumber !== undefined ? ['taxIdentificationNumber'] : []),
            ].sort(),
            beforeSnapshot: detailsSnapshot(details),
            afterSnapshot: detailsSnapshot(after),
          },
        });
      }

      const current = profile ?? await tx.corporateProfile.create({ data: { applicationId: app.id } });
      const tinExists = canonical.taxIdentificationNumber !== undefined || hasTin(details);
      const complete = Boolean(dto.registeredAddress && dto.city && dto.state && tinExists);
      const companyInputChanged = o4Changed || profile?.registeredAddress !== dto.registeredAddress ||
        profile?.city !== dto.city || profile?.state !== dto.state ||
        (profile?.companyDetailsStatus === CorporateProfileSectionStatus.COMPLETE && profile.companyDetailsDetailsVersion !== expectedDetailsVersion);
      const invalidate = companyInputChanged;
      const data: Prisma.CorporateProfileUpdateManyMutationInput = {
        registeredAddress: dto.registeredAddress,
        city: dto.city,
        state: dto.state,
        companyDetailsDetailsVersion: expectedDetailsVersion + (o4Changed ? 1 : 0),
        companyDetailsStatus: complete ? CorporateProfileSectionStatus.COMPLETE : CorporateProfileSectionStatus.DRAFT,
        ...(invalidate ? {
          investmentProfileStatus: profile?.investmentProfileStatus === CorporateProfileSectionStatus.COMPLETE ? CorporateProfileSectionStatus.DRAFT : profile?.investmentProfileStatus,
          sourceOfFundsStatus: profile?.sourceOfFundsStatus === CorporateProfileSectionStatus.COMPLETE ? CorporateProfileSectionStatus.DRAFT : profile?.sourceOfFundsStatus,
          bankDetailsStatus: profile?.bankDetailsStatus === CorporateProfileSectionStatus.COMPLETE ? CorporateProfileSectionStatus.DRAFT : profile?.bankDetailsStatus,
        } : {}),
        profileVersion: { increment: 1 },
      };
      const updated = await tx.corporateProfile.updateMany({ where: { applicationId: app.id, profileVersion: expectedProfileVersion }, data });
      if (updated.count !== 1) throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
      await this.addRevision(tx, app.id, expectedProfileVersion + 1, 'companyDetails', app.initiatingUserId,
        ['rcNumber', 'dateOfIncorporation', ...(canonical.taxIdentificationNumber !== undefined ? ['taxIdentificationNumber'] : []), 'registeredAddress', 'city', 'state'],
        { registeredAddress: dto.registeredAddress, city: dto.city, state: dto.state, companyDetailsStatus: complete ? 'COMPLETE' : 'DRAFT', detailsVersion: expectedDetailsVersion + (o4Changed ? 1 : 0) });
      void current;
    });
    return this.getByCorporateAccountId(principal, corporateAccountId);
  }

  async saveInvestmentProfile(principal: AuthPrincipal | null | undefined, corporateAccountId: string, expectedProfileVersion: number, dto: CorporateProfileInvestmentDto): Promise<CorporateProfileView> {
    const app = await this.authorize(principal, corporateAccountId);
    let withdrawalsMinor: bigint | null;
    try { withdrawalsMinor = withdrawalsToKobo(dto.expectedWithdrawals); }
    catch { this.validation('expectedWithdrawals', 'Enter an unambiguous NGN amount or a bounded text declaration.'); }
    await this.transact(async (tx) => {
      const lockedApp = await this.lockApplicationForWrite(tx, app.id, corporateAccountId, app.initiatingUserId);
      this.requireEditable(lockedApp.status);
      const { details, profile } = await this.loadForWrite(tx, lockedApp.id);
      this.expectProfileVersion(profile?.profileVersion ?? 0, expectedProfileVersion);
      this.requirePreviousComplete(profile, 'investmentProfile', details.version);
      if (!profile) throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
      const updated = await tx.corporateProfile.updateMany({
        where: { applicationId: app.id, profileVersion: expectedProfileVersion },
        data: {
          primaryObjective: dto.primaryObjective, riskTolerance: dto.riskTolerance, investmentHorizon: dto.investmentHorizon,
          expectedWithdrawals: dto.expectedWithdrawals, expectedWithdrawalsMinor: withdrawalsMinor!,
          withdrawalFrequency: dto.withdrawalFrequency, restrictionsOrExclusions: dto.restrictionsOrExclusions ?? null,
          investmentProfileStatus: CorporateProfileSectionStatus.COMPLETE, profileVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
      await this.addRevision(tx, app.id, expectedProfileVersion + 1, 'investmentProfile', app.initiatingUserId,
        ['primaryObjective', 'riskTolerance', 'investmentHorizon', 'expectedWithdrawals', 'withdrawalFrequency', 'restrictionsOrExclusions'],
        { primaryObjective: dto.primaryObjective, riskTolerance: dto.riskTolerance, investmentHorizon: dto.investmentHorizon,
          expectedWithdrawals: dto.expectedWithdrawals, expectedWithdrawalsMinor: withdrawalsMinor?.toString() ?? null,
          withdrawalFrequency: dto.withdrawalFrequency, restrictionsOrExclusions: dto.restrictionsOrExclusions ?? null, status: 'COMPLETE' });
    });
    return this.getByCorporateAccountId(principal, corporateAccountId);
  }

  async saveSourceOfFunds(principal: AuthPrincipal | null | undefined, corporateAccountId: string, expectedProfileVersion: number, dto: CorporateProfileSourceOfFundsDto): Promise<CorporateProfileView> {
    const app = await this.authorize(principal, corporateAccountId);
    if (dto.selectedSources.includes('Other (specify)') && !dto.otherSource?.trim()) this.validation('otherSource', 'Describe the other source of funds.');
    let annualMinor: bigint;
    try { annualMinor = ngnToKobo(dto.expectedAnnualInflow); }
    catch { this.validation('expectedAnnualInflow', 'Enter a valid NGN amount with up to two decimal places.'); }
    await this.transact(async (tx) => {
      const lockedApp = await this.lockApplicationForWrite(tx, app.id, corporateAccountId, app.initiatingUserId);
      this.requireEditable(lockedApp.status);
      const { details, profile } = await this.loadForWrite(tx, lockedApp.id);
      this.expectProfileVersion(profile?.profileVersion ?? 0, expectedProfileVersion);
      this.requirePreviousComplete(profile, 'sourceOfFunds', details.version);
      if (!profile) throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
      const updated = await tx.corporateProfile.updateMany({
        where: { applicationId: app.id, profileVersion: expectedProfileVersion },
        data: {
          selectedSources: [...new Set(dto.selectedSources)],
          otherSource: dto.selectedSources.includes('Other (specify)') ? dto.otherSource!.trim() : null,
          expectedAnnualInflowMinor: annualMinor!, expectedTransactionFrequency: dto.expectedTransactionFrequency,
          sourceOfFundsStatus: CorporateProfileSectionStatus.COMPLETE, profileVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
      await this.addRevision(tx, app.id, expectedProfileVersion + 1, 'sourceOfFunds', app.initiatingUserId,
        ['selectedSources', 'otherSource', 'expectedAnnualInflow', 'expectedTransactionFrequency'],
        { selectedSources: [...new Set(dto.selectedSources)], otherSource: dto.selectedSources.includes('Other (specify)') ? dto.otherSource!.trim() : null,
          expectedAnnualInflowMinor: annualMinor!.toString(), expectedTransactionFrequency: dto.expectedTransactionFrequency, status: 'COMPLETE' });
    });
    return this.getByCorporateAccountId(principal, corporateAccountId);
  }

  async saveBankDetails(principal: AuthPrincipal | null | undefined, corporateAccountId: string, expectedProfileVersion: number, dto: CorporateProfileBankDetailsDto): Promise<CorporateProfileView> {
    const app = await this.authorize(principal, corporateAccountId);
    // Only the transient request value is passed to the purpose-specific KMS adapter.
    const envelope = await this.bankEncryption.encrypt(dto.accountNumber, app.id);
    await this.transact(async (tx) => {
      const lockedApp = await this.lockApplicationForWrite(tx, app.id, corporateAccountId, app.initiatingUserId);
      this.requireEditable(lockedApp.status);
      const { details, profile } = await this.loadForWrite(tx, lockedApp.id);
      this.expectProfileVersion(profile?.profileVersion ?? 0, expectedProfileVersion);
      this.requirePreviousComplete(profile, 'bankDetails', details.version);
      if (!profile) throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
      const updated = await tx.corporateProfile.updateMany({
        where: { applicationId: app.id, profileVersion: expectedProfileVersion },
        data: {
          bankName: dto.bankName, accountName: dto.accountName, accountType: dto.accountType,
          bvnLinkedToAccount: dto.bvnLinkedToAccount,
          bankAccountNumberCiphertext: envelope.ciphertext, bankAccountNumberIv: envelope.iv,
          bankAccountNumberAuthTag: envelope.authTag, bankAccountNumberEncryptedDataKey: envelope.encryptedDataKey,
          bankAccountNumberKeyProvider: envelope.keyProvider, bankAccountNumberKeyId: envelope.keyId,
          bankAccountNumberKeyVersion: envelope.keyVersion, bankAccountNumberContextVersion: envelope.contextVersion,
          bankDetailsStatus: CorporateProfileSectionStatus.COMPLETE, profileVersion: { increment: 1 },
        },
      });
      if (updated.count !== 1) throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
      await this.addRevision(tx, app.id, expectedProfileVersion + 1, 'bankDetails', app.initiatingUserId,
        ['bankName', 'accountNumber', 'accountName', 'accountType', 'bvnLinkedToAccount'],
        { bankName: dto.bankName, accountNumberMasked: `••••••${dto.accountNumber.slice(-4)}`,
          accountName: dto.accountName, accountType: dto.accountType, bvnLinkedToAccount: dto.bvnLinkedToAccount, status: 'COMPLETE' });
    });
    return this.getByCorporateAccountId(principal, corporateAccountId);
  }

  /** Complete only previously missing display fields on a verified legacy Corporate identity. */
  async completeLegacyApplicantProfile(principal: AuthPrincipal | null | undefined, dto: { companyName: string; companyPhoneNumber: string }) {
    const applicant = await this.applicants.requireVerifiedInvestor(principal);
    const user = await this.prisma.user.findUnique({ where: { id: applicant.initiatingUserId }, select: { primaryAccountType: true, corporateApplicantProfile: { select: { id: true } } } });
    if (!user || user.primaryAccountType !== PrimaryAccountType.CORPORATE) throw new HttpException({ code: ERROR_CODES.FORBIDDEN, message: 'Corporate applicant identity is not available for this account.' }, HttpStatus.FORBIDDEN);
    if (user.corporateApplicantProfile) throw new HttpException({ code: ERROR_CODES.CONFLICT, message: 'Corporate applicant identity is already present.' }, HttpStatus.CONFLICT);
    const profile = await this.prisma.corporateApplicantProfile.create({ data: { userId: applicant.initiatingUserId, companyName: dto.companyName, companyPhoneNumber: dto.companyPhoneNumber } });
    return { companyName: profile.companyName, companyPhoneNumber: profile.companyPhoneNumber };
  }

  private async authorize(principal: AuthPrincipal | null | undefined, corporateAccountId: string) {
    const applicant = await this.applicants.requireVerifiedInvestor(principal);
    return this.access.requireInitiatorOwnedCorporateAccount(applicant, corporateAccountId);
  }

  /**
   * Re-proves route account ownership and locks the application row inside the
   * write transaction. A concurrent submission either waits for this save or
   * wins the row lock first, in which case this read sees the committed status
   * (or PostgreSQL aborts the serializable transaction and we return CONFLICT).
   */
  private async lockApplicationForWrite(
    tx: Prisma.TransactionClient,
    applicationId: string,
    corporateAccountId: string,
    initiatingUserId: string,
  ): Promise<{ id: string; status: OnboardingApplicationStatus }> {
    const rows = await tx.$queryRaw<Array<{ id: string; status: OnboardingApplicationStatus }>>`
      SELECT "id", "status"
      FROM "onboarding_applications"
      WHERE "id" = ${applicationId}::uuid
        AND "kind" = 'CORPORATE'::"OnboardingApplicationKind"
        AND "initiatingUserId" = ${initiatingUserId}::uuid
        AND "ownerCorporateAccountId" = ${corporateAccountId}::uuid
      FOR UPDATE
    `;
    const application = rows[0];
    if (!application) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    return application;
  }

  private async loadForWrite(tx: Prisma.TransactionClient, applicationId: string) {
    const [details, profile] = await Promise.all([
      tx.corporateOnboardingDetails.findUnique({ where: { applicationId } }),
      tx.corporateProfile.findUnique({ where: { applicationId } }),
    ]);
    if (!details) throw new HttpException(NOT_FOUND, HttpStatus.NOT_FOUND);
    return { details, profile };
  }

  private async transact(work: (tx: Prisma.TransactionClient) => Promise<void>): Promise<void> {
    try {
      await this.prisma.$transaction(work, { isolationLevel: Prisma.TransactionIsolationLevel.Serializable, maxWait: 5000, timeout: 15000 });
    } catch (error) {
      if (error instanceof HttpException) throw error;
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
        const pgCode = typeof error.meta?.code === 'string' ? error.meta.code : undefined;
        if (['P2034', 'P2002'].includes(error.code) || ['40001', '40P01'].includes(pgCode ?? '')) {
          throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
        }
      }
      throw error;
    }
  }

  private expectProfileVersion(actual: number, expected: number) {
    if (actual !== expected) throw new HttpException(CONFLICT, HttpStatus.CONFLICT);
  }
  private expectDetailsVersion(actual: number, expected: number) {
    if (actual !== expected) throw new HttpException({ code: ERROR_CODES.CONFLICT, message: 'Canonical Corporate details changed. Reload and retry with the current details version.' }, HttpStatus.CONFLICT);
  }
  private requireEditable(status: OnboardingApplicationStatus) {
    if (!(CORPORATE_DETAILS_EDITABLE_STATES as readonly OnboardingApplicationStatus[]).includes(status)) {
      throw new HttpException({ code: ERROR_CODES.CONFLICT, message: 'This application cannot be changed in its current state.' }, HttpStatus.CONFLICT);
    }
  }
  private requirePreviousComplete(profile: {
    companyDetailsStatus: CorporateProfileSectionStatus;
    companyDetailsDetailsVersion: number | null;
    investmentProfileStatus: CorporateProfileSectionStatus;
    sourceOfFundsStatus: CorporateProfileSectionStatus;
  } | null, section: Section, detailsVersion: number) {
    const index = SECTIONS.indexOf(section);
    if (index === 0) return;
    const previous = SECTIONS[index - 1];
    const column = previous === 'companyDetails' ? 'companyDetailsStatus' : previous === 'investmentProfile' ? 'investmentProfileStatus' : 'sourceOfFundsStatus';
    const previousComplete = Boolean(profile && profile[column] === CorporateProfileSectionStatus.COMPLETE);
    const companyCurrent = profile?.companyDetailsStatus === CorporateProfileSectionStatus.COMPLETE && profile.companyDetailsDetailsVersion === detailsVersion;
    if (!previousComplete || !companyCurrent) {
      throw new HttpException({ code: ERROR_CODES.CONFLICT, message: 'Complete the previous saved section first using the current canonical details version.' }, HttpStatus.CONFLICT);
    }
  }
  private async addRevision(tx: Prisma.TransactionClient, applicationId: string, version: number, section: Section, actor: string, fields: string[], snapshot: Record<string, unknown>) {
    await tx.corporateProfileRevision.create({ data: { applicationId, profileVersion: version, section, changedByUserId: actor, changedFieldNames: fields.sort(), safeSnapshot: snapshot as Prisma.InputJsonObject } });
  }
  private validation(field: string, message: string): never {
    throw new HttpException({ code: ERROR_CODES.VALIDATION_FAILED, message, fields: { [field]: message } }, HttpStatus.BAD_REQUEST);
  }
}

function hasTin(details: { taxIdentificationNumberCiphertext: string | null; taxIdentificationNumberIv: string | null; taxIdentificationNumberAuthTag: string | null; taxIdentificationNumberEncryptedDataKey: string | null; taxIdentificationNumberKeyProvider: string | null; taxIdentificationNumberKeyId: string | null; taxIdentificationNumberKeyVersion: string | null; taxIdentificationNumberContextVersion: number | null }): boolean {
  return Boolean(details.taxIdentificationNumberCiphertext && details.taxIdentificationNumberIv && details.taxIdentificationNumberAuthTag && details.taxIdentificationNumberEncryptedDataKey && details.taxIdentificationNumberKeyProvider && details.taxIdentificationNumberKeyId && details.taxIdentificationNumberKeyVersion && details.taxIdentificationNumberContextVersion === 1);
}
