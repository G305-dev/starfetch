import { Injectable } from '@nestjs/common';
import { AuthPrincipal } from '../../../common/types/auth-principal';

export const VERIFICATION_RULESET_BINDING_AUTHORIZER = Symbol('VERIFICATION_RULESET_BINDING_AUTHORIZER');

export interface VerificationRulesetBindingAuthorizationRequest {
  readonly principal: AuthPrincipal;
  readonly applicationId: string;
  readonly rulesetVersionId: string;
}

/** Authorization remains an explicit capability seam; no role grants are assumed. */
export interface VerificationRulesetBindingAuthorizer {
  authorizeInitialBinding(request: VerificationRulesetBindingAuthorizationRequest): Promise<boolean>;
}

/** Production default: deny until compliance authority grants and policy are approved. */
@Injectable()
export class DenyAllVerificationRulesetBindingAuthorizer implements VerificationRulesetBindingAuthorizer {
  async authorizeInitialBinding(): Promise<boolean> {
    return false;
  }
}
