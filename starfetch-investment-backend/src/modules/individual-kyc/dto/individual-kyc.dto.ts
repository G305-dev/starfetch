import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { IndividualKycIdDocumentType } from '@prisma/client';
import { IndividualKycInvestmentHorizon } from '../individual-kyc.enums';
export { INDIVIDUAL_KYC_HORIZON_LABELS, IndividualKycInvestmentHorizon } from '../individual-kyc.enums';

export const INDIVIDUAL_KYC_GENDER_VALUES = { MALE: 'MALE', FEMALE: 'FEMALE' } as const;
export type IndividualKycGenderValue = (typeof INDIVIDUAL_KYC_GENDER_VALUES)[keyof typeof INDIVIDUAL_KYC_GENDER_VALUES];
export type IndividualKycHorizonValue = IndividualKycInvestmentHorizon;

const trimString = Transform(({ value }) => typeof value === 'string' ? value.trim() : value);

export class KycVersionDto {
  @Type(() => Number)
  @IsInt()
  @Min(0)
  version!: number;
}

export class PepDetailsDto {
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  @trimString
  fullName?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  @trimString
  position?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  @Matches(/\S/)
  @trimString
  country?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  @trimString
  periodHeld?: string | null;
}

/** Partial-save DTO: absent fields are preserved, provided fields are validated. */
export class PersonalKycSectionDto extends KycVersionDto {
  @IsOptional()
  @IsDateString({ strict: true })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateOfBirth?: string | null;

  @IsOptional()
  @IsEnum(INDIVIDUAL_KYC_GENDER_VALUES)
  gender?: IndividualKycGenderValue | null;

  /** ISO 3166-1 alpha-2 shape; the approved production country allowlist remains a business decision. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  nationality?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 80)
  @Matches(/\S/)
  @trimString
  stateOfResidence?: string | null;

  @IsOptional()
  @IsString()
  @Length(5, 500)
  @Matches(/\S/)
  @trimString
  residentialAddress?: string | null;

  @IsOptional()
  @IsEnum(IndividualKycIdDocumentType)
  idDocumentType?: IndividualKycIdDocumentType | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  @trimString
  occupation?: string | null;

  @IsOptional()
  @IsEnum({ YES: 'YES', NO: 'NO' })
  pepStatus?: 'YES' | 'NO' | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => PepDetailsDto)
  pepDetails?: PepDetailsDto | null;
}

export class InvestmentProfileKycSectionDto extends KycVersionDto {
  /** The report supplies no approved objective vocabulary; v1 stores bounded opaque user text without interpreting it. */
  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  @trimString
  primaryInvestmentObjective?: string | null;

  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/\S/)
  @trimString
  riskTolerance?: string | null;

  @IsOptional()
  @IsEnum(IndividualKycInvestmentHorizon)
  investmentHorizon?: IndividualKycHorizonValue | null;

  @IsOptional()
  @IsString()
  @Length(1, 120)
  @Matches(/\S/)
  @trimString
  investmentKnowledgeExperience?: string | null;

  /** ISO 4217-shaped currency code; an approved currency allowlist is still required before completion. */
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{3}$/)
  financialCurrency?: string | null;

  /** Integer minor units, encoded as digits to avoid JSON float loss. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,18}$/)
  expectedWithdrawalsMinor?: string | null;

  /** Report locates annual income and estimated net worth in this section. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{1,18}$/)
  annualIncomeMinor?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,18}$/)
  estimatedNetWorthMinor?: string | null;

  /** Bounded text until Compliance/Product approves a frequency vocabulary. */
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/\S/)
  @trimString
  withdrawalFrequency?: string | null;

  @IsOptional()
  @IsString()
  @MaxLength(1000)
  @trimString
  investmentRestrictions?: string | null;
}

export class SourceOfFundsKycSectionDto extends KycVersionDto {
  /** Opaque, bounded labels until a Compliance-approved source-of-funds enum is supplied. */
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @ArrayUnique()
  @IsString({ each: true })
  @Length(1, 80, { each: true })
  sourceOfFunds?: string[] | null;

  @IsOptional()
  @IsString()
  @Length(1, 300)
  @Matches(/\S/)
  @trimString
  otherSource?: string | null;

  @IsOptional()
  @IsString()
  @Matches(/^\d{1,18}$/)
  expectedAnnualInflowMinor?: string | null;

  /** Bounded text until Compliance approves the transaction-frequency values. */
  @IsOptional()
  @IsString()
  @Length(1, 80)
  @Matches(/\S/)
  @trimString
  expectedTransactionFrequency?: string | null;
}

export class BankDetailsKycSectionDto extends KycVersionDto {
  @IsOptional()
  @IsString()
  @Length(2, 120)
  @Matches(/\S/)
  @trimString
  bankName?: string | null;

  /** NUBAN: exactly 10 digits. The value is encrypted immediately and never returned unmasked. */
  @IsOptional()
  @IsString()
  @Matches(/^\d{10}$/)
  accountNumber?: string | null;

  @IsOptional()
  @IsString()
  @Length(2, 160)
  @Matches(/\S/)
  @trimString
  accountName?: string | null;

  /** Bounded opaque string; final account-type allowlist is unresolved. */
  @IsOptional()
  @IsString()
  @Length(1, 40)
  @Matches(/\S/)
  @trimString
  accountType?: string | null;

  /** Declaration only, never BVN verification; raw BVN values are not accepted. */
  @IsOptional()
  @IsBoolean()
  bvnLinkedToAccount?: boolean | null;
}

export class IdDocumentUploadIntentDto extends KycVersionDto {
  @IsEnum(IndividualKycIdDocumentType)
  documentType!: IndividualKycIdDocumentType;

  @IsString()
  @Length(1, 128)
  @Matches(/^[^/\\]+$/)
  originalFilename!: string;

  @IsString()
  @IsEnum({ 'application/pdf': 'application/pdf', 'image/jpeg': 'image/jpeg', 'image/png': 'image/png' })
  contentType!: 'application/pdf' | 'image/jpeg' | 'image/png';

  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(10 * 1024 * 1024)
  sizeBytes!: number;

  /** SHA-256 digest of the exact File bytes, standard base64. S3 and the Nigerian worker re-verify it. */
  @IsString()
  @Length(44, 44)
  @Matches(/^[A-Za-z0-9+/]{43}=$/)
  checksumSha256!: string;
}

export class CompleteIdDocumentDto extends KycVersionDto {}

export class SubmitIndividualKycDto extends KycVersionDto {}
