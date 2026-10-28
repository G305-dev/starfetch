import { IsString, IsUUID, Matches } from 'class-validator';

export class VerifyEmailDto {
  @IsUUID()
  verificationId!: string;

  /** Exactly 6 numeric digits. */
  @IsString()
  @Matches(/^[0-9]{6}$/, { message: 'code must be exactly 6 digits' })
  code!: string;
}
