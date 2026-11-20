-- Corporate KYC documents (exactly three approved mandatory categories) and
-- applicant submission. Stores opaque storage references and safe metadata
-- only: never document bytes, original filenames, public URLs or PII.
-- No category beyond the three below is representable at the database layer.

-- Enum values added here are used only inside plpgsql bodies (validated at
-- execution time), never as defaults/checks in this same transaction.
ALTER TYPE "OnboardingApplicationHistoryEvent" ADD VALUE IF NOT EXISTS 'SUBMITTED';

CREATE TYPE "CorporateKycDocumentCategory" AS ENUM ('CERTIFICATE_OF_INCORPORATION', 'MEMART', 'TIN_CERTIFICATE');
-- No malware scanner is wired for Corporate documents. NOT_SCANNED is the only
-- truthful value today; future scanner states are added by a later migration.
CREATE TYPE "CorporateKycDocumentScanStatus" AS ENUM ('NOT_SCANNED');
CREATE TYPE "CorporateKycDocumentEventKind" AS ENUM ('UPLOADED', 'REPLACED', 'VIEW_AUTHORIZED');

CREATE TABLE "corporate_kyc_documents" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "category" "CorporateKycDocumentCategory" NOT NULL,
  "version" INTEGER NOT NULL,
  "isCurrent" BOOLEAN NOT NULL DEFAULT true,
  "replacesDocumentId" UUID,
  "storageObjectKey" VARCHAR(64) NOT NULL,
  "storageObjectVersionId" VARCHAR(256) NOT NULL,
  "contentType" VARCHAR(32) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "checksumSha256" CHAR(64) NOT NULL,
  "scanStatus" "CorporateKycDocumentScanStatus" NOT NULL DEFAULT 'NOT_SCANNED',
  "uploadedByUserId" UUID NOT NULL,
  "uploadedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "supersededAt" TIMESTAMP(3),
  CONSTRAINT "corporate_kyc_documents_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corporate_kyc_documents_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "onboarding_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corporate_kyc_documents_uploadedByUserId_fkey"
    FOREIGN KEY ("uploadedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corporate_kyc_documents_replacesDocumentId_fkey"
    FOREIGN KEY ("replacesDocumentId") REFERENCES "corporate_kyc_documents"("id") ON DELETE NO ACTION ON UPDATE NO ACTION,
  CONSTRAINT "corporate_kyc_documents_version_check" CHECK ("version" >= 1),
  CONSTRAINT "corporate_kyc_documents_replacement_check" CHECK (("version" = 1) = ("replacesDocumentId" IS NULL)),
  CONSTRAINT "corporate_kyc_documents_current_check" CHECK ("isCurrent" = ("supersededAt" IS NULL)),
  CONSTRAINT "corporate_kyc_documents_key_check" CHECK ("storageObjectKey" = 'onboarding-documents/' || "id"::text),
  CONSTRAINT "corporate_kyc_documents_version_id_check" CHECK (length(btrim("storageObjectVersionId")) > 0),
  CONSTRAINT "corporate_kyc_documents_content_type_check" CHECK ("contentType" IN ('application/pdf', 'image/jpeg', 'image/png')),
  CONSTRAINT "corporate_kyc_documents_size_check" CHECK ("sizeBytes" BETWEEN 1 AND 4194304),
  CONSTRAINT "corporate_kyc_documents_checksum_check" CHECK ("checksumSha256" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "corporate_kyc_documents_storageObjectKey_key" ON "corporate_kyc_documents"("storageObjectKey");
CREATE UNIQUE INDEX "corporate_kyc_documents_replacesDocumentId_key" ON "corporate_kyc_documents"("replacesDocumentId");
CREATE UNIQUE INDEX "corporate_kyc_documents_applicationId_category_version_key" ON "corporate_kyc_documents"("applicationId", "category", "version");
CREATE INDEX "corporate_kyc_documents_applicationId_category_idx" ON "corporate_kyc_documents"("applicationId", "category");
-- At most one current version per application/category.
CREATE UNIQUE INDEX "corporate_kyc_documents_one_current_per_category"
  ON "corporate_kyc_documents"("applicationId", "category") WHERE "isCurrent";
REVOKE ALL ON TABLE "corporate_kyc_documents" FROM PUBLIC;

CREATE FUNCTION "validate_corporate_kyc_document_insert"() RETURNS TRIGGER AS $$
DECLARE app RECORD;
DECLARE previous RECORD;
BEGIN
  SELECT "kind", "status", "initiatingUserId" INTO app FROM "onboarding_applications" WHERE "id" = NEW."applicationId";
  IF NOT FOUND OR app."kind" <> 'CORPORATE'::"OnboardingApplicationKind" THEN
    RAISE EXCEPTION 'Corporate KYC documents require a Corporate application' USING ERRCODE = '23514';
  END IF;
  IF app."status" NOT IN ('DRAFT'::"OnboardingApplicationStatus", 'INFO_REQUESTED'::"OnboardingApplicationStatus") THEN
    RAISE EXCEPTION 'Corporate KYC documents cannot change in the current application state' USING ERRCODE = '23514';
  END IF;
  IF NEW."uploadedByUserId" <> app."initiatingUserId" THEN
    RAISE EXCEPTION 'Corporate KYC documents must be uploaded by the application initiator' USING ERRCODE = '42501';
  END IF;
  IF NOT NEW."isCurrent" OR NEW."supersededAt" IS NOT NULL OR NEW."scanStatus" <> 'NOT_SCANNED'::"CorporateKycDocumentScanStatus" THEN
    RAISE EXCEPTION 'New Corporate KYC documents start current and unscanned' USING ERRCODE = '23514';
  END IF;
  IF NEW."replacesDocumentId" IS NOT NULL THEN
    SELECT "applicationId", "category", "version", "isCurrent" INTO previous
      FROM "corporate_kyc_documents" WHERE "id" = NEW."replacesDocumentId";
    IF NOT FOUND OR previous."applicationId" <> NEW."applicationId" OR previous."category" <> NEW."category"
       OR previous."version" + 1 <> NEW."version" OR previous."isCurrent" THEN
      RAISE EXCEPTION 'Replacement must supersede the previous current version of the same category' USING ERRCODE = '23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "corporate_kyc_documents_insert_guard_trigger"
  BEFORE INSERT ON "corporate_kyc_documents" FOR EACH ROW EXECUTE FUNCTION "validate_corporate_kyc_document_insert"();

-- Rows are immutable except for the one-way supersede transition performed
-- while the application is still editable. Deletes are rejected.
CREATE FUNCTION "enforce_corporate_kyc_document_immutability"() RETURNS TRIGGER AS $$
DECLARE app_status "OnboardingApplicationStatus";
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Corporate KYC document rows cannot be deleted' USING ERRCODE = '42501';
  END IF;
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."applicationId" IS DISTINCT FROM OLD."applicationId"
     OR NEW."category" IS DISTINCT FROM OLD."category" OR NEW."version" IS DISTINCT FROM OLD."version"
     OR NEW."replacesDocumentId" IS DISTINCT FROM OLD."replacesDocumentId"
     OR NEW."storageObjectKey" IS DISTINCT FROM OLD."storageObjectKey"
     OR NEW."storageObjectVersionId" IS DISTINCT FROM OLD."storageObjectVersionId"
     OR NEW."contentType" IS DISTINCT FROM OLD."contentType" OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes"
     OR NEW."checksumSha256" IS DISTINCT FROM OLD."checksumSha256" OR NEW."scanStatus" IS DISTINCT FROM OLD."scanStatus"
     OR NEW."uploadedByUserId" IS DISTINCT FROM OLD."uploadedByUserId" OR NEW."uploadedAt" IS DISTINCT FROM OLD."uploadedAt" THEN
    RAISE EXCEPTION 'Corporate KYC document metadata is immutable' USING ERRCODE = '42501';
  END IF;
  IF NOT (OLD."isCurrent" AND NOT NEW."isCurrent" AND OLD."supersededAt" IS NULL AND NEW."supersededAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'Only the one-way supersede transition is permitted' USING ERRCODE = '42501';
  END IF;
  SELECT "status" INTO app_status FROM "onboarding_applications" WHERE "id" = OLD."applicationId";
  IF app_status NOT IN ('DRAFT'::"OnboardingApplicationStatus", 'INFO_REQUESTED'::"OnboardingApplicationStatus") THEN
    RAISE EXCEPTION 'Corporate KYC documents cannot change in the current application state' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "corporate_kyc_documents_immutable_trigger"
  BEFORE UPDATE OR DELETE ON "corporate_kyc_documents" FOR EACH ROW EXECUTE FUNCTION "enforce_corporate_kyc_document_immutability"();
CREATE TRIGGER "corporate_kyc_documents_no_truncate_trigger"
  BEFORE TRUNCATE ON "corporate_kyc_documents" FOR EACH STATEMENT EXECUTE FUNCTION "reject_verification_record_truncate"();

-- Append-only audit of uploads, replacements and view authorizations.
CREATE TABLE "corporate_kyc_document_events" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "documentId" UUID NOT NULL,
  "category" "CorporateKycDocumentCategory" NOT NULL,
  "documentVersion" INTEGER NOT NULL,
  "eventKind" "CorporateKycDocumentEventKind" NOT NULL,
  "actorUserId" UUID NOT NULL,
  "previousDocumentId" UUID,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "corporate_kyc_document_events_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corporate_kyc_document_events_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "onboarding_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corporate_kyc_document_events_documentId_fkey"
    FOREIGN KEY ("documentId") REFERENCES "corporate_kyc_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corporate_kyc_document_events_previousDocumentId_fkey"
    FOREIGN KEY ("previousDocumentId") REFERENCES "corporate_kyc_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corporate_kyc_document_events_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corporate_kyc_document_events_previous_check" CHECK (("eventKind" = 'REPLACED') = ("previousDocumentId" IS NOT NULL))
);
CREATE INDEX "corporate_kyc_document_events_applicationId_createdAt_idx" ON "corporate_kyc_document_events"("applicationId", "createdAt");
CREATE INDEX "corporate_kyc_document_events_documentId_createdAt_idx" ON "corporate_kyc_document_events"("documentId", "createdAt");
REVOKE ALL ON TABLE "corporate_kyc_document_events" FROM PUBLIC;

CREATE FUNCTION "validate_corporate_kyc_document_event"() RETURNS TRIGGER AS $$
DECLARE doc RECORD;
BEGIN
  SELECT "applicationId", "category", "version", "uploadedByUserId", "replacesDocumentId" INTO doc
    FROM "corporate_kyc_documents" WHERE "id" = NEW."documentId";
  IF NOT FOUND OR doc."applicationId" <> NEW."applicationId" OR doc."category" <> NEW."category" OR doc."version" <> NEW."documentVersion" THEN
    RAISE EXCEPTION 'Corporate KYC document event must match its document' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" IN ('UPLOADED'::"CorporateKycDocumentEventKind", 'REPLACED'::"CorporateKycDocumentEventKind") THEN
    IF NEW."actorUserId" <> doc."uploadedByUserId"
       OR (NEW."eventKind" = 'UPLOADED'::"CorporateKycDocumentEventKind" AND doc."replacesDocumentId" IS NOT NULL)
       OR (NEW."eventKind" = 'REPLACED'::"CorporateKycDocumentEventKind" AND NEW."previousDocumentId" IS DISTINCT FROM doc."replacesDocumentId") THEN
      RAISE EXCEPTION 'Upload audit must match the uploader and replacement chain' USING ERRCODE = '23514';
    END IF;
  ELSIF NOT EXISTS (
    SELECT 1 FROM "onboarding_applications" a WHERE a."id" = NEW."applicationId" AND a."initiatingUserId" = NEW."actorUserId"
  ) AND NOT EXISTS (
    SELECT 1 FROM "users" u WHERE u."id" = NEW."actorUserId" AND u."role" IN ('STAFF'::"UserRole", 'ADMIN'::"UserRole")
  ) THEN
    RAISE EXCEPTION 'View audit requires the application owner or a staff identity' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "corporate_kyc_document_events_insert_guard_trigger"
  BEFORE INSERT ON "corporate_kyc_document_events" FOR EACH ROW EXECUTE FUNCTION "validate_corporate_kyc_document_event"();
CREATE TRIGGER "corporate_kyc_document_events_immutable_trigger"
  BEFORE UPDATE OR DELETE ON "corporate_kyc_document_events" FOR EACH ROW EXECUTE FUNCTION "reject_verification_record_mutation"();
CREATE TRIGGER "corporate_kyc_document_events_no_truncate_trigger"
  BEFORE TRUNCATE ON "corporate_kyc_document_events" FOR EACH STATEMENT EXECUTE FUNCTION "reject_verification_record_truncate"();

-- One immutable applicant submission per application. It pins the exact
-- profile/details versions and the three document versions that were
-- submitted. The raw Idempotency-Key is never stored, only a domain-separated digest.
CREATE TABLE "corporate_application_submissions" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "submittedByUserId" UUID NOT NULL,
  "idempotencyKeyDigest" CHAR(64) NOT NULL,
  "profileVersion" INTEGER NOT NULL,
  "detailsVersion" INTEGER NOT NULL,
  "certificateOfIncorporationDocumentId" UUID NOT NULL,
  "memartDocumentId" UUID NOT NULL,
  "tinCertificateDocumentId" UUID NOT NULL,
  "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "corporate_application_submissions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corporate_application_submissions_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "onboarding_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corporate_application_submissions_submittedByUserId_fkey"
    FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corporate_application_submissions_coi_fkey"
    FOREIGN KEY ("certificateOfIncorporationDocumentId") REFERENCES "corporate_kyc_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corporate_application_submissions_memart_fkey"
    FOREIGN KEY ("memartDocumentId") REFERENCES "corporate_kyc_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corporate_application_submissions_tin_fkey"
    FOREIGN KEY ("tinCertificateDocumentId") REFERENCES "corporate_kyc_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corporate_application_submissions_digest_check" CHECK ("idempotencyKeyDigest" ~ '^[0-9a-f]{64}$'),
  CONSTRAINT "corporate_application_submissions_versions_check" CHECK ("profileVersion" >= 1 AND "detailsVersion" >= 1)
);
CREATE UNIQUE INDEX "corporate_application_submissions_applicationId_key" ON "corporate_application_submissions"("applicationId");
REVOKE ALL ON TABLE "corporate_application_submissions" FROM PUBLIC;

CREATE FUNCTION "validate_corporate_application_submission"() RETURNS TRIGGER AS $$
DECLARE app RECORD;
BEGIN
  SELECT "kind", "status", "initiatingUserId" INTO app FROM "onboarding_applications" WHERE "id" = NEW."applicationId";
  IF NOT FOUND OR app."kind" <> 'CORPORATE'::"OnboardingApplicationKind" OR app."status" <> 'DRAFT'::"OnboardingApplicationStatus" THEN
    RAISE EXCEPTION 'Only a DRAFT Corporate application can be submitted' USING ERRCODE = '23514';
  END IF;
  IF NEW."submittedByUserId" <> app."initiatingUserId" THEN
    RAISE EXCEPTION 'Submission must be made by the application initiator' USING ERRCODE = '42501';
  END IF;
  IF (SELECT count(*) FROM "corporate_kyc_documents" d
      WHERE d."applicationId" = NEW."applicationId" AND d."isCurrent" AND (
        (d."id" = NEW."certificateOfIncorporationDocumentId" AND d."category" = 'CERTIFICATE_OF_INCORPORATION'::"CorporateKycDocumentCategory") OR
        (d."id" = NEW."memartDocumentId" AND d."category" = 'MEMART'::"CorporateKycDocumentCategory") OR
        (d."id" = NEW."tinCertificateDocumentId" AND d."category" = 'TIN_CERTIFICATE'::"CorporateKycDocumentCategory"))) <> 3 THEN
    RAISE EXCEPTION 'Submission requires the three current mandatory Corporate KYC documents' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "corporate_application_submissions_insert_guard_trigger"
  BEFORE INSERT ON "corporate_application_submissions" FOR EACH ROW EXECUTE FUNCTION "validate_corporate_application_submission"();
CREATE TRIGGER "corporate_application_submissions_immutable_trigger"
  BEFORE UPDATE OR DELETE ON "corporate_application_submissions" FOR EACH ROW EXECUTE FUNCTION "reject_verification_record_mutation"();
CREATE TRIGGER "corporate_application_submissions_no_truncate_trigger"
  BEFORE TRUNCATE ON "corporate_application_submissions" FOR EACH STATEMENT EXECUTE FUNCTION "reject_verification_record_truncate"();

-- Extend lifecycle-history validation with the applicant SUBMITTED event.
-- All pre-existing branches (CREATED and staff review events) are unchanged.
CREATE OR REPLACE FUNCTION "validate_onboarding_application_creation_history"() RETURNS TRIGGER AS $$
DECLARE app RECORD;
DECLARE required_event "ApplicationStaffReviewEventKind";
DECLARE expected_from "OnboardingApplicationStatus";
BEGIN
  SELECT "initiatingUserId", "status", "kind", "submittedByUserId" INTO app
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
  IF NEW."event" = 'SUBMITTED'::"OnboardingApplicationHistoryEvent" THEN
    IF app."kind" <> 'CORPORATE'::"OnboardingApplicationKind"
       OR NEW."fromStatus" IS DISTINCT FROM 'DRAFT'::"OnboardingApplicationStatus"
       OR NEW."toStatus" <> 'SUBMITTED'::"OnboardingApplicationStatus"
       OR NEW."actorUserId" <> app."initiatingUserId"
       OR app."submittedByUserId" IS DISTINCT FROM NEW."actorUserId"
       OR NOT EXISTS (
         SELECT 1 FROM "corporate_application_submissions" s
         WHERE s."applicationId" = NEW."applicationId" AND s."submittedByUserId" = NEW."actorUserId"
       ) THEN
      RAISE EXCEPTION 'Submission history requires the initiator and a recorded Corporate submission' USING ERRCODE = '23514';
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
