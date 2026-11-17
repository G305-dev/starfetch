import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Length, MaxLength, MinLength, ValidateIf } from 'class-validator';
import { PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from '../services/password.service';

/**
 * Public applicant registration. Omitted registrationType defaults to the
 * legacy Individual flow; Corporate applicants can omit names and do not get
 * an InvestorProfile. `confirmPassword`, phone, and arbitrary role fields are
 * rejected by the global forbidNonWhitelisted ValidationPipe. Passphrases are
 * allowed; password length is 8–128 characters.
 */
export class RegisterDto {
  /** Defaults to INDIVIDUAL for backwards compatibility. CORPORATE creates an
   * authenticated applicant without creating an InvestorProfile row. This is
   * an onboarding intent, never a public UserRole selector. */
  @ValidateIf((_dto: RegisterDto, value: unknown) => value !== undefined)
  @IsIn(['INDIVIDUAL', 'CORPORATE'])
  registrationType?: 'INDIVIDUAL' | 'CORPORATE';

  @ValidateIf((dto: RegisterDto) => dto.registrationType !== 'CORPORATE' || dto.firstName !== undefined)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  firstName?: string;

  @ValidateIf((dto: RegisterDto) => dto.registrationType !== 'CORPORATE' || dto.lastName !== undefined)
  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 60)
  lastName?: string;

  @Transform(({ value }: { value: unknown }) => (typeof value === 'string' ? value.trim() : value))
  @IsEmail()
  @MaxLength(320)
  email!: string;

  @IsString()
  @MinLength(PASSWORD_MIN_LENGTH, {
    message: `password must be at least ${PASSWORD_MIN_LENGTH} characters`,
  })
  @MaxLength(PASSWORD_MAX_LENGTH, {
    message: `password must be at most ${PASSWORD_MAX_LENGTH} characters`,
  })
  password!: string;
}
