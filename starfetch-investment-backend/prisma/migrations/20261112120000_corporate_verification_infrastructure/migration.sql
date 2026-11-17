-- Corporate verification infrastructure: versioned consent, durable provider
-- attempts/evidence, quarantined documents, and append-only staff-review audit.
-- No route, policy, storage/scanner backend, or staff authority is enabled here.

ALTER TYPE "OnboardingApplicationHistoryEvent" ADD VALUE IF NOT EXISTS 'IN_REVIEW';
ALTER TYPE "OnboardingApplicationHistoryEvent" ADD VALUE IF NOT EXISTS 'INFO_REQUESTED';
ALTER TYPE "OnboardingApplicationHistoryEvent" ADD VALUE IF NOT EXISTS 'APPROVED';
ALTER TYPE "OnboardingApplicationHistoryEvent" ADD VALUE IF NOT EXISTS 'REJECTED';

CREATE TYPE "VerificationConsentEventKind" AS ENUM ('GRANTED', 'WITHDRAWN');
CREATE TYPE "ProviderVerificationEvidenceStatus" AS ENUM (
  'PENDING', 'PROVIDER_VERIFIED', 'AWAITING_REVIEW', 'CANCELLED', 'EXPIRED', 'PROVIDER_FAILED', 'UNAVAILABLE'
);
CREATE TYPE "VerificationDocumentEventKind" AS ENUM (
  'QUARANTINED', 'SCAN_CLEAN', 'SCAN_REJECTED', 'REPLACED', 'ACCESS_GRANTED'
);
CREATE TYPE "ApplicationStaffReviewEventKind" AS ENUM (
  'REVIEW_STARTED', 'INFORMATION_REQUESTED', 'DECISION_RECORDED', 'FINAL_COMPLIANCE_APPROVED', 'FINAL_COMPLIANCE_REJECTED'
);
CREATE TYPE "ApplicationStaffDecision" AS ENUM ('APPROVE', 'REJECT');

