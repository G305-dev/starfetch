import { Transform } from 'class-transformer';
import { IsOptional, IsString, Length, Matches, ValidateIf } from 'class-validator';

/**
 * Pragmatic local/international phone sanity rule for the approved OPTIONAL
 * profile field (e.g. +2348012345678, 0801 234 5678). When richer phone
 * policy arrives with a later approved phase, this is the single place to
 * tighten it.
 */
export const PHONE_PATTERN = /^\+?[0-9][0-9()\-\s]{5,18}[0-9]$/;

const trim = ({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value);

/**
 * PUT /me/profile updatable subset (D-06 v1 / contract row 9).
 * `email` is deliberately NOT declared — the global forbidNonWhitelisted pipe
 * rejects it as an unknown property, so email can never be edited here.
 * `phone` may be omitted (unchanged) or explicitly null (cleared).
 */
export class UpdateProfileDto {
  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  firstName?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @Length(1, 60)
  lastName?: string;

  @IsOptional()
  @ValidateIf((_dto, value) => value !== null)
  @Transform(trim)
  @IsString()
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone?: string | null;
}
