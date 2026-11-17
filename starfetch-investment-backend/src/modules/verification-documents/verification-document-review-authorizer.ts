import { Injectable } from '@nestjs/common';
import { AuthPrincipal } from '../../common/types/auth-principal';

export const VERIFICATION_DOCUMENT_REVIEW_AUTHORIZER = Symbol('VERIFICATION_DOCUMENT_REVIEW_AUTHORIZER');

export interface VerificationDocumentReviewAuthorizer {
  authorizeReview(principal: AuthPrincipal, applicationId: string): Promise<boolean>;
}

/** No production staff grants are configured in this checkout; keep review endpoints deny-by-default. */
@Injectable()
export class DenyAllVerificationDocumentReviewAuthorizer implements VerificationDocumentReviewAuthorizer {
  async authorizeReview(): Promise<boolean> { return false; }
}