CREATE TABLE "verification_consent_events" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "providerKey" VARCHAR(40) NOT NULL,
  "eventKind" "VerificationConsentEventKind" NOT NULL,
  "consentTextVersion" VARCHAR(64) NOT NULL,
  "privacyNoticeVersion" VARCHAR(64) NOT NULL,
  "lawfulBasisVersion" VARCHAR(64) NOT NULL,
  "consentTextSha256" CHAR(64) NOT NULL,
  "allowedIdentityKinds" TEXT[] NOT NULL,
  "operationKeyDigest" CHAR(64) NOT NULL,
  "hmacKeyVersion" VARCHAR(32) NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 1,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verification_consent_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verification_consent_events_digest_check" CHECK ("operationKeyDigest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "verification_consent_events_text_hash_check" CHECK ("consentTextSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "verification_consent_events_provider_check" CHECK ("providerKey" IN ('mono_prove', 'mono_lookup')),
  CONSTRAINT "verification_consent_events_versions_check" CHECK (
    length("consentTextVersion") > 0 AND length("privacyNoticeVersion") > 0 AND length("lawfulBasisVersion") > 0
  )
);
CREATE UNIQUE INDEX "verification_consent_events_operation_key" ON "verification_consent_events"(
  "applicationId", "actorUserId", "providerKey", "operationKeyDigest"
);
CREATE UNIQUE INDEX "verification_consent_events_sequence_key" ON "verification_consent_events"(
  "applicationId", "actorUserId", "providerKey", "sequence"
);
CREATE INDEX "verification_consent_events_current_lookup" ON "verification_consent_events"(
  "applicationId", "actorUserId", "providerKey", "occurredAt" DESC
);
ALTER TABLE "verification_consent_events" ADD CONSTRAINT "verification_consent_events_application_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "onboarding_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_consent_events" ADD CONSTRAINT "verification_consent_events_actor_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_verification_attempts" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "subjectSnapshotId" UUID,
  "subjectUserId" UUID,
  "actorUserId" UUID NOT NULL,
  "consentEventId" UUID NOT NULL,
  "providerKey" VARCHAR(40) NOT NULL,
  "reference" VARCHAR(128) NOT NULL,
  "operationKeyDigest" CHAR(64) NOT NULL,
  "hmacKeyVersion" VARCHAR(32) NOT NULL,
  "identityKinds" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_verification_attempts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_verification_attempts_provider_check" CHECK ("providerKey" IN ('mono_prove', 'mono_lookup')),
  CONSTRAINT "provider_verification_attempts_digest_check" CHECK ("operationKeyDigest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "provider_verification_attempts_reference_check" CHECK (length("reference") BETWEEN 1 AND 128),
  CONSTRAINT "provider_verification_attempts_identity_kinds_check" CHECK (cardinality("identityKinds") BETWEEN 1 AND 4)
);
CREATE UNIQUE INDEX "provider_verification_attempts_reference_key" ON "provider_verification_attempts"("reference");
CREATE UNIQUE INDEX "provider_verification_attempts_operation_key" ON "provider_verification_attempts"("providerKey", "operationKeyDigest");
CREATE INDEX "provider_verification_attempts_application_requirement_idx" ON "provider_verification_attempts"("applicationId", "requirementId", "createdAt");
ALTER TABLE "provider_verification_attempts" ADD CONSTRAINT "provider_verification_attempts_application_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "onboarding_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_verification_attempts" ADD CONSTRAINT "provider_verification_attempts_requirement_fkey"
  FOREIGN KEY ("requirementId") REFERENCES "application_verification_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_verification_attempts" ADD CONSTRAINT "provider_verification_attempts_subject_user_fkey"
  FOREIGN KEY ("subjectUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_verification_attempts" ADD CONSTRAINT "provider_verification_attempts_actor_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "provider_verification_attempts" ADD CONSTRAINT "provider_verification_attempts_consent_fkey"
  FOREIGN KEY ("consentEventId") REFERENCES "verification_consent_events"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "provider_verification_evidence_events" (
  "id" UUID NOT NULL,
  "attemptId" UUID NOT NULL,
  "providerKey" VARCHAR(40) NOT NULL,
  "providerEventId" VARCHAR(256),
  "replayDigest" CHAR(64),
  "providerSessionId" VARCHAR(128),
  "providerReference" VARCHAR(128) NOT NULL,
  "status" "ProviderVerificationEvidenceStatus" NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 1,
  "rawPayloadSha256" CHAR(64),
  "safeReason" VARCHAR(80),
  "occurredAt" TIMESTAMP(3) NOT NULL,
  "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "provider_verification_evidence_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "provider_verification_evidence_events_provider_check" CHECK ("providerKey" IN ('mono_prove', 'mono_lookup')),
  CONSTRAINT "provider_verification_evidence_events_replay_digest_check" CHECK ("replayDigest" IS NULL OR "replayDigest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "provider_verification_evidence_events_payload_hash_check" CHECK ("rawPayloadSha256" IS NULL OR "rawPayloadSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "provider_verification_evidence_events_reference_check" CHECK (length("providerReference") BETWEEN 1 AND 128)
);
CREATE UNIQUE INDEX "provider_verification_evidence_replay_digest_key" ON "provider_verification_evidence_events"("replayDigest");
CREATE UNIQUE INDEX "provider_verification_evidence_provider_event_key" ON "provider_verification_evidence_events"("providerKey", "providerEventId");
CREATE UNIQUE INDEX "provider_verification_evidence_attempt_sequence_key" ON "provider_verification_evidence_events"("attemptId", "sequence");
CREATE INDEX "provider_verification_evidence_attempt_recorded_idx" ON "provider_verification_evidence_events"("attemptId", "sequence");
ALTER TABLE "provider_verification_evidence_events" ADD CONSTRAINT "provider_verification_evidence_attempt_fkey"
  FOREIGN KEY ("attemptId") REFERENCES "provider_verification_attempts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "verification_documents" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "requirementId" UUID NOT NULL,
  "uploadedByUserId" UUID NOT NULL,
  "replacesDocumentId" UUID,
  "documentKindKey" VARCHAR(120) NOT NULL,
  "objectKey" VARCHAR(160) NOT NULL,
  "contentSha256" CHAR(64) NOT NULL,
  "contentLength" BIGINT NOT NULL,
  "mediaType" VARCHAR(120) NOT NULL,
  "version" INTEGER NOT NULL DEFAULT 1,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verification_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verification_documents_hash_check" CHECK ("contentSha256" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "verification_documents_size_check" CHECK ("contentLength" > 0),
  CONSTRAINT "verification_documents_kind_check" CHECK (length("documentKindKey") BETWEEN 1 AND 120),
  CONSTRAINT "verification_documents_object_key_check" CHECK ("objectKey" ~ '^[0-9a-f-]{36}$'),
  CONSTRAINT "verification_documents_version_check" CHECK ("version" > 0)
);
CREATE UNIQUE INDEX "verification_documents_object_key_key" ON "verification_documents"("objectKey");
CREATE UNIQUE INDEX "verification_documents_replacement_version_key" ON "verification_documents"("replacesDocumentId", "version");
CREATE INDEX "verification_documents_application_requirement_created_idx" ON "verification_documents"("applicationId", "requirementId", "createdAt");
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_application_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "onboarding_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_requirement_fkey"
  FOREIGN KEY ("requirementId") REFERENCES "application_verification_requirements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_uploader_fkey"
  FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_documents" ADD CONSTRAINT "verification_documents_replaced_document_fkey"
  FOREIGN KEY ("replacesDocumentId") REFERENCES "verification_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "verification_document_events" (
  "id" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "actorUserId" UUID,
  "eventKind" "VerificationDocumentEventKind" NOT NULL,
  "sequence" INTEGER NOT NULL DEFAULT 1,
  "scannerVersion" VARCHAR(64),
  "safeReason" VARCHAR(80),
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "verification_document_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "verification_document_events_actor_shape_check" CHECK (
    ("eventKind" IN ('SCAN_CLEAN', 'SCAN_REJECTED') AND "actorUserId" IS NULL AND "scannerVersion" IS NOT NULL)
    OR ("eventKind" NOT IN ('SCAN_CLEAN', 'SCAN_REJECTED') AND "actorUserId" IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "verification_document_events_document_sequence_key" ON "verification_document_events"("documentId", "sequence");
CREATE INDEX "verification_document_events_document_occurred_idx" ON "verification_document_events"("documentId", "sequence");
ALTER TABLE "verification_document_events" ADD CONSTRAINT "verification_document_events_document_fkey"
  FOREIGN KEY ("documentId") REFERENCES "verification_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "verification_document_events" ADD CONSTRAINT "verification_document_events_actor_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "application_staff_review_events" (
  "id" UUID NOT NULL,
  "operationId" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "snapshotId" UUID NOT NULL,
  "rulesetVersionId" UUID NOT NULL,
  "actorUserId" UUID NOT NULL,
  "eventKind" "ApplicationStaffReviewEventKind" NOT NULL,
  "decision" "ApplicationStaffDecision",
  "relatedEventId" UUID,
  "requirementIds" UUID[] NOT NULL,
  "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "application_staff_review_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "application_staff_review_events_decision_shape_check" CHECK (
    ("eventKind" IN ('DECISION_RECORDED', 'FINAL_COMPLIANCE_APPROVED', 'FINAL_COMPLIANCE_REJECTED') AND "decision" IS NOT NULL)
    OR ("eventKind" NOT IN ('DECISION_RECORDED', 'FINAL_COMPLIANCE_APPROVED', 'FINAL_COMPLIANCE_REJECTED') AND "decision" IS NULL)
  ),
  CONSTRAINT "application_staff_review_events_final_link_check" CHECK (
    ("eventKind" IN ('FINAL_COMPLIANCE_APPROVED', 'FINAL_COMPLIANCE_REJECTED') AND "relatedEventId" IS NOT NULL)
    OR ("eventKind" NOT IN ('FINAL_COMPLIANCE_APPROVED', 'FINAL_COMPLIANCE_REJECTED') AND "relatedEventId" IS NULL)
  )
);
CREATE UNIQUE INDEX "application_staff_review_events_operation_key" ON "application_staff_review_events"("operationId");
CREATE INDEX "application_staff_review_events_application_occurred_idx" ON "application_staff_review_events"("applicationId", "occurredAt");
CREATE INDEX "application_staff_review_events_snapshot_kind_idx" ON "application_staff_review_events"("snapshotId", "eventKind");
CREATE UNIQUE INDEX "application_staff_review_events_one_final_outcome"
  ON "application_staff_review_events"("applicationId", "snapshotId")
  WHERE "eventKind" IN ('FINAL_COMPLIANCE_APPROVED', 'FINAL_COMPLIANCE_REJECTED');
ALTER TABLE "application_staff_review_events" ADD CONSTRAINT "application_staff_review_events_application_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "onboarding_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_staff_review_events" ADD CONSTRAINT "application_staff_review_events_snapshot_fkey"
  FOREIGN KEY ("snapshotId", "rulesetVersionId") REFERENCES "application_verification_snapshots"("id", "rulesetVersionId") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "application_staff_review_events" ADD CONSTRAINT "application_staff_review_events_actor_fkey"
  FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Persist only scoped, sanitized verification material. Every row is immutable.
CREATE FUNCTION "reject_verification_record_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Verification consent, evidence, document metadata and staff review records are immutable'
    USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

CREATE FUNCTION "reject_verification_record_truncate"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Protected verification records cannot be truncated' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;

DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'verification_consent_events', 'provider_verification_attempts',
    'provider_verification_evidence_events', 'verification_documents',
    'verification_document_events', 'application_staff_review_events'
  ] LOOP
    EXECUTE format('CREATE TRIGGER %I BEFORE UPDATE OR DELETE ON %I FOR EACH ROW EXECUTE FUNCTION "reject_verification_record_mutation"()', table_name || '_immutable_trigger', table_name);
    EXECUTE format('CREATE TRIGGER %I BEFORE TRUNCATE ON %I FOR EACH STATEMENT EXECUTE FUNCTION "reject_verification_record_truncate"()', table_name || '_no_truncate_trigger', table_name);
  END LOOP;
END;
$$;

CREATE FUNCTION "validate_verification_consent_context"() RETURNS TRIGGER AS $$
DECLARE app RECORD;
DECLARE prior_event "VerificationConsentEventKind";
BEGIN
  SELECT "kind", "initiatingUserId", "ownerUserId", "ownerJointAccountId", "ownerCorporateAccountId"
    INTO app FROM "onboarding_applications" WHERE "id" = NEW."applicationId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Consent application not found' USING ERRCODE = '23503'; END IF;
  SELECT COALESCE(MAX("sequence"), 0) + 1 INTO NEW."sequence" FROM "verification_consent_events"
    WHERE "applicationId" = NEW."applicationId" AND "actorUserId" = NEW."actorUserId" AND "providerKey" = NEW."providerKey";
  IF NOT (
    app."initiatingUserId" = NEW."actorUserId"
    OR app."ownerUserId" = NEW."actorUserId"
    OR (app."ownerJointAccountId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM "joint_account_members" m WHERE m."jointAccountId" = app."ownerJointAccountId" AND m."userId" = NEW."actorUserId"
    ))
  ) THEN RAISE EXCEPTION 'Consent actor is outside the application owner scope' USING ERRCODE = '42501'; END IF;
  SELECT "eventKind" INTO prior_event FROM "verification_consent_events"
    WHERE "applicationId" = NEW."applicationId" AND "actorUserId" = NEW."actorUserId" AND "providerKey" = NEW."providerKey"
    ORDER BY "sequence" DESC LIMIT 1;
  IF NEW."eventKind" = 'WITHDRAWN' AND prior_event IS DISTINCT FROM 'GRANTED'::"VerificationConsentEventKind" THEN
    RAISE EXCEPTION 'Consent withdrawal requires a current grant' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" = 'GRANTED' AND prior_event = 'GRANTED'::"VerificationConsentEventKind" THEN
    RAISE EXCEPTION 'A current consent grant already exists' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "verification_consent_context_guard_trigger"
  BEFORE INSERT ON "verification_consent_events" FOR EACH ROW EXECUTE FUNCTION "validate_verification_consent_context"();

