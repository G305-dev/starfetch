-- Individual KYC v1 persistence. Applicant-entered answers are encrypted as
-- one purpose-separated envelope; documents remain in private object storage.
CREATE TYPE "IndividualKycProfileStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'INFO_REQUIRED', 'APPROVED', 'REJECTED');
CREATE TYPE "IndividualKycSectionStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'COMPLETE');
CREATE TYPE "IndividualKycIdDocumentType" AS ENUM ('PASSPORT', 'PVC', 'DRIVERS_LICENSE', 'NIN');
CREATE TYPE "IndividualKycDocumentStatus" AS ENUM ('PENDING_UPLOAD', 'UPLOADED', 'REPLACED', 'REMOVED');
CREATE TYPE "IndividualKycDocumentScanStatus" AS ENUM ('PENDING', 'CLEAN', 'REJECTED', 'FAILED');
CREATE TYPE "IndividualKycProfileEventKind" AS ENUM ('SECTION_SAVED', 'ID_DOCUMENT_UPLOAD_INTENT_CREATED', 'ID_DOCUMENT_SCAN_CLEAN', 'ID_DOCUMENT_SCAN_REJECTED', 'SUBMITTED', 'REVIEW_STARTED', 'INFORMATION_REQUESTED', 'DECISION_RECORDED', 'APPROVED', 'REJECTED');
CREATE TYPE "IndividualKycSection" AS ENUM ('PERSONAL', 'INVESTMENT', 'SOURCE_OF_FUNDS', 'BANK');
CREATE TYPE "IndividualKycEncryptionProvider" AS ENUM ('AWS_KMS', 'TEST_AES_GCM');

