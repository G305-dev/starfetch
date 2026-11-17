import { IsEnum, IsOptional, IsUUID, Matches } from 'class-validator';
import { ManualDocumentReviewDecision } from '@prisma/client';

export class VerificationDocumentUploadDto {
  @IsUUID('4') applicationId!: string;
  @IsUUID('4') requirementId!: string;
  @IsOptional() @IsUUID('4') replacesDocumentId?: string;
}

export class VerificationDocumentDecisionDto {
  @IsEnum(ManualDocumentReviewDecision) decision!: ManualDocumentReviewDecision;
  @Matches(/^[A-Z][A-Z0-9_]{1,79}$/) reasonCode!: string;
}