CREATE FUNCTION "validate_provider_attempt_context"() RETURNS TRIGGER AS $$
DECLARE req RECORD;
DECLARE app RECORD;
DECLARE consent RECORD;
DECLARE latest_consent_id UUID;
DECLARE subject_found BOOLEAN := FALSE;
BEGIN
  SELECT r."snapshotId", r."subjectSnapshotId", r."requirementKind", s."applicationId", s."accountKind"
    INTO req FROM "application_verification_requirements" r
    JOIN "application_verification_snapshots" s ON s."id" = r."snapshotId"
    WHERE r."id" = NEW."requirementId";
  IF NOT FOUND OR req."applicationId" <> NEW."applicationId"
     OR req."requirementKind" <> 'VERIFICATION_CHECK'::"ApplicationVerificationRequirementKind" THEN
    RAISE EXCEPTION 'Provider requirement does not belong to an applicable verification check' USING ERRCODE = '23514';
  END IF;
  IF NEW."subjectSnapshotId" IS DISTINCT FROM req."subjectSnapshotId" THEN
    RAISE EXCEPTION 'Provider attempt subject differs from requirement snapshot' USING ERRCODE = '23514';
  END IF;
  SELECT "kind", "initiatingUserId", "ownerUserId", "ownerJointAccountId"
    INTO app FROM "onboarding_applications" WHERE "id" = NEW."applicationId";
  SELECT "applicationId", "actorUserId", "providerKey", "eventKind"
    INTO consent FROM "verification_consent_events" WHERE "id" = NEW."consentEventId";
  SELECT "id" INTO latest_consent_id FROM "verification_consent_events"
    WHERE "applicationId" = NEW."applicationId" AND "actorUserId" = NEW."actorUserId" AND "providerKey" = NEW."providerKey"
    ORDER BY "sequence" DESC LIMIT 1;
  IF consent."applicationId" IS DISTINCT FROM NEW."applicationId"
     OR consent."actorUserId" IS DISTINCT FROM NEW."actorUserId"
     OR consent."providerKey" IS DISTINCT FROM NEW."providerKey"
     OR consent."eventKind" IS DISTINCT FROM 'GRANTED'::"VerificationConsentEventKind"
     OR latest_consent_id IS DISTINCT FROM NEW."consentEventId" THEN
    RAISE EXCEPTION 'Provider attempt requires matching current consent' USING ERRCODE = '23514';
  END IF;
  IF NOT (
    app."initiatingUserId" = NEW."actorUserId"
    OR app."ownerUserId" = NEW."actorUserId"
    OR (app."ownerJointAccountId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM "joint_account_members" m WHERE m."jointAccountId" = app."ownerJointAccountId" AND m."userId" = NEW."actorUserId"
    ))
  ) THEN RAISE EXCEPTION 'Provider attempt actor is outside the application owner scope' USING ERRCODE = '42501'; END IF;
  IF NEW."subjectUserId" IS NOT NULL THEN
    IF app."kind" = 'CORPORATE'::"OnboardingApplicationKind" THEN
      RAISE EXCEPTION 'Corporate person verification requires an approved person source' USING ERRCODE = '23514';
    END IF;
    SELECT EXISTS (
      SELECT 1 FROM "application_verification_subject_snapshots" s
      WHERE s."id" = NEW."subjectSnapshotId" AND s."resolvedUserId" = NEW."subjectUserId" AND s."resolutionState" = 'RESOLVED'
    ) INTO subject_found;
    IF NOT subject_found THEN RAISE EXCEPTION 'Provider subject does not match a resolved subject snapshot' USING ERRCODE = '23514'; END IF;
    IF app."ownerUserId" IS DISTINCT FROM NEW."subjectUserId" AND NOT EXISTS (
      SELECT 1 FROM "joint_account_members" m WHERE m."jointAccountId" = app."ownerJointAccountId" AND m."userId" = NEW."subjectUserId"
    ) THEN RAISE EXCEPTION 'Provider subject is outside the application owner scope' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "provider_verification_attempt_context_guard_trigger"
  BEFORE INSERT ON "provider_verification_attempts" FOR EACH ROW EXECUTE FUNCTION "validate_provider_attempt_context"();