CREATE TABLE "individual_kyc_profiles" (
    "id" UUID NOT NULL,
    "investorUserId" UUID NOT NULL,
    "status" "IndividualKycProfileStatus" NOT NULL DEFAULT 'DRAFT',
    "personalSectionStatus" "IndividualKycSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "investmentSectionStatus" "IndividualKycSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "sourceOfFundsSectionStatus" "IndividualKycSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "bankSectionStatus" "IndividualKycSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "encryptedPayload" TEXT,
    "payloadIv" VARCHAR(32),
    "payloadAuthTag" VARCHAR(32),
    "encryptedDataKey" TEXT,
    "encryptionKeyProvider" "IndividualKycEncryptionProvider",
    "encryptionKeyId" TEXT,
    "encryptionKeyVersion" VARCHAR(64),
    "encryptionContextVersion" INTEGER,
    "version" INTEGER NOT NULL DEFAULT 0,
    "submittedAt" TIMESTAMP(3),
    "approvedAt" TIMESTAMP(3),
    "approvedByUserId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "individual_kyc_profiles_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "individual_kyc_profiles_version_nonnegative" CHECK ("version" >= 0),
    CONSTRAINT "individual_kyc_profiles_envelope_complete" CHECK (
      ("encryptedPayload" IS NULL AND "payloadIv" IS NULL AND "payloadAuthTag" IS NULL AND "encryptedDataKey" IS NULL AND "encryptionKeyProvider" IS NULL AND "encryptionKeyId" IS NULL AND "encryptionKeyVersion" IS NULL AND "encryptionContextVersion" IS NULL)
      OR
      ("encryptedPayload" IS NOT NULL AND "payloadIv" IS NOT NULL AND "payloadAuthTag" IS NOT NULL AND "encryptedDataKey" IS NOT NULL AND "encryptionKeyProvider" IS NOT NULL AND "encryptionKeyId" IS NOT NULL AND "encryptionKeyVersion" IS NOT NULL AND "encryptionContextVersion" IS NOT NULL)
    ),
    CONSTRAINT "individual_kyc_profiles_id_owner_key" UNIQUE ("id", "investorUserId"),
    CONSTRAINT "individual_kyc_profiles_investorUserId_key" UNIQUE ("investorUserId"),
    CONSTRAINT "individual_kyc_profiles_investorUserId_fkey" FOREIGN KEY ("investorUserId") REFERENCES "investor_profiles"("userId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "individual_kyc_profiles_approvedByUserId_fkey" FOREIGN KEY ("approvedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "individual_kyc_documents" (
    "id" UUID NOT NULL,
    "kycProfileId" UUID NOT NULL,
    "investorUserId" UUID NOT NULL,
    "documentType" "IndividualKycIdDocumentType" NOT NULL,
    "storageKey" VARCHAR(256) NOT NULL,
    "originalFilename" VARCHAR(128) NOT NULL,
    "contentType" VARCHAR(120) NOT NULL,
    "sizeBytes" BIGINT NOT NULL,
    "status" "IndividualKycDocumentStatus" NOT NULL DEFAULT 'PENDING_UPLOAD',
    "scanStatus" "IndividualKycDocumentScanStatus" NOT NULL DEFAULT 'PENDING',
    "scannerVersion" VARCHAR(64),
    "uploadExpiresAt" TIMESTAMP(3) NOT NULL,
    "uploadedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "individual_kyc_documents_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "individual_kyc_documents_size_check" CHECK ("sizeBytes" > 0 AND "sizeBytes" <= 10485760),
    CONSTRAINT "individual_kyc_documents_id_profile_key" UNIQUE ("id", "kycProfileId"),
    CONSTRAINT "individual_kyc_documents_storageKey_key" UNIQUE ("storageKey"),
    CONSTRAINT "individual_kyc_documents_kycProfileId_investorUserId_fkey" FOREIGN KEY ("kycProfileId", "investorUserId") REFERENCES "individual_kyc_profiles"("id", "investorUserId") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "individual_kyc_documents_investorUserId_fkey" FOREIGN KEY ("investorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE TABLE "individual_kyc_profile_events" (
    "id" UUID NOT NULL,
    "kycProfileId" UUID NOT NULL,
    "actorUserId" UUID NOT NULL,
    "eventKind" "IndividualKycProfileEventKind" NOT NULL,
    "section" "IndividualKycSection",
    "profileVersion" INTEGER NOT NULL,
    "relatedDocumentId" UUID,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "individual_kyc_profile_events_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "individual_kyc_profile_events_version_key" UNIQUE ("kycProfileId", "profileVersion"),
    CONSTRAINT "individual_kyc_profile_events_profile_fkey" FOREIGN KEY ("kycProfileId") REFERENCES "individual_kyc_profiles"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "individual_kyc_profile_events_actorUserId_fkey" FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "individual_kyc_profile_events_relatedDocumentId_kycProfile_fkey" FOREIGN KEY ("relatedDocumentId", "kycProfileId") REFERENCES "individual_kyc_documents"("id", "kycProfileId") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "individual_kyc_documents_investorUserId_status_scanStatus_idx" ON "individual_kyc_documents"("investorUserId", "status", "scanStatus");
CREATE INDEX "individual_kyc_documents_profile_type_status_scan_idx" ON "individual_kyc_documents"("kycProfileId", "documentType", "status", "scanStatus");
CREATE INDEX "individual_kyc_profile_events_kycProfileId_occurredAt_idx" ON "individual_kyc_profile_events"("kycProfileId", "occurredAt");

-- Public applicant writes may only create and submit their own drafts. Review
-- and approval lifecycle labels are reserved for a separately authorized
-- workflow; no such workflow is enabled by this migration.
CREATE FUNCTION "guard_individual_kyc_profile_insert"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" <> 'DRAFT'::"IndividualKycProfileStatus" OR NEW."version" <> 0 OR NEW."submittedAt" IS NOT NULL OR NEW."approvedAt" IS NOT NULL OR NEW."approvedByUserId" IS NOT NULL OR
     NEW."personalSectionStatus" <> 'NOT_STARTED'::"IndividualKycSectionStatus" OR NEW."investmentSectionStatus" <> 'NOT_STARTED'::"IndividualKycSectionStatus" OR NEW."sourceOfFundsSectionStatus" <> 'NOT_STARTED'::"IndividualKycSectionStatus" OR NEW."bankSectionStatus" <> 'NOT_STARTED'::"IndividualKycSectionStatus" OR
     NEW."encryptedPayload" IS NOT NULL OR NEW."payloadIv" IS NOT NULL OR NEW."payloadAuthTag" IS NOT NULL OR NEW."encryptedDataKey" IS NOT NULL OR NEW."encryptionKeyProvider" IS NOT NULL OR NEW."encryptionKeyId" IS NOT NULL OR NEW."encryptionKeyVersion" IS NOT NULL OR NEW."encryptionContextVersion" IS NOT NULL THEN
    RAISE EXCEPTION 'Individual KYC profile must start as an empty draft' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "individual_kyc_profiles_insert_guard" BEFORE INSERT ON "individual_kyc_profiles" FOR EACH ROW EXECUTE FUNCTION "guard_individual_kyc_profile_insert"();

CREATE FUNCTION "guard_individual_kyc_profile_update"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."investorUserId" IS DISTINCT FROM OLD."investorUserId" OR NEW."id" IS DISTINCT FROM OLD."id" THEN
    RAISE EXCEPTION 'Individual KYC profile owner is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW."version" <> OLD."version" + 1 THEN
    RAISE EXCEPTION 'Individual KYC profile version must advance exactly once' USING ERRCODE = '23514';
  END IF;
  IF OLD."status" <> 'DRAFT'::"IndividualKycProfileStatus" OR NEW."status" NOT IN ('DRAFT'::"IndividualKycProfileStatus", 'SUBMITTED'::"IndividualKycProfileStatus") THEN
    RAISE EXCEPTION 'Individual KYC lifecycle transition is not authorized' USING ERRCODE = '42501';
  END IF;
  IF NEW."status" = 'SUBMITTED'::"IndividualKycProfileStatus" AND (NEW."submittedAt" IS NULL OR OLD."submittedAt" IS NOT NULL) THEN
    RAISE EXCEPTION 'Submission requires a single audit timestamp' USING ERRCODE = '23514';
  END IF;
  IF NEW."status" = 'DRAFT'::"IndividualKycProfileStatus" AND NEW."submittedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'Draft profile cannot have a submission timestamp' USING ERRCODE = '23514';
  END IF;
  IF OLD."submittedAt" IS NOT NULL AND NEW."submittedAt" IS DISTINCT FROM OLD."submittedAt" THEN
    RAISE EXCEPTION 'Submission timestamp is immutable' USING ERRCODE = '42501';
  END IF;
  IF NEW."approvedAt" IS NOT NULL OR NEW."approvedByUserId" IS NOT NULL THEN
    RAISE EXCEPTION 'Individual KYC approval is not available through this workflow' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "individual_kyc_profiles_update_guard" BEFORE UPDATE ON "individual_kyc_profiles" FOR EACH ROW EXECUTE FUNCTION "guard_individual_kyc_profile_update"();

CREATE FUNCTION "ensure_individual_kyc_profile_version_audited"() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "individual_kyc_profile_events" e
    WHERE e."kycProfileId" = NEW."id" AND e."profileVersion" = NEW."version"
  ) THEN
    RAISE EXCEPTION 'Every Individual KYC profile version must have an audit event' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER "individual_kyc_profile_version_audit_guard"
  AFTER UPDATE ON "individual_kyc_profiles" DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "ensure_individual_kyc_profile_version_audited"();

CREATE FUNCTION "guard_individual_kyc_document_insert"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."status" <> 'PENDING_UPLOAD'::"IndividualKycDocumentStatus" OR NEW."scanStatus" <> 'PENDING'::"IndividualKycDocumentScanStatus" OR NEW."scannerVersion" IS NOT NULL OR NEW."uploadedAt" IS NOT NULL THEN
    RAISE EXCEPTION 'New Individual KYC document must start pending scan' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "individual_kyc_documents_insert_guard" BEFORE INSERT ON "individual_kyc_documents" FOR EACH ROW EXECUTE FUNCTION "guard_individual_kyc_document_insert"();

CREATE FUNCTION "guard_individual_kyc_document_update"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."kycProfileId" IS DISTINCT FROM OLD."kycProfileId" OR NEW."investorUserId" IS DISTINCT FROM OLD."investorUserId" OR NEW."storageKey" IS DISTINCT FROM OLD."storageKey" OR NEW."documentType" IS DISTINCT FROM OLD."documentType" OR NEW."originalFilename" IS DISTINCT FROM OLD."originalFilename" OR NEW."contentType" IS DISTINCT FROM OLD."contentType" OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes" OR NEW."uploadExpiresAt" IS DISTINCT FROM OLD."uploadExpiresAt" THEN
    RAISE EXCEPTION 'Individual KYC document ownership and key are immutable' USING ERRCODE = '42501';
  END IF;
  IF OLD."status" <> 'PENDING_UPLOAD'::"IndividualKycDocumentStatus" OR NEW."status" NOT IN ('UPLOADED'::"IndividualKycDocumentStatus", 'REMOVED'::"IndividualKycDocumentStatus") THEN
    RAISE EXCEPTION 'Individual KYC document lifecycle transition is not authorized' USING ERRCODE = '42501';
  END IF;
  IF NEW."status" = 'UPLOADED'::"IndividualKycDocumentStatus" AND (NEW."scanStatus" <> 'CLEAN'::"IndividualKycDocumentScanStatus" OR NEW."scannerVersion" IS NULL OR NEW."uploadedAt" IS NULL) THEN
    RAISE EXCEPTION 'Only scanned clean documents may be uploaded' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "individual_kyc_documents_update_guard" BEFORE UPDATE ON "individual_kyc_documents" FOR EACH ROW EXECUTE FUNCTION "guard_individual_kyc_document_update"();

CREATE FUNCTION "guard_individual_kyc_profile_event_insert"() RETURNS TRIGGER AS $$
DECLARE profile_owner UUID;
DECLARE current_version INTEGER;
DECLARE current_status "IndividualKycProfileStatus";
DECLARE related_document RECORD;
BEGIN
  SELECT "investorUserId", "version", "status" INTO profile_owner, current_version, current_status
    FROM "individual_kyc_profiles" WHERE "id" = NEW."kycProfileId";
  IF NOT FOUND OR current_version < 1 OR NEW."actorUserId" IS DISTINCT FROM profile_owner OR NEW."profileVersion" IS DISTINCT FROM current_version THEN
    RAISE EXCEPTION 'Individual KYC event must match owner and current version' USING ERRCODE = '42501';
  END IF;
  IF NEW."eventKind" NOT IN (
    'SECTION_SAVED'::"IndividualKycProfileEventKind",
    'ID_DOCUMENT_UPLOAD_INTENT_CREATED'::"IndividualKycProfileEventKind",
    'ID_DOCUMENT_SCAN_CLEAN'::"IndividualKycProfileEventKind",
    'ID_DOCUMENT_SCAN_REJECTED'::"IndividualKycProfileEventKind",
    'SUBMITTED'::"IndividualKycProfileEventKind"
  ) THEN RAISE EXCEPTION 'Review and approval events are not available' USING ERRCODE = '42501'; END IF;
  IF (NEW."eventKind" = 'SECTION_SAVED'::"IndividualKycProfileEventKind") IS DISTINCT FROM (NEW."section" IS NOT NULL) THEN
    RAISE EXCEPTION 'Section audit event must identify exactly one section' USING ERRCODE = '23514';
  END IF;
  IF (NEW."eventKind" IN ('ID_DOCUMENT_UPLOAD_INTENT_CREATED'::"IndividualKycProfileEventKind", 'ID_DOCUMENT_SCAN_CLEAN'::"IndividualKycProfileEventKind", 'ID_DOCUMENT_SCAN_REJECTED'::"IndividualKycProfileEventKind")) IS DISTINCT FROM (NEW."relatedDocumentId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Document audit event must identify exactly one document' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" IN ('ID_DOCUMENT_UPLOAD_INTENT_CREATED'::"IndividualKycProfileEventKind", 'ID_DOCUMENT_SCAN_CLEAN'::"IndividualKycProfileEventKind", 'ID_DOCUMENT_SCAN_REJECTED'::"IndividualKycProfileEventKind") THEN
    SELECT "status", "scanStatus", "scannerVersion" INTO related_document
      FROM "individual_kyc_documents" WHERE "id" = NEW."relatedDocumentId" AND "kycProfileId" = NEW."kycProfileId";
    IF NOT FOUND THEN RAISE EXCEPTION 'Individual KYC document audit reference is invalid' USING ERRCODE = '23503'; END IF;
    IF NEW."eventKind" = 'ID_DOCUMENT_UPLOAD_INTENT_CREATED'::"IndividualKycProfileEventKind" AND
       (related_document."status" <> 'PENDING_UPLOAD'::"IndividualKycDocumentStatus" OR related_document."scanStatus" <> 'PENDING'::"IndividualKycDocumentScanStatus") THEN
      RAISE EXCEPTION 'Upload-intent event requires pending document' USING ERRCODE = '23514';
    END IF;
    IF NEW."eventKind" = 'ID_DOCUMENT_SCAN_CLEAN'::"IndividualKycProfileEventKind" AND
       (related_document."status" <> 'UPLOADED'::"IndividualKycDocumentStatus" OR related_document."scanStatus" <> 'CLEAN'::"IndividualKycDocumentScanStatus" OR related_document."scannerVersion" IS NULL) THEN
      RAISE EXCEPTION 'Clean scan event requires clean scanner result' USING ERRCODE = '23514';
    END IF;
    IF NEW."eventKind" = 'ID_DOCUMENT_SCAN_REJECTED'::"IndividualKycProfileEventKind" AND
       (related_document."status" <> 'REMOVED'::"IndividualKycDocumentStatus" OR related_document."scanStatus" NOT IN ('REJECTED'::"IndividualKycDocumentScanStatus", 'FAILED'::"IndividualKycDocumentScanStatus")) THEN
      RAISE EXCEPTION 'Rejected scan event requires rejected/failed document' USING ERRCODE = '23514';
    END IF;
  END IF;
  IF NEW."eventKind" = 'SUBMITTED'::"IndividualKycProfileEventKind" AND current_status <> 'SUBMITTED'::"IndividualKycProfileStatus" THEN
    RAISE EXCEPTION 'Submission audit requires submitted profile state' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" <> 'SUBMITTED'::"IndividualKycProfileEventKind" AND current_status <> 'DRAFT'::"IndividualKycProfileStatus" THEN
    RAISE EXCEPTION 'Applicant event requires draft profile state' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "individual_kyc_profile_events_insert_guard" BEFORE INSERT ON "individual_kyc_profile_events" FOR EACH ROW EXECUTE FUNCTION "guard_individual_kyc_profile_event_insert"();

CREATE FUNCTION "reject_individual_kyc_profile_event_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Individual KYC audit records are append-only' USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "individual_kyc_profile_events_no_mutation" BEFORE UPDATE OR DELETE ON "individual_kyc_profile_events" FOR EACH ROW EXECUTE FUNCTION "reject_individual_kyc_profile_event_mutation"();
CREATE TRIGGER "individual_kyc_profile_events_no_truncate" BEFORE TRUNCATE ON "individual_kyc_profile_events" FOR EACH STATEMENT EXECUTE FUNCTION "reject_individual_kyc_profile_event_mutation"();
