-- Guard against TRUNCATE bypassing row-level append-only/immutability triggers.
-- Schema owners remain privileged operators and must not be used as the
-- production application's runtime database role.
CREATE FUNCTION "reject_protected_table_truncate"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Protected verification and ruleset tables cannot be truncated' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "verification_rulesets_no_truncate_trigger"
  BEFORE TRUNCATE ON "verification_rulesets" FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();
CREATE TRIGGER "verification_ruleset_versions_no_truncate_trigger"
  BEFORE TRUNCATE ON "verification_ruleset_versions" FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();
CREATE TRIGGER "verification_subject_definitions_no_truncate_trigger"
  BEFORE TRUNCATE ON "verification_subject_definitions" FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();
CREATE TRIGGER "verification_check_definitions_no_truncate_trigger"
  BEFORE TRUNCATE ON "verification_check_definitions" FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();
CREATE TRIGGER "accepted_evidence_source_definitions_no_truncate_trigger"
  BEFORE TRUNCATE ON "accepted_evidence_source_definitions" FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();
CREATE TRIGGER "conditional_document_requirement_definitions_no_truncate_trigger"
  BEFORE TRUNCATE ON "conditional_document_requirement_definitions" FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();
CREATE TRIGGER "onboarding_application_ruleset_bindings_no_truncate_trigger"
  BEFORE TRUNCATE ON "onboarding_application_ruleset_bindings" FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();
CREATE TRIGGER "application_ruleset_binding_events_no_truncate_trigger"
  BEFORE TRUNCATE ON "application_ruleset_binding_events" FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();
CREATE TRIGGER "onboarding_application_ruleset_pins_no_truncate_trigger"
  BEFORE TRUNCATE ON "onboarding_application_ruleset_pins" FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();
CREATE TRIGGER "application_verification_snapshots_no_truncate_trigger"
  BEFORE TRUNCATE ON "application_verification_snapshots" FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();
CREATE TRIGGER "application_verification_subject_snapshots_no_truncate_trigger"
  BEFORE TRUNCATE ON "application_verification_subject_snapshots" FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();
CREATE TRIGGER "application_verification_requirements_no_truncate_trigger"
  BEFORE TRUNCATE ON "application_verification_requirements" FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();
