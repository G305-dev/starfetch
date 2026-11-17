import { Injectable } from '@nestjs/common';
import { AuthPrincipal } from '../../common/types/auth-principal';

export const INDIVIDUAL_KYC_DOCUMENT_REVIEW_AUTHORIZER = Symbol('INDIVIDUAL_KYC_DOCUMENT_REVIEW_AUTHORIZER');

export interface IndividualKycDocumentReviewAuthorizer {
  authorizeQueue(principal: AuthPrincipal): Promise<boolean>;
  authorizeDocument(principal: AuthPrincipal, documentId: string): Promise<boolean>;
  authorizeDecision(principal: AuthPrincipal, documentId: string): Promise<boolean>;
}

/** Fail closed until a separately approved least-privilege staff-permission provider is installed. */
@Injectable()
export class DenyAllIndividualKycDocumentReviewAuthorizer implements IndividualKycDocumentReviewAuthorizer {
  async authorizeQueue(): Promise<boolean> { return false; }
  async authorizeDocument(): Promise<boolean> { return false; }
  async authorizeDecision(): Promise<boolean> { return false; }
}
