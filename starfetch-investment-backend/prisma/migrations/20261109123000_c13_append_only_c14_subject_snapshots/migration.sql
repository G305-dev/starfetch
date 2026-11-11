-- Forward-only C1.3 audit hardening and C1.4 subject/requirement snapshots.
-- CreateEnum
CREATE TYPE "VerificationSubjectTargetKind" AS ENUM ('INDIVIDUAL_APPLICANT', 'JOINT_ACCOUNT_MEMBER', 'CORPORATE_LEGAL_ENTITY', 'CORPORATE_AUTHORIZED_REPRESENTATIVE', 'CORPORATE_BENEFICIAL_OWNER');

-- CreateEnum
CREATE TYPE "VerificationSubjectResolutionState" AS ENUM ('RESOLVED', 'UNRESOLVED');

-- CreateEnum
CREATE TYPE "VerificationResolutionIssue" AS ENUM ('MISSING_APPLICANT_IDENTITY', 'NO_ACTIVE_JOINT_MEMBERS', 'CORPORATE_PERSON_SOURCE_UNAVAILABLE', 'SUBJECT_KIND_NOT_APPLICABLE', 'LEGACY_SUBJECT_KIND_UNCLASSIFIED', 'DOCUMENT_CONDITION_NOT_EVALUATED');

-- CreateEnum
CREATE TYPE "ApplicationVerificationRequirementStage" AS ENUM ('TIER_1_BASIC_MONO', 'TIER_2_DOCUMENTS', 'TIER_3_STAFF_COMPLIANCE');

-- CreateEnum
CREATE TYPE "ApplicationVerificationRequirementKind" AS ENUM ('VERIFICATION_CHECK', 'CONDITIONAL_DOCUMENT', 'STAFF_REVIEW', 'INDEPENDENT_COMPLIANCE_APPROVAL');

-- CreateEnum
CREATE TYPE "ApplicationVerificationRequirementState" AS ENUM ('PENDING', 'UNRESOLVED');

-- AlterTable
ALTER TABLE "verification_subject_definitions" ADD COLUMN     "targetKind" "VerificationSubjectTargetKind";

-- CreateTable
CREATE TABLE "application_verification_snapshots" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "bindingId" UUID NOT NULL,
    "accountKind" "OnboardingApplicationKind" NOT NULL,
    "rulesetVersionId" UUID NOT NULL,
    "corporateDetailsVersion" INTEGER,
    "createdByUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_verification_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_verification_subject_snapshots" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "rulesetVersionId" UUID NOT NULL,
    "subjectDefinitionId" UUID NOT NULL,
    "targetKind" "VerificationSubjectTargetKind",
    "resolutionState" "VerificationSubjectResolutionState" NOT NULL,
    "unresolvedIssue" "VerificationResolutionIssue",
    "resolvedUserId" UUID,
    "resolvedCorporateAccountId" UUID,
    "sourceJointMembershipId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_verification_subject_snapshots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "application_verification_requirements" (
    "id" UUID NOT NULL,
    "snapshotId" UUID NOT NULL,
    "rulesetVersionId" UUID NOT NULL,
    "subjectSnapshotId" UUID,
    "requirementKind" "ApplicationVerificationRequirementKind" NOT NULL,
    "stage" "ApplicationVerificationRequirementStage" NOT NULL,
    "state" "ApplicationVerificationRequirementState" NOT NULL DEFAULT 'PENDING',
    "unresolvedIssue" "VerificationResolutionIssue",
    "requirementKey" VARCHAR(320) NOT NULL,
    "sourceCheckDefinitionId" UUID,
    "sourceDocumentRequirementDefinitionId" UUID,
    "conditionSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "application_verification_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "application_verification_snapshots_applicationId_key" ON "application_verification_snapshots"("applicationId");

-- CreateIndex
CREATE UNIQUE INDEX "application_verification_snapshots_bindingId_key" ON "application_verification_snapshots"("bindingId");

