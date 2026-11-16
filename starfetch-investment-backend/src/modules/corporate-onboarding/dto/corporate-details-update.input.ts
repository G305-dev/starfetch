import { BadRequestException } from '@nestjs/common';
import { IsEmail, IsNotEmpty, IsOptional, IsString, Length, Matches } from 'class-validator';
import { isEmail } from 'class-validator';
import { normalizeEmail } from '../../../common/utils/email-mask';

/** Strict public O4 input: six original business-information fields only. */
export class CorporateDetailsUpdateDto implements CorporateDetailsUpdateInput {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  institutionName?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateOfIncorporation?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 255)
  rcNumber?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 64)
  businessPhoneNumber?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @IsEmail({ allow_display_name: false })
  @Length(1, 254)
  businessEmail?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @Length(1, 256)
  taxIdentificationNumber?: string;
}

export interface CorporateDetailsUpdateInput {
  institutionName?: string;
  dateOfIncorporation?: string;
  rcNumber?: string;
  businessPhoneNumber?: string;
  businessEmail?: string;
  taxIdentificationNumber?: string;
}

export type CanonicalCorporateDetailsPatch = Partial<{
  institutionName: string;
  dateOfIncorporation: Date;
  rcNumber: string;
  businessPhoneNumber: string;
  businessEmail: string;
  /** Plaintext exists only transiently until encrypted; never persisted/logged. */
  taxIdentificationNumber: string;
}>;

const ALLOWED_FIELDS = new Set([
  'institutionName',
  'dateOfIncorporation',
  'rcNumber',
  'businessPhoneNumber',
  'businessEmail',
  'taxIdentificationNumber',
]);

/**
 * Structural validation only. It does not encode registry, eligibility, or
 * other business policy. The TIN is returned only to the crypto boundary.
 */
export function canonicalizeCorporateDetailsPatch(
  input: CorporateDetailsUpdateInput,
): CanonicalCorporateDetailsPatch {
  if (input === null || typeof input !== 'object' || Array.isArray(input)) {
    throw new BadRequestException(['details update must be an object']);
  }

  const value = input as Record<string, unknown>;
  // Class-transformer instances can materialize optional DTO properties as
  // enumerable `undefined` fields. They are absent patch fields, not invalid
  // client-supplied values.
  const keys = Object.keys(value).filter((key) => value[key] !== undefined);
  const errors: string[] = [];
  const patch: CanonicalCorporateDetailsPatch = {};

  if (keys.length === 0) errors.push('at least one details field must be provided');
  for (const key of keys) {
    if (!ALLOWED_FIELDS.has(key)) errors.push(`${key} should not be provided`);
  }

  for (const key of keys) {
    if (!ALLOWED_FIELDS.has(key)) continue;
    const candidate = value[key];
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      errors.push(`${key} must be a non-empty string`);
      continue;
    }

    switch (key) {
      case 'institutionName': {
        const normalized = candidate.trim();
        if (normalized.length > 255) errors.push('institutionName must be at most 255 characters');
        else patch.institutionName = normalized;
        break;
      }
      case 'rcNumber': {
        const normalized = candidate.trim();
        if (normalized.length > 255) errors.push('rcNumber must be at most 255 characters');
        else patch.rcNumber = normalized;
        break;
      }
      case 'businessPhoneNumber': {
        const normalized = candidate.trim();
        if (normalized.length > 64) errors.push('businessPhoneNumber must be at most 64 characters');
        else patch.businessPhoneNumber = normalized;
        break;
      }
      case 'taxIdentificationNumber': {
        const normalized = candidate.trim();
        if (normalized.length > 256) errors.push('taxIdentificationNumber must be at most 256 characters');
        else patch.taxIdentificationNumber = normalized;
        break;
      }
      case 'dateOfIncorporation': {
        const isoDate = canonicalIsoDate(candidate);
        if (!isoDate) errors.push('dateOfIncorporation must be a valid YYYY-MM-DD date');
        else patch.dateOfIncorporation = new Date(`${isoDate}T00:00:00.000Z`);
        break;
      }
      case 'businessEmail': {
        const email = normalizeEmail(candidate);
        if (!isEmail(email, { allow_display_name: false })) {
          errors.push('businessEmail must be a valid email address');
        } else if (email.length > 254) {
          errors.push('businessEmail must be at most 254 characters');
        } else {
          patch.businessEmail = email;
        }
        break;
      }
    }
  }

  if (errors.length > 0) throw new BadRequestException(errors);
  return patch;
}

function canonicalIsoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) return null;
  return trimmed;
}
