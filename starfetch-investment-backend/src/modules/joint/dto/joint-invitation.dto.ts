import { Transform } from 'class-transformer';
import { IsEmail, IsOptional, IsString, Length, MaxLength } from 'class-validator';

/**
 * M1 request body (draft CreateJointAccountRequest). Email is normalized
 * (trim+lowercase) at the boundary; the DTO NEVER carries identity/ownership.
 */
export class CreateJointAccountDto {
  @IsOptional()
  @IsString()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @Length(1, 60)
  displayName?: string;

  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @MaxLength(254)
  inviteeEmail!: string;
}

/** M2 request body (draft CreateInvitationRequest). */
export class CreateJointInvitationDto {
  @IsEmail()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim().toLowerCase() : value))
  @MaxLength(254)
  email!: string;
}