-- CreateIndex
CREATE UNIQUE INDEX "application_verification_snapshots_id_rulesetVersionId_key" ON "application_verification_snapshots"("id", "rulesetVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "application_verification_snapshots_id_rulesetVersionId_acco_key" ON "application_verification_snapshots"("id", "rulesetVersionId", "accountKind");

-- CreateIndex
CREATE UNIQUE INDEX "application_verification_snapshots_applicationId_accountKin_key" ON "application_verification_snapshots"("applicationId", "accountKind");

-- CreateIndex
CREATE UNIQUE INDEX "application_verification_snapshots_bindingId_applicationId__key" ON "application_verification_snapshots"("bindingId", "applicationId", "rulesetVersionId", "accountKind");

-- CreateIndex
CREATE UNIQUE INDEX "application_verification_subject_snapshots_id_snapshotId_ru_key" ON "application_verification_subject_snapshots"("id", "snapshotId", "rulesetVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "avs_snapshot_subject_user_key" ON "application_verification_subject_snapshots"("snapshotId", "subjectDefinitionId", "resolvedUserId");

-- CreateIndex
CREATE UNIQUE INDEX "avs_snapshot_subject_entity_key" ON "application_verification_subject_snapshots"("snapshotId", "subjectDefinitionId", "resolvedCorporateAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "application_verification_requirements_snapshotId_requiremen_key" ON "application_verification_requirements"("snapshotId", "requirementKey");

-- CreateIndex
CREATE UNIQUE INDEX "conditional_document_requirement_definitions_id_rulesetVers_key" ON "conditional_document_requirement_definitions"("id", "rulesetVersionId");

-- AddForeignKey
ALTER TABLE "application_verification_snapshots" ADD CONSTRAINT "application_verification_snapshots_applicationId_accountKi_fkey" FOREIGN KEY ("applicationId", "accountKind") REFERENCES "onboarding_applications"("id", "kind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification_snapshots" ADD CONSTRAINT "application_verification_snapshots_bindingId_applicationId_fkey" FOREIGN KEY ("bindingId", "applicationId", "rulesetVersionId", "accountKind") REFERENCES "onboarding_application_ruleset_bindings"("id", "applicationId", "rulesetVersionId", "accountKind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification_snapshots" ADD CONSTRAINT "application_verification_snapshots_rulesetVersionId_accoun_fkey" FOREIGN KEY ("rulesetVersionId", "accountKind") REFERENCES "verification_ruleset_versions"("id", "accountKind") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification_snapshots" ADD CONSTRAINT "application_verification_snapshots_createdByUserId_fkey" FOREIGN KEY ("createdByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification_subject_snapshots" ADD CONSTRAINT "application_verification_subject_snapshots_snapshotId_rule_fkey" FOREIGN KEY ("snapshotId", "rulesetVersionId") REFERENCES "application_verification_snapshots"("id", "rulesetVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification_subject_snapshots" ADD CONSTRAINT "application_verification_subject_snapshots_subjectDefiniti_fkey" FOREIGN KEY ("subjectDefinitionId", "rulesetVersionId") REFERENCES "verification_subject_definitions"("id", "rulesetVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification_subject_snapshots" ADD CONSTRAINT "application_verification_subject_snapshots_resolvedUserId_fkey" FOREIGN KEY ("resolvedUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification_subject_snapshots" ADD CONSTRAINT "application_verification_subject_snapshots_resolvedCorpora_fkey" FOREIGN KEY ("resolvedCorporateAccountId") REFERENCES "corporate_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification_subject_snapshots" ADD CONSTRAINT "application_verification_subject_snapshots_sourceJointMemb_fkey" FOREIGN KEY ("sourceJointMembershipId") REFERENCES "joint_account_members"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification_requirements" ADD CONSTRAINT "application_verification_requirements_snapshotId_rulesetVe_fkey" FOREIGN KEY ("snapshotId", "rulesetVersionId") REFERENCES "application_verification_snapshots"("id", "rulesetVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification_requirements" ADD CONSTRAINT "application_verification_requirements_subjectSnapshotId_sn_fkey" FOREIGN KEY ("subjectSnapshotId", "snapshotId", "rulesetVersionId") REFERENCES "application_verification_subject_snapshots"("id", "snapshotId", "rulesetVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification_requirements" ADD CONSTRAINT "application_verification_requirements_sourceCheckDefinitio_fkey" FOREIGN KEY ("sourceCheckDefinitionId", "rulesetVersionId") REFERENCES "verification_check_definitions"("id", "rulesetVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "application_verification_requirements" ADD CONSTRAINT "application_verification_requirements_sourceDocumentRequir_fkey" FOREIGN KEY ("sourceDocumentRequirementDefinitionId", "rulesetVersionId") REFERENCES "conditional_document_requirement_definitions"("id", "rulesetVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;



-- C1.3 security hardening: append-only audit, binding and submission-pin rows.
CREATE FUNCTION "reject_immutable_ruleset_record_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Ruleset binding, pin and audit records are append-only' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "onboarding_application_ruleset_bindings_no_delete_trigger"
  BEFORE DELETE ON "onboarding_application_ruleset_bindings"
  FOR EACH ROW EXECUTE FUNCTION "reject_immutable_ruleset_record_mutation"();
CREATE TRIGGER "application_ruleset_binding_events_no_delete_trigger"
  BEFORE DELETE ON "application_ruleset_binding_events"
  FOR EACH ROW EXECUTE FUNCTION "reject_immutable_ruleset_record_mutation"();
CREATE TRIGGER "onboarding_application_ruleset_pins_immutable_trigger"
  BEFORE UPDATE OR DELETE ON "onboarding_application_ruleset_pins"
  FOR EACH ROW EXECUTE FUNCTION "reject_immutable_ruleset_record_mutation"();

-- Legacy C1.3 subject definitions remain nullable so this additive migration
-- does not invent a type for old records. They are blocked from new publication
-- or binding until an explicitly typed ruleset version exists.
CREATE FUNCTION "validate_verification_subject_target_kind"() RETURNS TRIGGER AS $$
DECLARE account_kind "OnboardingApplicationKind";
BEGIN
  IF NEW."targetKind" IS NULL THEN RETURN NEW; END IF;
  SELECT "accountKind" INTO account_kind FROM "verification_ruleset_versions"
    WHERE "id" = NEW."rulesetVersionId";
  IF account_kind IS NULL OR NOT (
    (account_kind = 'INDIVIDUAL' AND NEW."targetKind" = 'INDIVIDUAL_APPLICANT') OR
    (account_kind = 'JOINT' AND NEW."targetKind" = 'JOINT_ACCOUNT_MEMBER') OR
    (account_kind = 'CORPORATE' AND NEW."targetKind" IN (
      'CORPORATE_LEGAL_ENTITY', 'CORPORATE_AUTHORIZED_REPRESENTATIVE', 'CORPORATE_BENEFICIAL_OWNER'
    ))
  ) THEN
    RAISE EXCEPTION 'Verification subject target kind does not match its ruleset account kind' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "verification_subject_target_kind_guard_trigger"
  BEFORE INSERT OR UPDATE ON "verification_subject_definitions"
  FOR EACH ROW EXECUTE FUNCTION "validate_verification_subject_target_kind"();

CREATE FUNCTION "require_typed_verification_subjects_before_publish"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."lifecycle" = 'PUBLISHED'::"VerificationRulesetLifecycle" AND OLD."lifecycle" <> 'PUBLISHED'::"VerificationRulesetLifecycle" THEN
    IF EXISTS (
      SELECT 1 FROM "verification_subject_definitions" s
      WHERE s."rulesetVersionId" = NEW."id" AND s."targetKind" IS NULL
    ) THEN
      RAISE EXCEPTION 'A ruleset with unclassified required subjects cannot be published' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "verification_ruleset_typed_subjects_publish_guard_trigger"
  BEFORE UPDATE ON "verification_ruleset_versions"
  FOR EACH ROW EXECUTE FUNCTION "require_typed_verification_subjects_before_publish"();

CREATE FUNCTION "require_typed_verification_subjects_before_binding"() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "verification_subject_definitions" s
    WHERE s."rulesetVersionId" = NEW."rulesetVersionId" AND s."targetKind" IS NULL
  ) THEN
    RAISE EXCEPTION 'A ruleset with unclassified required subjects cannot be bound' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "verification_ruleset_typed_subjects_binding_guard_trigger"
  BEFORE INSERT ON "onboarding_application_ruleset_bindings"
  FOR EACH ROW EXECUTE FUNCTION "require_typed_verification_subjects_before_binding"();

-- Snapshot creation re-proves actor ownership and captures a version that is
-- already bound and published. This does not submit the application or create a pin.
CREATE FUNCTION "validate_application_verification_snapshot"() RETURNS TRIGGER AS $$
DECLARE app_kind "OnboardingApplicationKind";
DECLARE app_status "OnboardingApplicationStatus";
DECLARE owner_user UUID;
DECLARE owner_corporate UUID;
DECLARE owner_joint UUID;
DECLARE initiator UUID;
DECLARE details_version INTEGER;
DECLARE version_lifecycle "VerificationRulesetLifecycle";
BEGIN
  SELECT "kind", "status", "ownerUserId", "ownerCorporateAccountId", "ownerJointAccountId", "initiatingUserId"
    INTO app_kind, app_status, owner_user, owner_corporate, owner_joint, initiator
    FROM "onboarding_applications" WHERE "id" = NEW."applicationId";
  IF app_kind IS NULL OR app_kind <> NEW."accountKind" THEN
    RAISE EXCEPTION 'Snapshot account context does not match its application' USING ERRCODE = '23514';
  END IF;
  IF app_status NOT IN ('DRAFT'::"OnboardingApplicationStatus", 'INFO_REQUESTED'::"OnboardingApplicationStatus") THEN
    RAISE EXCEPTION 'Requirement snapshots are only allowed for editable applications' USING ERRCODE = '23514';
  END IF;
  IF app_kind = 'INDIVIDUAL' AND NEW."createdByUserId" <> owner_user THEN
    RAISE EXCEPTION 'Snapshot actor does not own the Individual application' USING ERRCODE = '23514';
  ELSIF app_kind = 'CORPORATE' AND NEW."createdByUserId" <> initiator THEN
    RAISE EXCEPTION 'Snapshot actor is not the Corporate application initiator' USING ERRCODE = '23514';
  ELSIF app_kind = 'JOINT' AND NOT EXISTS (
    SELECT 1 FROM "joint_account_members" m
    WHERE m."jointAccountId" = owner_joint AND m."userId" = NEW."createdByUserId"
  ) THEN
    RAISE EXCEPTION 'Snapshot actor is not an active Joint account member' USING ERRCODE = '23514';
  END IF;
  SELECT "lifecycle" INTO version_lifecycle FROM "verification_ruleset_versions"
    WHERE "id" = NEW."rulesetVersionId" AND "accountKind" = NEW."accountKind";
  IF version_lifecycle IS DISTINCT FROM 'PUBLISHED'::"VerificationRulesetLifecycle" THEN
    RAISE EXCEPTION 'Requirement snapshot requires its exact published bound ruleset version' USING ERRCODE = '23514';
  END IF;
  IF app_kind = 'CORPORATE' THEN
    SELECT "version" INTO details_version FROM "corporate_onboarding_details"
      WHERE "applicationId" = NEW."applicationId";
    IF details_version IS DISTINCT FROM NEW."corporateDetailsVersion" THEN
      RAISE EXCEPTION 'Corporate details version does not match the canonical application record' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."corporateDetailsVersion" IS NOT NULL THEN
    RAISE EXCEPTION 'Non-Corporate snapshots cannot reference Corporate details' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "application_verification_snapshot_insert_guard_trigger"
  BEFORE INSERT ON "application_verification_snapshots"
  FOR EACH ROW EXECUTE FUNCTION "validate_application_verification_snapshot"();

CREATE FUNCTION "validate_application_verification_subject_snapshot"() RETURNS TRIGGER AS $$
DECLARE app_id UUID;
DECLARE app_kind "OnboardingApplicationKind";
DECLARE owner_user UUID;
DECLARE owner_corporate UUID;
DECLARE owner_joint UUID;
DECLARE definition_target "VerificationSubjectTargetKind";
BEGIN
  SELECT s."applicationId", s."accountKind", a."ownerUserId", a."ownerCorporateAccountId", a."ownerJointAccountId"
    INTO app_id, app_kind, owner_user, owner_corporate, owner_joint
    FROM "application_verification_snapshots" s
    JOIN "onboarding_applications" a ON a."id" = s."applicationId"
    WHERE s."id" = NEW."snapshotId" AND s."rulesetVersionId" = NEW."rulesetVersionId";
  SELECT "targetKind" INTO definition_target FROM "verification_subject_definitions"
    WHERE "id" = NEW."subjectDefinitionId" AND "rulesetVersionId" = NEW."rulesetVersionId";
  IF app_id IS NULL OR definition_target IS DISTINCT FROM NEW."targetKind" THEN
    RAISE EXCEPTION 'Subject snapshot must preserve its exact source definition and version' USING ERRCODE = '23514';
  END IF;
  IF NEW."resolutionState" = 'UNRESOLVED'::"VerificationSubjectResolutionState" THEN
    IF NEW."unresolvedIssue" IS NULL OR NEW."resolvedUserId" IS NOT NULL
       OR NEW."resolvedCorporateAccountId" IS NOT NULL OR NEW."sourceJointMembershipId" IS NOT NULL THEN
      RAISE EXCEPTION 'Unresolved subject snapshots cannot invent or link an identity' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."unresolvedIssue" IS NOT NULL THEN
    RAISE EXCEPTION 'Resolved subject snapshots cannot carry an unresolved issue' USING ERRCODE = '23514';
  END IF;
  IF NEW."targetKind" = 'INDIVIDUAL_APPLICANT' AND app_kind = 'INDIVIDUAL'
     AND NEW."resolvedUserId" = owner_user AND NEW."resolvedCorporateAccountId" IS NULL
     AND NEW."sourceJointMembershipId" IS NULL THEN
    RETURN NEW;
  ELSIF NEW."targetKind" = 'JOINT_ACCOUNT_MEMBER' AND app_kind = 'JOINT'
     AND NEW."resolvedUserId" IS NOT NULL AND NEW."resolvedCorporateAccountId" IS NULL
     AND EXISTS (
       SELECT 1 FROM "joint_account_members" m
       WHERE m."id" = NEW."sourceJointMembershipId" AND m."jointAccountId" = owner_joint
         AND m."userId" = NEW."resolvedUserId"
     ) THEN
    RETURN NEW;
  ELSIF NEW."targetKind" = 'CORPORATE_LEGAL_ENTITY' AND app_kind = 'CORPORATE'
     AND NEW."resolvedCorporateAccountId" = owner_corporate AND NEW."resolvedUserId" IS NULL
     AND NEW."sourceJointMembershipId" IS NULL THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Resolved subject reference does not match the typed application account context' USING ERRCODE = '23514';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "application_verification_subject_snapshot_insert_guard_trigger"
  BEFORE INSERT ON "application_verification_subject_snapshots"
  FOR EACH ROW EXECUTE FUNCTION "validate_application_verification_subject_snapshot"();

CREATE FUNCTION "validate_application_verification_requirement"() RETURNS TRIGGER AS $$
DECLARE subject_definition UUID;
DECLARE source_condition JSONB;
BEGIN
  IF (NEW."state" = 'PENDING'::"ApplicationVerificationRequirementState" AND NEW."unresolvedIssue" IS NOT NULL)
     OR (NEW."state" = 'UNRESOLVED'::"ApplicationVerificationRequirementState" AND NEW."unresolvedIssue" IS NULL) THEN
    RAISE EXCEPTION 'Requirement state and unresolved issue must agree' USING ERRCODE = '23514';
  END IF;
  IF NEW."requirementKind" = 'VERIFICATION_CHECK'::"ApplicationVerificationRequirementKind" THEN
    IF NEW."stage" <> 'TIER_1_BASIC_MONO'::"ApplicationVerificationRequirementStage"
       OR NEW."subjectSnapshotId" IS NULL OR NEW."sourceCheckDefinitionId" IS NULL
       OR NEW."sourceDocumentRequirementDefinitionId" IS NOT NULL OR NEW."conditionSnapshot" IS NOT NULL THEN
      RAISE EXCEPTION 'Invalid Tier 1 verification-check snapshot shape' USING ERRCODE = '23514';
    END IF;
    SELECT d."subjectDefinitionId" INTO subject_definition FROM "verification_check_definitions" d
      WHERE d."id" = NEW."sourceCheckDefinitionId" AND d."rulesetVersionId" = NEW."rulesetVersionId";
    IF subject_definition IS DISTINCT FROM (
      SELECT s."subjectDefinitionId" FROM "application_verification_subject_snapshots" s
      WHERE s."id" = NEW."subjectSnapshotId" AND s."snapshotId" = NEW."snapshotId"
        AND s."rulesetVersionId" = NEW."rulesetVersionId"
    ) THEN
      RAISE EXCEPTION 'Check requirement subject must match its source definition' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."requirementKind" = 'CONDITIONAL_DOCUMENT'::"ApplicationVerificationRequirementKind" THEN
    IF NEW."stage" <> 'TIER_2_DOCUMENTS'::"ApplicationVerificationRequirementStage"
       OR NEW."subjectSnapshotId" IS NOT NULL OR NEW."sourceCheckDefinitionId" IS NOT NULL
       OR NEW."sourceDocumentRequirementDefinitionId" IS NULL THEN
      RAISE EXCEPTION 'Invalid Tier 2 document-requirement snapshot shape' USING ERRCODE = '23514';
    END IF;
    SELECT d."condition" INTO source_condition FROM "conditional_document_requirement_definitions" d
      WHERE d."id" = NEW."sourceDocumentRequirementDefinitionId" AND d."rulesetVersionId" = NEW."rulesetVersionId";
    IF source_condition IS NULL OR source_condition IS DISTINCT FROM NEW."conditionSnapshot" THEN
      RAISE EXCEPTION 'Document condition snapshot must preserve its exact source definition' USING ERRCODE = '23514';
    END IF;
    IF NEW."state" <> 'UNRESOLVED'::"ApplicationVerificationRequirementState"
       OR NEW."unresolvedIssue" <> 'DOCUMENT_CONDITION_NOT_EVALUATED'::"VerificationResolutionIssue" THEN
      RAISE EXCEPTION 'Uninterpreted document conditions must remain unresolved' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."requirementKind" IN (
    'STAFF_REVIEW'::"ApplicationVerificationRequirementKind",
    'INDEPENDENT_COMPLIANCE_APPROVAL'::"ApplicationVerificationRequirementKind"
  ) THEN
    IF NEW."stage" <> 'TIER_3_STAFF_COMPLIANCE'::"ApplicationVerificationRequirementStage"
       OR NEW."subjectSnapshotId" IS NOT NULL OR NEW."sourceCheckDefinitionId" IS NOT NULL
       OR NEW."sourceDocumentRequirementDefinitionId" IS NOT NULL OR NEW."conditionSnapshot" IS NOT NULL
       OR NEW."state" <> 'PENDING'::"ApplicationVerificationRequirementState"
       OR NEW."unresolvedIssue" IS NOT NULL THEN
      RAISE EXCEPTION 'Tier 3 staff and compliance gates are separate pending requirements' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "application_verification_requirement_insert_guard_trigger"
  BEFORE INSERT ON "application_verification_requirements"
  FOR EACH ROW EXECUTE FUNCTION "validate_application_verification_requirement"();

CREATE FUNCTION "reject_verification_snapshot_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Verification requirement snapshots are immutable' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "application_verification_snapshots_immutable_trigger"
  BEFORE UPDATE OR DELETE ON "application_verification_snapshots"
  FOR EACH ROW EXECUTE FUNCTION "reject_verification_snapshot_mutation"();
CREATE TRIGGER "application_verification_subject_snapshots_immutable_trigger"
  BEFORE UPDATE OR DELETE ON "application_verification_subject_snapshots"
  FOR EACH ROW EXECUTE FUNCTION "reject_verification_snapshot_mutation"();
CREATE TRIGGER "application_verification_requirements_immutable_trigger"
  BEFORE UPDATE OR DELETE ON "application_verification_requirements"
  FOR EACH ROW EXECUTE FUNCTION "reject_verification_snapshot_mutation"();
