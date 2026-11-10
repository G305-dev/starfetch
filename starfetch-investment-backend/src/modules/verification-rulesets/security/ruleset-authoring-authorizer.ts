import { Injectable } from '@nestjs/common';
import { AuthPrincipal } from '../../../common/types/auth-principal';

export const VERIFICATION_RULESET_AUTHORING_AUTHORIZER = Symbol('VERIFICATION_RULESET_AUTHORING_AUTHORIZER');

export interface VerificationRulesetAuthoringAuthorizationRequest {
  /** Must be derived by the authenticated access-token guard, never from request data. */
  readonly principal: AuthPrincipal;
}

export interface VerificationRulesetAuthoringAuthorizer {
  authorizeDraftWrite(request: VerificationRulesetAuthoringAuthorizationRequest): Promise<boolean>;
}

/** No role, caller-supplied id, or unapproved staff claim grants policy-authoring access. */
@Injectable()
export class DenyAllVerificationRulesetAuthoringAuthorizer implements VerificationRulesetAuthoringAuthorizer {
  async authorizeDraftWrite(): Promise<boolean> {
    return false;
  }
}
