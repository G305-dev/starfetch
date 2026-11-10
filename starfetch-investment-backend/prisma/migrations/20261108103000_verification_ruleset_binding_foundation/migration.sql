-- C1.3 dormant, data-driven verification ruleset and application-binding
-- foundation. This migration intentionally seeds no rulesets or approvals.

CREATE TYPE "VerificationRulesetLifecycle" AS ENUM ('DRAFT', 'PUBLISHED');
CREATE TYPE "ApplicationRulesetBindingEventKind" AS ENUM ('BOUND', 'SUBMISSION_PINNED');

-- The composite application FK below verifies account kind at the database
-- boundary without changing existing Individual/Joint ownership semantics.
CREATE UNIQUE INDEX "onboarding_applications_id_kind_key"
  ON "onboarding_applications"("id", "kind");

CREATE TABLE "verification_rulesets" (
  "id" UUID NOT NULL,
  "rulesetKey" VARCHAR(120) NOT NULL,
  "accountKind" "OnboardingApplicationKind" NOT NULL,
  "createdByUserId" UUID NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verification_rulesets_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verification_rulesets_rulesetKey_nonempty_check" CHECK (length(btrim("rulesetKey")) > 0)
);

CREATE TABLE "verification_ruleset_versions" (
  "id" UUID NOT NULL,
  "rulesetId" UUID NOT NULL,
  "accountKind" "OnboardingApplicationKind" NOT NULL,
  "version" INTEGER NOT NULL,
  "lifecycle" "VerificationRulesetLifecycle" NOT NULL DEFAULT 'DRAFT',
  "createdByUserId" UUID NOT NULL,
  "updatedByUserId" UUID,
  "approvedByUserId" UUID,
  "approvedAt" TIMESTAMP(3),
  "publishedByUserId" UUID,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "verification_ruleset_versions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verification_ruleset_versions_version_positive_check" CHECK ("version" >= 1),
  CONSTRAINT "verification_ruleset_versions_approval_publication_shape_check" CHECK (
    ("lifecycle" = 'DRAFT' AND "approvedByUserId" IS NULL AND "approvedAt" IS NULL AND "publishedByUserId" IS NULL AND "publishedAt" IS NULL)
    OR
    ("lifecycle" = 'PUBLISHED' AND "approvedByUserId" IS NOT NULL AND "approvedAt" IS NOT NULL AND "publishedByUserId" IS NOT NULL AND "publishedAt" IS NOT NULL)
  )
);

CREATE TABLE "verification_subject_definitions" (
  "id" UUID NOT NULL,
  "rulesetVersionId" UUID NOT NULL,
  "subjectKey" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verification_subject_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verification_subject_definitions_subjectKey_nonempty_check" CHECK (length(btrim("subjectKey")) > 0)
);

CREATE TABLE "verification_check_definitions" (
  "id" UUID NOT NULL,
  "rulesetVersionId" UUID NOT NULL,
  "subjectDefinitionId" UUID NOT NULL,
  "checkKindKey" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verification_check_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verification_check_definitions_checkKindKey_nonempty_check" CHECK (length(btrim("checkKindKey")) > 0)
);

CREATE TABLE "accepted_evidence_source_definitions" (
  "id" UUID NOT NULL,
  "rulesetVersionId" UUID NOT NULL,
  "checkDefinitionId" UUID NOT NULL,
  "evidenceSourceKey" VARCHAR(120) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "accepted_evidence_source_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "accepted_evidence_source_definitions_key_nonempty_check" CHECK (length(btrim("evidenceSourceKey")) > 0)
);

CREATE TABLE "conditional_document_requirement_definitions" (
  "id" UUID NOT NULL,
  "rulesetVersionId" UUID NOT NULL,
  "requirementKey" VARCHAR(120) NOT NULL,
  "documentKindKey" VARCHAR(120) NOT NULL,
  "condition" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "conditional_document_requirement_definitions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "conditional_document_requirement_definitions_key_nonempty_check" CHECK (length(btrim("requirementKey")) > 0 AND length(btrim("documentKindKey")) > 0),
  CONSTRAINT "conditional_document_requirement_definitions_condition_object_check" CHECK (jsonb_typeof("condition") = 'object')
);