CREATE FUNCTION "validate_provider_evidence_context"() RETURNS TRIGGER AS $$
DECLARE attempt RECORD;
BEGIN
  SELECT "providerKey", "reference" INTO attempt FROM "provider_verification_attempts" WHERE "id" = NEW."attemptId" FOR UPDATE;
  IF NOT FOUND OR attempt."providerKey" <> NEW."providerKey" OR attempt."reference" <> NEW."providerReference" THEN
    RAISE EXCEPTION 'Provider evidence does not match its reserved attempt' USING ERRCODE = '23514';
  END IF;
  SELECT COALESCE(MAX("sequence"), 0) + 1 INTO NEW."sequence" FROM "provider_verification_evidence_events" WHERE "attemptId" = NEW."attemptId";
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "provider_verification_evidence_context_guard_trigger"
  BEFORE INSERT ON "provider_verification_evidence_events" FOR EACH ROW EXECUTE FUNCTION "validate_provider_evidence_context"();

CREATE FUNCTION "validate_verification_document_context"() RETURNS TRIGGER AS $$
DECLARE req RECORD;
DECLARE app RECORD;
DECLARE replaced RECORD;
BEGIN
  SELECT r."snapshotId", r."requirementKind", r."documentKindKeySnapshot", s."applicationId"
    INTO req FROM "application_verification_requirements" r
    JOIN "application_verification_snapshots" s ON s."id" = r."snapshotId"
    WHERE r."id" = NEW."requirementId";
  IF NOT FOUND OR req."applicationId" <> NEW."applicationId"
     OR req."requirementKind" <> 'CONDITIONAL_DOCUMENT'::"ApplicationVerificationRequirementKind"
     OR req."documentKindKeySnapshot" IS DISTINCT FROM NEW."documentKindKey" THEN
    RAISE EXCEPTION 'Document requirement/category is not defined by the bound ruleset snapshot' USING ERRCODE = '23514';
  END IF;
  SELECT "kind", "initiatingUserId", "ownerUserId", "ownerJointAccountId", "status"
    INTO app FROM "onboarding_applications" WHERE "id" = NEW."applicationId";
  IF app."status" NOT IN ('DRAFT'::"OnboardingApplicationStatus", 'INFO_REQUESTED'::"OnboardingApplicationStatus") THEN
    RAISE EXCEPTION 'Documents cannot be replaced in this application state' USING ERRCODE = '23514';
  END IF;
  IF NOT (
    app."initiatingUserId" = NEW."uploadedByUserId"
    OR app."ownerUserId" = NEW."uploadedByUserId"
    OR (app."ownerJointAccountId" IS NOT NULL AND EXISTS (
      SELECT 1 FROM "joint_account_members" m WHERE m."jointAccountId" = app."ownerJointAccountId" AND m."userId" = NEW."uploadedByUserId"
    ))
  ) THEN RAISE EXCEPTION 'Document uploader is outside the application owner scope' USING ERRCODE = '42501'; END IF;
  IF NEW."replacesDocumentId" IS NULL THEN
    IF NEW."version" <> 1 THEN RAISE EXCEPTION 'Initial document version must be one' USING ERRCODE = '23514'; END IF;
  ELSE
    SELECT "applicationId", "requirementId", "documentKindKey", "version"
      INTO replaced FROM "verification_documents" WHERE "id" = NEW."replacesDocumentId";
    IF NOT FOUND OR replaced."applicationId" <> NEW."applicationId"
       OR replaced."requirementId" <> NEW."requirementId"
       OR replaced."documentKindKey" <> NEW."documentKindKey"
       OR NEW."version" <> replaced."version" + 1 THEN
      RAISE EXCEPTION 'Replacement document must preserve application, requirement, category and next version' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "verification_document_context_guard_trigger"
  BEFORE INSERT ON "verification_documents" FOR EACH ROW EXECUTE FUNCTION "validate_verification_document_context"();

