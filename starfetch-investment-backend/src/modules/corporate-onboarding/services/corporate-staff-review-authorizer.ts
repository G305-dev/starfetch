import { Injectable } from '@nestjs/common';
import { AuthPrincipal } from '../../../common/types/auth-principal';

export const CORPORATE_STAFF_REVIEW_AUTHORIZER = Symbol('CORPORATE_STAFF_REVIEW_AUTHORIZER');

export interface CorporateStaffReviewAuthorizer {
  authorizeQueue(principal: AuthPrincipal): Promise<boolean>;
  authorizeReview(principal: AuthPrincipal, applicationId: string): Promise<boolean>;
  authorizeFinalCompliance(principal: AuthPrincipal, applicationId: string): Promise<boolean>;
}

/** No staff authority exists until an approved staff grant/configuration is supplied. */
@Injectable()
export class DenyAllCorporateStaffReviewAuthorizer implements CorporateStaffReviewAuthorizer {
  async authorizeQueue(): Promise<boolean> { return false; }
  async authorizeReview(): Promise<boolean> { return false; }
  async authorizeFinalCompliance(): Promise<boolean> { return false; }
}
