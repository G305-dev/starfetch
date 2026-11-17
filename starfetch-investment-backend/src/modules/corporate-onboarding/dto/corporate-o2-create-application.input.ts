import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, MaxLength, Matches, isEmail } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { normalizeEmail } from '../../../common/utils/email-mask';
import { CorporateO2Payload } from '../crypto/corporate-o2-hmac-keyring';

/** Exactly the approved six O2 Business Information inputs. */
export class CorporateO2CreateApplicationDto {
  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 255)
  institutionName!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  dateOfIncorporation!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 255)
  rcNumber!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 256)
  taxIdentificationNumber!: string;

  @Transform(({ value }) => typeof value === 'string' ? value.trim() : value)
  @IsString()
  @Length(1, 64)
  businessPhoneNumber!: string;

  @Transform(({ value }) => typeof value === 'string' ? normalizeEmail(value) : value)
  @IsString()
  @IsEmail({ allow_display_name: false })
  @MaxLength(254)
  businessEmail!: string;
}

const ALLOWED_FIELDS = new Set([
  'institutionName',
  'dateOfIncorporation',
  'rcNumber',
  'taxIdentificationNumber',
  'businessPhoneNumber',
  'businessEmail',
]);

/** Structural validation only; no TIN/RC eligibility or registry policy is inferred. */
export function canonicalizeCorporateO2Input(input: CorporateO2CreateApplicationDto | Record<string, unknown>): CorporateO2Payload {
  const value = input as unknown as Record<string, unknown>;
  const keys = Object.keys(value ?? {});
  const errors: string[] = [];
  for (const key of keys) if (!ALLOWED_FIELDS.has(key)) errors.push(`${key} should not be provided`);
  for (const key of ALLOWED_FIELDS) if (!Object.prototype.hasOwnProperty.call(value ?? {}, key)) errors.push(`${key} should not be empty`);
  for (const key of ALLOWED_FIELDS) {
    if (typeof value?.[key] !== 'string' || (value[key] as string).trim().length === 0) {
      errors.push(`${key} must be a non-empty string`);
    }
  }
  if (errors.length) throw new BadRequestException(errors);

  const date = (value.dateOfIncorporation as string).trim();
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00.000Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date) {
    errors.push('dateOfIncorporation must be a valid YYYY-MM-DD date');
  }
  const businessEmail = normalizeEmail(value.businessEmail as string);
  if (!isEmail(businessEmail, { allow_display_name: false })) errors.push('businessEmail must be a valid email address');
  if (businessEmail.length > 254) errors.push('businessEmail must be at most 254 characters');
  if (errors.length) throw new BadRequestException(errors);

  return {
    institutionName: (value.institutionName as string).trim(),
    dateOfIncorporation: date,
    rcNumber: (value.rcNumber as string).trim(),
    taxIdentificationNumber: (value.taxIdentificationNumber as string).trim(),
    businessPhoneNumber: (value.businessPhoneNumber as string).trim(),
    businessEmail,
  };
}