CREATE FUNCTION "validate_verification_document_event_context"() RETURNS TRIGGER AS $$
DECLARE document_app UUID;
DECLARE latest_event "VerificationDocumentEventKind";
BEGIN
  SELECT "applicationId" INTO document_app FROM "verification_documents" WHERE "id" = NEW."documentId" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Document not found' USING ERRCODE = '23503'; END IF;
  SELECT COALESCE(MAX("sequence"), 0) + 1 INTO NEW."sequence" FROM "verification_document_events" WHERE "documentId" = NEW."documentId";
  IF NEW."actorUserId" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "onboarding_applications" a WHERE a."id" = document_app AND (
      a."initiatingUserId" = NEW."actorUserId" OR a."ownerUserId" = NEW."actorUserId"
      OR EXISTS (SELECT 1 FROM "joint_account_members" m WHERE m."jointAccountId" = a."ownerJointAccountId" AND m."userId" = NEW."actorUserId")
    )
  ) THEN RAISE EXCEPTION 'Document event actor is outside the application owner scope' USING ERRCODE = '42501'; END IF;
  SELECT "eventKind" INTO latest_event FROM "verification_document_events"
    WHERE "documentId" = NEW."documentId" AND "eventKind" <> 'ACCESS_GRANTED'::"VerificationDocumentEventKind"
    ORDER BY "sequence" DESC LIMIT 1;
  IF NEW."eventKind" = 'SCAN_CLEAN' AND latest_event IS DISTINCT FROM 'QUARANTINED'::"VerificationDocumentEventKind" THEN
    RAISE EXCEPTION 'Only a quarantined document can pass scanning' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" = 'SCAN_REJECTED' AND latest_event IS DISTINCT FROM 'QUARANTINED'::"VerificationDocumentEventKind" THEN
    RAISE EXCEPTION 'Only a quarantined document can be rejected by scanning' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" = 'ACCESS_GRANTED' AND latest_event IS DISTINCT FROM 'SCAN_CLEAN'::"VerificationDocumentEventKind" THEN
    RAISE EXCEPTION 'Only a clean document can be accessed' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "verification_document_event_context_guard_trigger"
  BEFORE INSERT ON "verification_document_events" FOR EACH ROW EXECUTE FUNCTION "validate_verification_document_event_context"();

