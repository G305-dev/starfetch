import { IsEnum, IsString, Matches } from 'class-validator';
import { ManualDocumentReviewDecision } from '@prisma/client';

export class IndividualKycDocumentDecisionDto {
  @IsEnum(ManualDocumentReviewDecision)
  decision!: ManualDocumentReviewDecision;

  @IsString()
  @Matches(/^[A-Z][A-Z0-9_]{1,79}$/)
  reasonCode!: string;
}
