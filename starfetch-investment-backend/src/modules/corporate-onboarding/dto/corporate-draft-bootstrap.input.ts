import { isEmail } from 'class-validator';
import { BadRequestException } from '@nestjs/common';
import { normalizeEmail } from '../../../common/utils/email-mask';
import { CorporateDraftBootstrapPayload } from '../crypto/corporate-draft-fingerprint';

/**
 * Internal, non-public bootstrap input. Deliberately excludes TIN and all
 * account-owner, authority, declaration, mandate, bank and decision fields.
 */
export interface CorporateDraftBootstrapInput {
  institutionName: string;
  dateOfIncorporation: string;
  rcNumber: string;
  businessPhoneNumber: string;
  businessEmail: string;
}

const ALLOWED_FIELDS = new Set([
  'institutionName',
  'dateOfIncorporation',
  'rcNumber',
  'businessPhoneNumber',
  'businessEmail',
]);

/** Validate only structural requirements; do not invent registry/eligibility policy. */
export function canonicalizeCorporateDraftBootstrap(
  input: CorporateDraftBootstrapInput,
): CorporateDraftBootstrapPayload {
  const value = input as unknown as Record<string, unknown>;
  const keys = Object.keys(value ?? {});
  const errors: string[] = [];

  for (const key of keys) {
    if (!ALLOWED_FIELDS.has(key)) errors.push(`${key} should not be provided`);
  }
  for (const key of ALLOWED_FIELDS) {
    if (!Object.prototype.hasOwnProperty.call(value ?? {}, key)) {
      errors.push(`${key} should not be empty`);
    }
  }

  const stringFields = [
    'institutionName',
    'dateOfIncorporation',
    'rcNumber',
    'businessPhoneNumber',
    'businessEmail',
  ] as const;
  for (const key of stringFields) {
    const candidate = value?.[key];
    if (typeof candidate !== 'string' || candidate.trim().length === 0) {
      errors.push(`${key} must be a non-empty string`);
    }
  }

  if (errors.length > 0) {
    throw new BadRequestException(errors);
  }

  const institutionName = (value.institutionName as string).trim();
  const dateOfIncorporation = canonicalIsoDate(value.dateOfIncorporation as string);
  const rcNumber = (value.rcNumber as string).trim();
  const businessPhoneNumber = (value.businessPhoneNumber as string).trim();
  const businessEmail = normalizeEmail(value.businessEmail as string);

  if (!dateOfIncorporation) errors.push('dateOfIncorporation must be a valid YYYY-MM-DD date');
  if (!isEmail(businessEmail, { allow_display_name: false })) {
    errors.push('businessEmail must be a valid email address');
  }
  if (businessEmail.length > 254) errors.push('businessEmail must be at most 254 characters');

  if (errors.length > 0) throw new BadRequestException(errors);

  return {
    institutionName,
    dateOfIncorporation: dateOfIncorporation as string,
    rcNumber,
    businessPhoneNumber,
    businessEmail,
  };
}

function canonicalIsoDate(value: string): string | null {
  const trimmed = value.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return null;
  const parsed = new Date(`${trimmed}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== trimmed) return null;
  return trimmed;
}