CREATE FUNCTION "validate_application_staff_review_event"() RETURNS TRIGGER AS $$
DECLARE app RECORD;
DECLARE snapshot_app UUID;
DECLARE prior_decision RECORD;
DECLARE requirement_id UUID;
BEGIN
  SELECT "initiatingUserId", "status" INTO app FROM "onboarding_applications" WHERE "id" = NEW."applicationId";
  SELECT "applicationId" INTO snapshot_app FROM "application_verification_snapshots"
    WHERE "id" = NEW."snapshotId" AND "rulesetVersionId" = NEW."rulesetVersionId";
  IF NOT FOUND OR snapshot_app <> NEW."applicationId" THEN
    RAISE EXCEPTION 'Staff review event snapshot does not belong to application' USING ERRCODE = '23514';
  END IF;
  IF NEW."actorUserId" = app."initiatingUserId" THEN
    RAISE EXCEPTION 'Applicant cannot act as staff reviewer or compliance approver' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM "users" u WHERE u."id" = NEW."actorUserId" AND u."role" IN ('STAFF'::"UserRole", 'ADMIN'::"UserRole")) THEN
    RAISE EXCEPTION 'Staff review event requires a staff account' USING ERRCODE = '42501';
  END IF;
  FOREACH requirement_id IN ARRAY NEW."requirementIds" LOOP
    IF NOT EXISTS (SELECT 1 FROM "application_verification_requirements" r WHERE r."id" = requirement_id AND r."snapshotId" = NEW."snapshotId") THEN
      RAISE EXCEPTION 'Staff review reference is outside the pinned snapshot' USING ERRCODE = '23514';
    END IF;
  END LOOP;
  IF NEW."eventKind" IN ('FINAL_COMPLIANCE_APPROVED', 'FINAL_COMPLIANCE_REJECTED') THEN
    SELECT "actorUserId", "decision", "applicationId", "snapshotId", "eventKind"
      INTO prior_decision FROM "application_staff_review_events" WHERE "id" = NEW."relatedEventId";
    IF NOT FOUND OR prior_decision."eventKind" <> 'DECISION_RECORDED'::"ApplicationStaffReviewEventKind"
       OR prior_decision."applicationId" <> NEW."applicationId"
       OR prior_decision."snapshotId" <> NEW."snapshotId"
       OR prior_decision."actorUserId" = NEW."actorUserId"
       OR prior_decision."decision" <> NEW."decision" THEN
      RAISE EXCEPTION 'Final compliance action requires a matching independent staff decision' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."eventKind" IN ('REVIEW_STARTED', 'INFORMATION_REQUESTED', 'DECISION_RECORDED', 'FINAL_COMPLIANCE_APPROVED', 'FINAL_COMPLIANCE_REJECTED')
     AND app."status" NOT IN ('SUBMITTED'::"OnboardingApplicationStatus", 'IN_REVIEW'::"OnboardingApplicationStatus") THEN
    RAISE EXCEPTION 'Staff review action is not permitted in the current application state' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" = 'FINAL_COMPLIANCE_APPROVED' AND
     (app."status" <> 'IN_REVIEW'::"OnboardingApplicationStatus" OR NEW."decision" <> 'APPROVE'::"ApplicationStaffDecision") THEN
    RAISE EXCEPTION 'Final approval requires an in-review application and an independent approve decision' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" = 'FINAL_COMPLIANCE_REJECTED' AND
     (app."status" <> 'IN_REVIEW'::"OnboardingApplicationStatus" OR NEW."decision" <> 'REJECT'::"ApplicationStaffDecision") THEN
    RAISE EXCEPTION 'Final rejection requires an in-review application and an independent reject decision' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "application_staff_review_event_context_guard_trigger"
  BEFORE INSERT ON "application_staff_review_events" FOR EACH ROW EXECUTE FUNCTION "validate_application_staff_review_event"();

