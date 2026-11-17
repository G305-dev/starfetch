import { Module } from '@nestjs/common';
import { ApplicationRulesetBindingService } from './services/application-ruleset-binding.service';
import { VerificationRulesetDraftService } from './services/verification-ruleset-draft.service';
import { ApplicationVerificationSnapshotService } from './services/application-verification-snapshot.service';
import { ApplicationVerificationSnapshotFreshnessService } from './services/application-verification-snapshot-freshness.service';
import {
  DenyAllVerificationRulesetAuthoringAuthorizer,
  VERIFICATION_RULESET_AUTHORING_AUTHORIZER,
} from './security/ruleset-authoring-authorizer';
import {
  DenyAllVerificationRulesetBindingAuthorizer,
  VERIFICATION_RULESET_BINDING_AUTHORIZER,
} from './security/ruleset-binding-authorizer';

/** Dormant internal infrastructure only. No publication, rebinding, pinning, or controller. */
@Module({
  providers: [
    VerificationRulesetDraftService,
    ApplicationRulesetBindingService,
    ApplicationVerificationSnapshotService,
    ApplicationVerificationSnapshotFreshnessService,
    DenyAllVerificationRulesetAuthoringAuthorizer,
    {
      provide: VERIFICATION_RULESET_AUTHORING_AUTHORIZER,
      useExisting: DenyAllVerificationRulesetAuthoringAuthorizer,
    },
    DenyAllVerificationRulesetBindingAuthorizer,
    {
      provide: VERIFICATION_RULESET_BINDING_AUTHORIZER,
      useExisting: DenyAllVerificationRulesetBindingAuthorizer,
    },
  ],
  exports: [VerificationRulesetDraftService, ApplicationRulesetBindingService, ApplicationVerificationSnapshotService, ApplicationVerificationSnapshotFreshnessService],
})
export class VerificationRulesetsModule {}
