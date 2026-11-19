import { Transform } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsBoolean, IsIn, IsOptional, IsString, Length, Matches, MaxLength } from 'class-validator';

const trimmed = ({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value;
const trimmedOptional = ({ value }: { value: unknown }) => typeof value === 'string' && value.trim() === '' ? undefined : trimmed({ value });

export class CorporateProfileCompanyDetailsDto {
  @Transform(trimmed) @IsString() @Length(1, 255)
  rcNumber!: string;

  @Transform(trimmed) @IsString() @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateOfIncorporation!: string;

  /** Empty means retain the existing encrypted canonical TIN; it never clears. */
  @Transform(trimmedOptional) @IsOptional() @IsString() @Length(1, 256)
  taxIdentificationNumber?: string;

  @Transform(trimmed) @IsString() @Length(1, 255)
  registeredAddress!: string;

  @Transform(trimmed) @IsString() @Length(1, 120)
  city!: string;

  @Transform(trimmed) @IsString() @Length(1, 120)
  state!: string;
}

export const CORPORATE_OBJECTIVES = ['Capital preservation', 'Income', 'Balanced', 'Growth'] as const;
export const CORPORATE_RISK_CHOICES = ['Conservative', 'Moderate', 'Balanced', 'Aggressive'] as const;
export const CORPORATE_HORIZONS = ['< 1 year', '1–3 years', '3–5 years', '5 years +'] as const;
export const CORPORATE_SOURCE_CHOICES = ['Business income / operating cash', 'Sale of assets', 'Loan / financing', 'Other (specify)'] as const;

export class CorporateProfileInvestmentDto {
  @Transform(trimmed) @IsIn(CORPORATE_OBJECTIVES)
  primaryObjective!: typeof CORPORATE_OBJECTIVES[number];

  @Transform(trimmed) @IsIn(CORPORATE_RISK_CHOICES)
  riskTolerance!: typeof CORPORATE_RISK_CHOICES[number];

  @Transform(trimmed) @IsIn(CORPORATE_HORIZONS)
  investmentHorizon!: typeof CORPORATE_HORIZONS[number];

  @Transform(trimmed) @IsString() @Length(1, 120)
  expectedWithdrawals!: string;

  @Transform(trimmed) @IsString() @Length(1, 120)
  withdrawalFrequency!: string;

  @Transform(trimmedOptional) @IsOptional() @IsString() @MaxLength(500)
  restrictionsOrExclusions?: string;
}

export class CorporateProfileSourceOfFundsDto {
  @IsArray() @ArrayMinSize(1) @ArrayMaxSize(4) @IsIn(CORPORATE_SOURCE_CHOICES, { each: true })
  selectedSources!: Array<typeof CORPORATE_SOURCE_CHOICES[number]>;

  @Transform(trimmedOptional) @IsOptional() @IsString() @MaxLength(500)
  otherSource?: string;

  /** Numeric NGN amount from the current frontend number input, not a float. */
  @Transform(trimmed) @IsString() @Matches(/^\d{1,15}(?:\.\d{1,2})?$/)
  expectedAnnualInflow!: string;

  @Transform(trimmed) @IsString() @Length(1, 120)
  expectedTransactionFrequency!: string;
}

export class CorporateProfileBankDetailsDto {
  @Transform(trimmed) @IsString() @Length(1, 120)
  bankName!: string;

  @Transform(trimmed) @IsString() @Matches(/^\d{10}$/)
  accountNumber!: string;

  @Transform(trimmed) @IsString() @Length(1, 160)
  accountName!: string;

  @Transform(trimmed) @IsString() @Length(1, 80)
  accountType!: string;

  @IsBoolean()
  bvnLinkedToAccount!: boolean;
}

export class LegacyCorporateApplicantProfileDto {
  @Transform(trimmed) @IsString() @Length(1, 160)
  companyName!: string;

  @Transform(trimmed) @IsString() @Matches(/^\+?[0-9][0-9()\-\s]{5,18}[0-9]$/) @Length(7, 32)
  companyPhoneNumber!: string;
}

export function ngnToKobo(value: string): bigint {
  const match = /^(\d{1,15})(?:\.(\d{1,2}))?$/.exec(value);
  if (!match) throw new Error('Invalid monetary value');
  const amount = BigInt(match[1]) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
  if (amount > 9_223_372_036_854_775_807n) throw new Error('Monetary value is out of range');
  return amount;
}

/** Optional safe numeric interpretation; free-text statements remain intact. */
export function withdrawalsToKobo(value: string): bigint | null {
  if (/^no withdrawals planned$/i.test(value)) return null;
  const match = /^₦?\s*(\d{1,3}(?:,\d{3})*|\d+)(?:\.(\d{1,2}))?$/.exec(value);
  if (match) {
    const whole = match[1].replace(/,/g, '');
    const amount = BigInt(whole) * 100n + BigInt((match[2] ?? '').padEnd(2, '0') || '0');
    if (amount > 9_223_372_036_854_775_807n) throw new Error('Monetary value is out of range');
    return amount;
  }
  if (/[₦\d]/.test(value)) throw new Error('Use an unambiguous NGN amount or text such as No withdrawals planned');
  return null;
}

export function koboToNaira(value: bigint | null): string | null {
  if (value === null) return null;
  const major = value / 100n;
  const minor = (value % 100n).toString().padStart(2, '0');
  return minor === '00' ? major.toString() : `${major}.${minor}`;
}

export function parseCorporateProfileIfMatch(header: string | undefined): { profileVersion: number; detailsVersion?: number } {
  // Company Details coordinates the independently versioned canonical O4 row
  // and new Corporate profile row atomically: "profile-<n>;details-<n>".
  const company = /^"profile-(0|[1-9]\d*);details-([1-9]\d*)"$/.exec(header ?? '');
  if (company) {
    const profileVersion = Number(company[1]);
    const detailsVersion = Number(company[2]);
    if (Number.isSafeInteger(profileVersion) && Number.isSafeInteger(detailsVersion)) return { profileVersion, detailsVersion };
  }
  const section = /^"profile-(0|[1-9]\d*)"$/.exec(header ?? '');
  if (section) {
    const profileVersion = Number(section[1]);
    if (Number.isSafeInteger(profileVersion)) return { profileVersion };
  }
  throw new BadRequestException({ code: 'VALIDATION_FAILED', message: 'A valid quoted If-Match Corporate Profile version is required.' });
}