CREATE TABLE "onboarding_application_ruleset_bindings" (
  "id" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "accountKind" "OnboardingApplicationKind" NOT NULL,
  "rulesetVersionId" UUID NOT NULL,
  "boundByUserId" UUID NOT NULL,
  "boundAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "onboarding_application_ruleset_bindings_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "application_ruleset_binding_events" (
  "id" UUID NOT NULL,
  "bindingId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "accountKind" "OnboardingApplicationKind" NOT NULL,
  "rulesetVersionId" UUID NOT NULL,
  "eventKind" "ApplicationRulesetBindingEventKind" NOT NULL,
  "operationId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_ruleset_binding_events_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "onboarding_application_ruleset_pins" (
  "id" UUID NOT NULL,
  "bindingId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "accountKind" "OnboardingApplicationKind" NOT NULL,
  "rulesetVersionId" UUID NOT NULL,
  "pinnedByUserId" UUID NOT NULL,
  "pinnedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "onboarding_application_ruleset_pins_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "verification_rulesets_rulesetKey_accountKind_key" ON "verification_rulesets"("rulesetKey", "accountKind");
CREATE UNIQUE INDEX "verification_rulesets_id_accountKind_key" ON "verification_rulesets"("id", "accountKind");
CREATE UNIQUE INDEX "verification_ruleset_versions_rulesetId_version_key" ON "verification_ruleset_versions"("rulesetId", "version");
CREATE UNIQUE INDEX "verification_ruleset_versions_id_accountKind_key" ON "verification_ruleset_versions"("id", "accountKind");
CREATE UNIQUE INDEX "verification_subject_definitions_rulesetVersionId_subjectKe_key" ON "verification_subject_definitions"("rulesetVersionId", "subjectKey");
CREATE UNIQUE INDEX "verification_subject_definitions_id_rulesetVersionId_key" ON "verification_subject_definitions"("id", "rulesetVersionId");
CREATE UNIQUE INDEX "verification_check_definitions_subjectDefinitionId_checkKin_key" ON "verification_check_definitions"("subjectDefinitionId", "checkKindKey");
CREATE UNIQUE INDEX "verification_check_definitions_id_rulesetVersionId_key" ON "verification_check_definitions"("id", "rulesetVersionId");
CREATE UNIQUE INDEX "accepted_evidence_source_definitions_checkDefinitionId_evid_key" ON "accepted_evidence_source_definitions"("checkDefinitionId", "evidenceSourceKey");
CREATE UNIQUE INDEX "conditional_document_requirement_definitions_rulesetVersion_key" ON "conditional_document_requirement_definitions"("rulesetVersionId", "requirementKey");
CREATE UNIQUE INDEX "onboarding_application_ruleset_bindings_operationId_key" ON "onboarding_application_ruleset_bindings"("operationId");
CREATE UNIQUE INDEX "onboarding_application_ruleset_bindings_applicationId_key" ON "onboarding_application_ruleset_bindings"("applicationId");
CREATE UNIQUE INDEX "onboarding_application_ruleset_bindings_id_applicationId_ru_key" ON "onboarding_application_ruleset_bindings"("id", "applicationId", "rulesetVersionId", "accountKind");
CREATE UNIQUE INDEX "onboarding_application_ruleset_bindings_applicationId_accou_key" ON "onboarding_application_ruleset_bindings"("applicationId", "accountKind");
CREATE UNIQUE INDEX "application_ruleset_binding_events_operationId_key" ON "application_ruleset_binding_events"("operationId");
CREATE UNIQUE INDEX "application_ruleset_binding_events_bindingId_eventKind_key" ON "application_ruleset_binding_events"("bindingId", "eventKind");
CREATE INDEX "application_ruleset_binding_events_applicationId_occurredAt_idx" ON "application_ruleset_binding_events"("applicationId", "occurredAt");
CREATE UNIQUE INDEX "onboarding_application_ruleset_pins_bindingId_key" ON "onboarding_application_ruleset_pins"("bindingId");
CREATE UNIQUE INDEX "onboarding_application_ruleset_pins_applicationId_key" ON "onboarding_application_ruleset_pins"("applicationId");
CREATE UNIQUE INDEX "onboarding_application_ruleset_pins_applicationId_accountKi_key" ON "onboarding_application_ruleset_pins"("applicationId", "accountKind");
CREATE UNIQUE INDEX "onboarding_application_ruleset_pins_bindingId_applicationId_key" ON "onboarding_application_ruleset_pins"("bindingId", "applicationId", "rulesetVersionId", "accountKind");

ALTER TABLE "verification_rulesets" ADD CONSTRAINT "verification_rulesets_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_ruleset_versions" ADD CONSTRAINT "verification_ruleset_versions_rulesetId_accountKind_fkey"
  FOREIGN KEY ("rulesetId", "accountKind") REFERENCES "verification_rulesets"("id", "accountKind") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_ruleset_versions" ADD CONSTRAINT "verification_ruleset_versions_createdByUserId_fkey"
  FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_ruleset_versions" ADD CONSTRAINT "verification_ruleset_versions_updatedByUserId_fkey"
  FOREIGN KEY ("updatedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_ruleset_versions" ADD CONSTRAINT "verification_ruleset_versions_approvedByUserId_fkey"
  FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_ruleset_versions" ADD CONSTRAINT "verification_ruleset_versions_publishedByUserId_fkey"
  FOREIGN KEY ("publishedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_subject_definitions" ADD CONSTRAINT "verification_subject_definitions_rulesetVersionId_fkey"
  FOREIGN KEY ("rulesetVersionId") REFERENCES "verification_ruleset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_check_definitions" ADD CONSTRAINT "verification_check_definitions_rulesetVersionId_fkey"
  FOREIGN KEY ("rulesetVersionId") REFERENCES "verification_ruleset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_check_definitions" ADD CONSTRAINT "verification_check_definitions_subjectDefinitionId_ruleset_fkey"
  FOREIGN KEY ("subjectDefinitionId", "rulesetVersionId") REFERENCES "verification_subject_definitions"("id", "rulesetVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accepted_evidence_source_definitions" ADD CONSTRAINT "accepted_evidence_source_definitions_rulesetVersionId_fkey"
  FOREIGN KEY ("rulesetVersionId") REFERENCES "verification_ruleset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "accepted_evidence_source_definitions" ADD CONSTRAINT "accepted_evidence_source_definitions_checkDefinitionId_rul_fkey"
  FOREIGN KEY ("checkDefinitionId", "rulesetVersionId") REFERENCES "verification_check_definitions"("id", "rulesetVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "conditional_document_requirement_definitions" ADD CONSTRAINT "conditional_document_requirement_definitions_rulesetVersio_fkey"
  FOREIGN KEY ("rulesetVersionId") REFERENCES "verification_ruleset_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "onboarding_application_ruleset_bindings" ADD CONSTRAINT "onboarding_application_ruleset_bindings_applicationId_acco_fkey"
  FOREIGN KEY ("applicationId", "accountKind") REFERENCES "onboarding_applications"("id", "kind") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "onboarding_application_ruleset_bindings" ADD CONSTRAINT "onboarding_application_ruleset_bindings_rulesetVersionId_a_fkey"
  FOREIGN KEY ("rulesetVersionId", "accountKind") REFERENCES "verification_ruleset_versions"("id", "accountKind") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "onboarding_application_ruleset_bindings" ADD CONSTRAINT "onboarding_application_ruleset_bindings_boundByUserId_fkey"
  FOREIGN KEY ("boundByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_ruleset_binding_events" ADD CONSTRAINT "application_ruleset_binding_events_bindingId_applicationId_fkey"
  FOREIGN KEY ("bindingId", "applicationId", "rulesetVersionId", "accountKind") REFERENCES "onboarding_application_ruleset_bindings"("id", "applicationId", "rulesetVersionId", "accountKind") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_ruleset_binding_events" ADD CONSTRAINT "application_ruleset_binding_events_actorUserId_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "onboarding_application_ruleset_pins" ADD CONSTRAINT "onboarding_application_ruleset_pins_applicationId_accountK_fkey"
  FOREIGN KEY ("applicationId", "accountKind") REFERENCES "onboarding_applications"("id", "kind") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "onboarding_application_ruleset_pins" ADD CONSTRAINT "onboarding_application_ruleset_pins_bindingId_applicationI_fkey"
  FOREIGN KEY ("bindingId", "applicationId", "rulesetVersionId", "accountKind") REFERENCES "onboarding_application_ruleset_bindings"("id", "applicationId", "rulesetVersionId", "accountKind") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "onboarding_application_ruleset_pins" ADD CONSTRAINT "onboarding_application_ruleset_pins_rulesetVersionId_accou_fkey"
  FOREIGN KEY ("rulesetVersionId", "accountKind") REFERENCES "verification_ruleset_versions"("id", "accountKind") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "onboarding_application_ruleset_pins" ADD CONSTRAINT "onboarding_application_ruleset_pins_pinnedByUserId_fkey"
  FOREIGN KEY ("pinnedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Identity tuples do not change across draft edits or publication.
CREATE FUNCTION "protect_verification_ruleset_identity"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."rulesetKey" IS DISTINCT FROM OLD."rulesetKey"
     OR NEW."accountKind" IS DISTINCT FROM OLD."accountKind"
     OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Verification ruleset identity is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "verification_rulesets_identity_immutable_trigger"
  BEFORE UPDATE ON "verification_rulesets"
  FOR EACH ROW EXECUTE FUNCTION "protect_verification_ruleset_identity"();

-- Draft versions can be prepared. Publishing is accepted by the database only
-- with explicit attribution and structurally complete, non-empty definitions.
CREATE FUNCTION "protect_verification_ruleset_version"() RETURNS TRIGGER AS $$
DECLARE subject_count INTEGER;
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."lifecycle" = 'PUBLISHED' THEN
      RAISE EXCEPTION 'Published verification ruleset versions are immutable' USING ERRCODE = '23514';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW."rulesetId" IS DISTINCT FROM OLD."rulesetId"
     OR NEW."accountKind" IS DISTINCT FROM OLD."accountKind"
     OR NEW."version" IS DISTINCT FROM OLD."version"
     OR NEW."createdByUserId" IS DISTINCT FROM OLD."createdByUserId"
     OR NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Verification ruleset version identity is immutable' USING ERRCODE = '23514';
  END IF;
  IF OLD."lifecycle" = 'PUBLISHED' THEN
    RAISE EXCEPTION 'Published verification ruleset versions are immutable' USING ERRCODE = '23514';
  END IF;

  IF NEW."lifecycle" = 'PUBLISHED' THEN
    IF NEW."approvedByUserId" IS NULL OR NEW."approvedAt" IS NULL
       OR NEW."publishedByUserId" IS NULL OR NEW."publishedAt" IS NULL THEN
      RAISE EXCEPTION 'Publication requires approval and publication attribution' USING ERRCODE = '23514';
    END IF;
    SELECT count(*) INTO subject_count
      FROM "verification_subject_definitions" WHERE "rulesetVersionId" = NEW."id";
    IF subject_count = 0 THEN
      RAISE EXCEPTION 'An empty ruleset cannot be published' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "verification_subject_definitions" s
      WHERE s."rulesetVersionId" = NEW."id"
        AND NOT EXISTS (SELECT 1 FROM "verification_check_definitions" c WHERE c."subjectDefinitionId" = s."id")
    ) THEN
      RAISE EXCEPTION 'Every required subject needs at least one required check' USING ERRCODE = '23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM "verification_check_definitions" c
      WHERE c."rulesetVersionId" = NEW."id"
        AND NOT EXISTS (SELECT 1 FROM "accepted_evidence_source_definitions" e WHERE e."checkDefinitionId" = c."id")
    ) THEN
      RAISE EXCEPTION 'Every required check needs an accepted evidence-source definition' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "verification_ruleset_versions_immutable_publish_trigger"
  BEFORE UPDATE OR DELETE ON "verification_ruleset_versions"
  FOR EACH ROW EXECUTE FUNCTION "protect_verification_ruleset_version"();

-- Definition rows are editable only while their owning version is DRAFT.
CREATE FUNCTION "require_draft_verification_ruleset_definition"() RETURNS TRIGGER AS $$
DECLARE version_id UUID;
DECLARE version_lifecycle "VerificationRulesetLifecycle";
DECLARE old_version_lifecycle "VerificationRulesetLifecycle";
BEGIN
  -- Moving a child row out of a PUBLISHED version is also a forbidden edit.
  IF TG_OP = 'UPDATE' THEN
    SELECT "lifecycle" INTO old_version_lifecycle
      FROM "verification_ruleset_versions" WHERE "id" = OLD."rulesetVersionId";
    IF old_version_lifecycle IS DISTINCT FROM 'DRAFT'::"VerificationRulesetLifecycle" THEN
      RAISE EXCEPTION 'Published ruleset definitions cannot be moved or modified' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF TG_OP = 'DELETE' THEN
    version_id := OLD."rulesetVersionId";
  ELSE
    version_id := NEW."rulesetVersionId";
  END IF;
  SELECT "lifecycle" INTO version_lifecycle
    FROM "verification_ruleset_versions" WHERE "id" = version_id;
  IF version_lifecycle IS DISTINCT FROM 'DRAFT'::"VerificationRulesetLifecycle" THEN
    RAISE EXCEPTION 'Definitions can only be changed while their ruleset version is DRAFT' USING ERRCODE = '23514';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "verification_subject_definitions_draft_only_trigger"
  BEFORE INSERT OR UPDATE OR DELETE ON "verification_subject_definitions"
  FOR EACH ROW EXECUTE FUNCTION "require_draft_verification_ruleset_definition"();
CREATE TRIGGER "verification_check_definitions_draft_only_trigger"
  BEFORE INSERT OR UPDATE OR DELETE ON "verification_check_definitions"
  FOR EACH ROW EXECUTE FUNCTION "require_draft_verification_ruleset_definition"();
CREATE TRIGGER "accepted_evidence_source_definitions_draft_only_trigger"
  BEFORE INSERT OR UPDATE OR DELETE ON "accepted_evidence_source_definitions"
  FOR EACH ROW EXECUTE FUNCTION "require_draft_verification_ruleset_definition"();
CREATE TRIGGER "conditional_document_requirement_definitions_draft_only_trigger"
  BEFORE INSERT OR UPDATE OR DELETE ON "conditional_document_requirement_definitions"
  FOR EACH ROW EXECUTE FUNCTION "require_draft_verification_ruleset_definition"();

-- Initial binding is limited to a DRAFT application and a complete approved
-- PUBLISHED version of the exact same account kind. The runtime authorizer is
-- independently fail-closed; this trigger is an additional database guard.
CREATE FUNCTION "validate_application_ruleset_binding"() RETURNS TRIGGER AS $$
DECLARE app_status "OnboardingApplicationStatus";
DECLARE version_lifecycle "VerificationRulesetLifecycle";
DECLARE approved_user UUID;
DECLARE approved_time TIMESTAMP(3);
DECLARE publisher_user UUID;
DECLARE published_time TIMESTAMP(3);
BEGIN
  SELECT "status" INTO app_status FROM "onboarding_applications" WHERE "id" = NEW."applicationId";
  IF app_status IS DISTINCT FROM 'DRAFT'::"OnboardingApplicationStatus" THEN
    RAISE EXCEPTION 'Ruleset binding requires an unsubmitted DRAFT application' USING ERRCODE = '23514';
  END IF;
  SELECT "lifecycle", "approvedByUserId", "approvedAt", "publishedByUserId", "publishedAt"
    INTO version_lifecycle, approved_user, approved_time, publisher_user, published_time
    FROM "verification_ruleset_versions"
    WHERE "id" = NEW."rulesetVersionId" AND "accountKind" = NEW."accountKind";
  IF version_lifecycle IS DISTINCT FROM 'PUBLISHED'::"VerificationRulesetLifecycle"
     OR approved_user IS NULL OR approved_time IS NULL OR publisher_user IS NULL OR published_time IS NULL THEN
    RAISE EXCEPTION 'Only an approved, published ruleset version can be bound' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "verification_subject_definitions" WHERE "rulesetVersionId" = NEW."rulesetVersionId")
     OR EXISTS (
       SELECT 1 FROM "verification_subject_definitions" s
       WHERE s."rulesetVersionId" = NEW."rulesetVersionId"
         AND NOT EXISTS (SELECT 1 FROM "verification_check_definitions" c WHERE c."subjectDefinitionId" = s."id")
     )
     OR EXISTS (
       SELECT 1 FROM "verification_check_definitions" c
       WHERE c."rulesetVersionId" = NEW."rulesetVersionId"
         AND NOT EXISTS (SELECT 1 FROM "accepted_evidence_source_definitions" e WHERE e."checkDefinitionId" = c."id")
     ) THEN
    RAISE EXCEPTION 'Incomplete ruleset versions cannot authorize application binding' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "onboarding_application_ruleset_binding_guard_trigger"
  BEFORE INSERT ON "onboarding_application_ruleset_bindings"
  FOR EACH ROW EXECUTE FUNCTION "validate_application_ruleset_binding"();

CREATE FUNCTION "prevent_ruleset_binding_rewrite"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ruleset bindings are immutable; rebinding is not enabled' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "onboarding_application_ruleset_binding_immutable_trigger"
  BEFORE UPDATE ON "onboarding_application_ruleset_bindings"
  FOR EACH ROW EXECUTE FUNCTION "prevent_ruleset_binding_rewrite"();

CREATE FUNCTION "protect_application_ruleset_binding_event"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'Ruleset binding audit events are immutable' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" = 'BOUND' THEN
    IF NOT EXISTS (
      SELECT 1 FROM "onboarding_application_ruleset_bindings" b
      WHERE b."id" = NEW."bindingId" AND b."operationId" = NEW."operationId"
        AND b."applicationId" = NEW."applicationId" AND b."rulesetVersionId" = NEW."rulesetVersionId"
        AND b."accountKind" = NEW."accountKind" AND b."boundByUserId" = NEW."actorUserId"
    ) THEN
      RAISE EXCEPTION 'BOUND audit event must match its immutable binding operation' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "application_ruleset_binding_events_guard_trigger"
  BEFORE INSERT OR UPDATE ON "application_ruleset_binding_events"
  FOR EACH ROW EXECUTE FUNCTION "protect_application_ruleset_binding_event"();

-- Binding and submission pinning are distinct. A pin is accepted only in the
-- same transaction as a non-DRAFT status change and its SUBMISSION_PINNED audit.
CREATE FUNCTION "validate_application_ruleset_pin"() RETURNS TRIGGER AS $$
DECLARE app_status "OnboardingApplicationStatus";
BEGIN
  SELECT "status" INTO app_status FROM "onboarding_applications" WHERE "id" = NEW."applicationId";
  IF app_status IS NULL OR app_status = 'DRAFT'::"OnboardingApplicationStatus" THEN
    RAISE EXCEPTION 'A ruleset version cannot be submission-pinned for a DRAFT application' USING ERRCODE = '23514';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "application_ruleset_binding_events" e
    WHERE e."bindingId" = NEW."bindingId" AND e."applicationId" = NEW."applicationId"
      AND e."rulesetVersionId" = NEW."rulesetVersionId"
      AND e."eventKind" = 'SUBMISSION_PINNED'::"ApplicationRulesetBindingEventKind"
  ) THEN
    RAISE EXCEPTION 'Submission pin requires an explicit SUBMISSION_PINNED audit event' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "onboarding_application_ruleset_pin_guard_trigger"
  AFTER INSERT ON "onboarding_application_ruleset_pins"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "validate_application_ruleset_pin"();

CREATE FUNCTION "validate_submission_pinned_event"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."eventKind" = 'SUBMISSION_PINNED'::"ApplicationRulesetBindingEventKind"
     AND NOT EXISTS (
       SELECT 1 FROM "onboarding_application_ruleset_pins" p
       WHERE p."bindingId" = NEW."bindingId" AND p."applicationId" = NEW."applicationId"
         AND p."rulesetVersionId" = NEW."rulesetVersionId" AND p."accountKind" = NEW."accountKind"
         AND p."pinnedByUserId" = NEW."actorUserId"
     ) THEN
    RAISE EXCEPTION 'SUBMISSION_PINNED audit event requires a matching immutable pin' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "application_ruleset_submission_audit_guard_trigger"
  AFTER INSERT ON "application_ruleset_binding_events"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "validate_submission_pinned_event"();

-- Every committed initial binding carries a matching audit row.
CREATE FUNCTION "ensure_application_ruleset_binding_audit"() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "application_ruleset_binding_events" e
    WHERE e."bindingId" = NEW."id" AND e."applicationId" = NEW."applicationId"
      AND e."rulesetVersionId" = NEW."rulesetVersionId" AND e."accountKind" = NEW."accountKind"
      AND e."eventKind" = 'BOUND'::"ApplicationRulesetBindingEventKind"
      AND e."operationId" = NEW."operationId" AND e."actorUserId" = NEW."boundByUserId"
  ) THEN
    RAISE EXCEPTION 'Application ruleset binding requires its BOUND audit event' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "application_ruleset_binding_audit_required_trigger"
  AFTER INSERT ON "onboarding_application_ruleset_bindings"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "ensure_application_ruleset_binding_audit"();