-- The existing six-state lifecycle is preserved; review transitions are tied
-- to durable events, staff actors and the snapshot pin. Submission itself stays
-- unimplemented and is not granted by these enum additions.
CREATE OR REPLACE FUNCTION "validate_onboarding_application_creation_history"() RETURNS TRIGGER AS $$
DECLARE app RECORD;
DECLARE required_event "ApplicationStaffReviewEventKind";
DECLARE expected_from "OnboardingApplicationStatus";
BEGIN
  SELECT "initiatingUserId", "status" INTO app
    FROM "onboarding_applications" WHERE "id" = NEW."applicationId";
  IF NOT FOUND OR app."status" IS DISTINCT FROM NEW."toStatus" THEN
    RAISE EXCEPTION 'Application history must match its current status' USING ERRCODE = '23514';
  END IF;
  IF NEW."event" = 'CREATED'::"OnboardingApplicationHistoryEvent" THEN
    IF NEW."fromStatus" IS NOT NULL OR NEW."toStatus" <> 'DRAFT'::"OnboardingApplicationStatus" OR NEW."actorUserId" <> app."initiatingUserId" THEN
      RAISE EXCEPTION 'Creation history must be attributed to the DRAFT initiator' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF NEW."actorUserId" = app."initiatingUserId" OR NOT EXISTS (
    SELECT 1 FROM "users" u WHERE u."id" = NEW."actorUserId" AND u."role" IN ('STAFF'::"UserRole", 'ADMIN'::"UserRole")
  ) THEN RAISE EXCEPTION 'Lifecycle review history requires an authorized staff identity' USING ERRCODE = '42501'; END IF;

  CASE NEW."event"
    WHEN 'IN_REVIEW'::"OnboardingApplicationHistoryEvent" THEN
      expected_from := 'SUBMITTED'::"OnboardingApplicationStatus";
      required_event := 'REVIEW_STARTED'::"ApplicationStaffReviewEventKind";
      IF NEW."toStatus" <> 'IN_REVIEW'::"OnboardingApplicationStatus" THEN RAISE EXCEPTION 'Invalid review-start history' USING ERRCODE = '23514'; END IF;
    WHEN 'INFO_REQUESTED'::"OnboardingApplicationHistoryEvent" THEN
      expected_from := 'IN_REVIEW'::"OnboardingApplicationStatus";
      required_event := 'INFORMATION_REQUESTED'::"ApplicationStaffReviewEventKind";
      IF NEW."toStatus" <> 'INFO_REQUESTED'::"OnboardingApplicationStatus" THEN RAISE EXCEPTION 'Invalid information-request history' USING ERRCODE = '23514'; END IF;
    WHEN 'APPROVED'::"OnboardingApplicationHistoryEvent" THEN
      expected_from := 'IN_REVIEW'::"OnboardingApplicationStatus";
      required_event := 'FINAL_COMPLIANCE_APPROVED'::"ApplicationStaffReviewEventKind";
      IF NEW."toStatus" <> 'APPROVED'::"OnboardingApplicationStatus" THEN RAISE EXCEPTION 'Invalid approval history' USING ERRCODE = '23514'; END IF;
    WHEN 'REJECTED'::"OnboardingApplicationHistoryEvent" THEN
      expected_from := 'IN_REVIEW'::"OnboardingApplicationStatus";
      required_event := 'FINAL_COMPLIANCE_REJECTED'::"ApplicationStaffReviewEventKind";
      IF NEW."toStatus" <> 'REJECTED'::"OnboardingApplicationStatus" THEN RAISE EXCEPTION 'Invalid rejection history' USING ERRCODE = '23514'; END IF;
    ELSE RAISE EXCEPTION 'Unsupported application history event' USING ERRCODE = '23514';
  END CASE;
  IF NEW."fromStatus" IS DISTINCT FROM expected_from OR NOT EXISTS (
    SELECT 1 FROM "application_staff_review_events" e
    WHERE e."applicationId" = NEW."applicationId" AND e."actorUserId" = NEW."actorUserId" AND e."eventKind" = required_event
      AND (NEW."event" NOT IN ('APPROVED'::"OnboardingApplicationHistoryEvent", 'REJECTED'::"OnboardingApplicationHistoryEvent")
        OR (e."eventKind" = required_event AND e."decision" = CASE WHEN NEW."event" = 'APPROVED'::"OnboardingApplicationHistoryEvent" THEN 'APPROVE'::"ApplicationStaffDecision" ELSE 'REJECT'::"ApplicationStaffDecision" END))
  ) THEN RAISE EXCEPTION 'Lifecycle history requires its matching staff-review audit event' USING ERRCODE = '23514'; END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "onboarding_application_history_no_mutation_trigger"
  BEFORE UPDATE OR DELETE ON "onboarding_application_history" FOR EACH ROW EXECUTE FUNCTION "reject_verification_record_mutation"();
CREATE TRIGGER "onboarding_application_history_no_truncate_trigger"
  BEFORE TRUNCATE ON "onboarding_application_history" FOR EACH STATEMENT EXECUTE FUNCTION "reject_verification_record_truncate"();
