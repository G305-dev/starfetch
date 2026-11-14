-- Additive asynchronous scan workflow for Individual KYC documents.
-- No upload, database, residency, or review gate is enabled by this migration.

ALTER TYPE "IndividualKycDocumentStatus" ADD VALUE IF NOT EXISTS 'PENDING_SCAN';
ALTER TYPE "IndividualKycProfileEventKind" ADD VALUE IF NOT EXISTS 'ID_DOCUMENT_SCAN_QUEUED';
ALTER TYPE "IndividualKycProfileEventKind" ADD VALUE IF NOT EXISTS 'ID_DOCUMENT_CLEANUP';
CREATE TYPE "IndividualKycEventActorKind" AS ENUM ('APPLICANT', 'SCANNER_WORKER', 'RETENTION_WORKER');

ALTER TABLE "individual_kyc_documents"
  ADD COLUMN "expectedChecksumSha256" VARCHAR(44),
  ADD COLUMN "storageObjectVersionId" VARCHAR(256),
  ADD COLUMN "scanCompletedAt" TIMESTAMP(3),
  ADD COLUMN "scanSha256" VARCHAR(44),
  ADD COLUMN "scanAttestationDigest" VARCHAR(64),
  ADD COLUMN "scanRequestedAt" TIMESTAMP(3),
  ADD COLUMN "scanClaimedAt" TIMESTAMP(3),
  ADD COLUMN "scanLeaseExpiresAt" TIMESTAMP(3),
  ADD COLUMN "scanWorkerId" VARCHAR(80),
  ADD COLUMN "scanJobTokenHash" VARCHAR(64),
  ADD COLUMN "scanAttemptCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "retentionExpiresAt" TIMESTAMP(3),
  ADD COLUMN "objectDeletedAt" TIMESTAMP(3);

ALTER TABLE "individual_kyc_documents"
  ADD CONSTRAINT "individual_kyc_documents_checksum_format_check"
    CHECK ("expectedChecksumSha256" IS NULL OR "expectedChecksumSha256" ~ '^[A-Za-z0-9+/]{43}=$'),
  ADD CONSTRAINT "individual_kyc_documents_scan_attempts_check"
    CHECK ("scanAttemptCount" >= 0 AND "scanAttemptCount" <= 100),
  ADD CONSTRAINT "individual_kyc_documents_scan_attestation_check"
    CHECK ("scanSha256" IS NULL OR "scanSha256" ~ '^[A-Za-z0-9+/]{43}=$'),
  ADD CONSTRAINT "individual_kyc_documents_scan_token_hash_check"
    CHECK ("scanJobTokenHash" IS NULL OR "scanJobTokenHash" ~ '^[0-9a-f]{64}$');

CREATE INDEX "individual_kyc_documents_status_lease_idx"
  ON "individual_kyc_documents"("status", "scanLeaseExpiresAt", "scanRequestedAt");
CREATE INDEX "individual_kyc_documents_status_retention_idx"
  ON "individual_kyc_documents"("status", "retentionExpiresAt");

ALTER TABLE "individual_kyc_profile_events"
  ALTER COLUMN "actorUserId" DROP NOT NULL,
  ADD COLUMN "actorKind" "IndividualKycEventActorKind" NOT NULL DEFAULT 'APPLICANT',
  ADD COLUMN "actorReference" VARCHAR(128);

-- Applicant writes may only start an upload or queue its scan. Worker writes
-- require authenticated internal API processing and are explicitly identified
-- in the append-only event row; there is still no approval writer here.
CREATE OR REPLACE FUNCTION "guard_individual_kyc_document_update"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id" OR NEW."kycProfileId" IS DISTINCT FROM OLD."kycProfileId" OR
     NEW."investorUserId" IS DISTINCT FROM OLD."investorUserId" OR NEW."storageKey" IS DISTINCT FROM OLD."storageKey" OR
     NEW."documentType" IS DISTINCT FROM OLD."documentType" OR NEW."originalFilename" IS DISTINCT FROM OLD."originalFilename" OR
     NEW."contentType" IS DISTINCT FROM OLD."contentType" OR NEW."sizeBytes" IS DISTINCT FROM OLD."sizeBytes" OR
     NEW."expectedChecksumSha256" IS DISTINCT FROM OLD."expectedChecksumSha256" OR
     NEW."uploadExpiresAt" IS DISTINCT FROM OLD."uploadExpiresAt" THEN
    RAISE EXCEPTION 'Individual KYC document ownership and upload intent are immutable' USING ERRCODE = '42501';
  END IF;

  IF OLD."status" = 'PENDING_UPLOAD'::"IndividualKycDocumentStatus" AND
     NEW."status" = 'PENDING_SCAN'::"IndividualKycDocumentStatus" THEN
    IF NEW."scanStatus" <> 'PENDING'::"IndividualKycDocumentScanStatus" OR
       NEW."uploadedAt" IS NULL OR NEW."storageObjectVersionId" IS NULL OR
       NEW."expectedChecksumSha256" IS NULL OR NEW."scanRequestedAt" IS NULL OR
       NEW."scanCompletedAt" IS NOT NULL OR NEW."scanJobTokenHash" IS NOT NULL OR
       NEW."scanAttemptCount" <> 0 THEN
      RAISE EXCEPTION 'Scan queueing requires a verified immutable object version and checksum' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'PENDING_SCAN'::"IndividualKycDocumentStatus" AND
     NEW."status" = 'REMOVED'::"IndividualKycDocumentStatus" AND
     NEW."scanStatus" = 'FAILED'::"IndividualKycDocumentScanStatus" AND
     NEW."scanCompletedAt" IS NULL AND NEW."scanSha256" IS NULL AND NEW."scanAttestationDigest" IS NULL AND
     NEW."scanJobTokenHash" IS NULL AND NEW."scanWorkerId" IS NULL AND NEW."scanLeaseExpiresAt" IS NULL AND
     NEW."uploadExpiresAt" <= CURRENT_TIMESTAMP - INTERVAL '60 seconds' THEN
    IF NEW."storageObjectVersionId" IS DISTINCT FROM OLD."storageObjectVersionId" OR
       NEW."expectedChecksumSha256" IS DISTINCT FROM OLD."expectedChecksumSha256" THEN
      RAISE EXCEPTION 'Expired scan cleanup cannot change pinned object identity' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'PENDING_SCAN'::"IndividualKycDocumentStatus" AND
     NEW."status" = 'PENDING_SCAN'::"IndividualKycDocumentStatus" THEN
    IF NEW."storageObjectVersionId" IS DISTINCT FROM OLD."storageObjectVersionId" OR
       NEW."expectedChecksumSha256" IS DISTINCT FROM OLD."expectedChecksumSha256" OR
       NEW."scanRequestedAt" IS DISTINCT FROM OLD."scanRequestedAt" OR
       NEW."scanStatus" <> 'PENDING'::"IndividualKycDocumentScanStatus" OR
       NEW."scanCompletedAt" IS NOT NULL OR NEW."scanSha256" IS NOT NULL OR
       NEW."scanAttestationDigest" IS NOT NULL OR NEW."scanJobTokenHash" IS NULL OR
       NEW."scanWorkerId" IS NULL OR NEW."scanLeaseExpiresAt" IS NULL OR
       NEW."scanAttemptCount" <> OLD."scanAttemptCount" + 1 THEN
      RAISE EXCEPTION 'Invalid or replayed Individual KYC scan lease' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'PENDING_SCAN'::"IndividualKycDocumentStatus" AND
     NEW."status" IN ('UPLOADED'::"IndividualKycDocumentStatus", 'REMOVED'::"IndividualKycDocumentStatus") THEN
    IF NEW."storageObjectVersionId" IS DISTINCT FROM OLD."storageObjectVersionId" OR
       NEW."expectedChecksumSha256" IS DISTINCT FROM OLD."expectedChecksumSha256" OR
       NEW."scanRequestedAt" IS DISTINCT FROM OLD."scanRequestedAt" OR
       NEW."scanJobTokenHash" IS NOT NULL OR NEW."scanWorkerId" IS NOT NULL OR
       NEW."scanLeaseExpiresAt" IS NOT NULL OR NEW."scanCompletedAt" IS NULL OR
       NEW."scanSha256" IS NULL OR NEW."scanAttestationDigest" IS NULL THEN
      RAISE EXCEPTION 'Scan result must be bound to the queued object and consume its one-time token' USING ERRCODE = '23514';
    END IF;
    IF NEW."status" = 'UPLOADED'::"IndividualKycDocumentStatus" AND
       (NEW."scanStatus" <> 'CLEAN'::"IndividualKycDocumentScanStatus" OR NEW."scannerVersion" IS NULL OR
        NEW."scanSha256" <> NEW."expectedChecksumSha256" OR NEW."uploadedAt" IS NULL) THEN
      RAISE EXCEPTION 'Only an attested clean scan may be accepted' USING ERRCODE = '23514';
    END IF;
    IF NEW."status" = 'REMOVED'::"IndividualKycDocumentStatus" AND
       NEW."scanStatus" NOT IN ('REJECTED'::"IndividualKycDocumentScanStatus", 'FAILED'::"IndividualKycDocumentScanStatus") THEN
      RAISE EXCEPTION 'Rejected or failed scans remain unapproved' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'PENDING_UPLOAD'::"IndividualKycDocumentStatus" AND
     NEW."status" = 'REMOVED'::"IndividualKycDocumentStatus" THEN
    IF NEW."scanStatus" NOT IN ('REJECTED'::"IndividualKycDocumentScanStatus", 'FAILED'::"IndividualKycDocumentScanStatus") OR
       NEW."scanCompletedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'An abandoned/rejected upload cannot be marked scanned' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'UPLOADED'::"IndividualKycDocumentStatus" AND
     NEW."status" = 'REMOVED'::"IndividualKycDocumentStatus" THEN
    IF NEW."scanStatus" <> OLD."scanStatus" OR NEW."scanCompletedAt" IS DISTINCT FROM OLD."scanCompletedAt" OR
       OLD."retentionExpiresAt" IS NULL OR OLD."retentionExpiresAt" > CURRENT_TIMESTAMP THEN
      RAISE EXCEPTION 'Clean KYC object deletion requires its approved retention expiry' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."status" = 'REMOVED'::"IndividualKycDocumentStatus" AND
     NEW."status" = 'REMOVED'::"IndividualKycDocumentStatus" THEN
    IF OLD."objectDeletedAt" IS NOT NULL OR NEW."objectDeletedAt" IS NULL OR
       NEW."scanStatus" IS DISTINCT FROM OLD."scanStatus" OR
       NEW."scanCompletedAt" IS DISTINCT FROM OLD."scanCompletedAt" OR
       NEW."storageObjectVersionId" IS DISTINCT FROM OLD."storageObjectVersionId" THEN
      RAISE EXCEPTION 'Removed document cleanup is one-time and immutable' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Individual KYC document lifecycle transition is not authorized' USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION "guard_individual_kyc_profile_event_insert"() RETURNS TRIGGER AS $$
DECLARE profile_owner UUID;
DECLARE current_version INTEGER;
DECLARE current_status "IndividualKycProfileStatus";
DECLARE related_document RECORD;
BEGIN
  SELECT "investorUserId", "version", "status" INTO profile_owner, current_version, current_status
    FROM "individual_kyc_profiles" WHERE "id" = NEW."kycProfileId";
  IF NOT FOUND OR current_version < 1 OR NEW."profileVersion" IS DISTINCT FROM current_version THEN
    RAISE EXCEPTION 'Individual KYC event must match current profile version' USING ERRCODE = '42501';
  END IF;

  IF NEW."actorKind" = 'APPLICANT'::"IndividualKycEventActorKind" THEN
    IF NEW."actorUserId" IS DISTINCT FROM profile_owner OR NEW."actorReference" IS NOT NULL OR
       NEW."eventKind" NOT IN ('SECTION_SAVED'::"IndividualKycProfileEventKind",
                               'ID_DOCUMENT_UPLOAD_INTENT_CREATED'::"IndividualKycProfileEventKind",
                               'ID_DOCUMENT_SCAN_QUEUED'::"IndividualKycProfileEventKind",
                               'SUBMITTED'::"IndividualKycProfileEventKind") THEN
      RAISE EXCEPTION 'Applicant event is not authorized' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW."actorKind" = 'SCANNER_WORKER'::"IndividualKycEventActorKind" THEN
    IF NEW."actorUserId" IS NOT NULL OR NEW."actorReference" IS NULL OR
       NEW."actorReference" !~ '^scanner:[A-Za-z0-9._-]{1,80}$' OR
       NEW."eventKind" NOT IN ('ID_DOCUMENT_SCAN_CLEAN'::"IndividualKycProfileEventKind",
                               'ID_DOCUMENT_SCAN_REJECTED'::"IndividualKycProfileEventKind") THEN
      RAISE EXCEPTION 'Scanner-worker event is not authorized' USING ERRCODE = '42501';
    END IF;
  ELSIF NEW."actorKind" = 'RETENTION_WORKER'::"IndividualKycEventActorKind" THEN
    IF NEW."actorUserId" IS NOT NULL OR NEW."actorReference" IS NULL OR
       NEW."actorReference" !~ '^retention:[A-Za-z0-9._-]{1,80}$' OR
       NEW."eventKind" <> 'ID_DOCUMENT_CLEANUP'::"IndividualKycProfileEventKind" THEN
      RAISE EXCEPTION 'Retention-worker event is not authorized' USING ERRCODE = '42501';
    END IF;
  ELSE
    RAISE EXCEPTION 'Unknown Individual KYC event actor' USING ERRCODE = '42501';
  END IF;

  IF (NEW."eventKind" IN ('SECTION_SAVED'::"IndividualKycProfileEventKind", 'ID_DOCUMENT_SCAN_QUEUED'::"IndividualKycProfileEventKind")) IS DISTINCT FROM (NEW."section" IS NOT NULL) THEN
    RAISE EXCEPTION 'Section event must identify exactly one section' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" IN ('ID_DOCUMENT_SCAN_QUEUED'::"IndividualKycProfileEventKind") AND NEW."section" <> 'PERSONAL'::"IndividualKycSection" THEN
    RAISE EXCEPTION 'Document scan job is associated with Personal KYC' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" IN ('ID_DOCUMENT_UPLOAD_INTENT_CREATED'::"IndividualKycProfileEventKind",
                          'ID_DOCUMENT_SCAN_QUEUED'::"IndividualKycProfileEventKind",
                          'ID_DOCUMENT_SCAN_CLEAN'::"IndividualKycProfileEventKind",
                          'ID_DOCUMENT_SCAN_REJECTED'::"IndividualKycProfileEventKind",
                          'ID_DOCUMENT_CLEANUP'::"IndividualKycProfileEventKind") IS DISTINCT FROM (NEW."relatedDocumentId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Document event must identify exactly one document' USING ERRCODE = '23514';
  END IF;

  IF NEW."relatedDocumentId" IS NOT NULL THEN
    SELECT "status", "scanStatus", "scannerVersion", "storageObjectVersionId", "scanCompletedAt", "scanSha256", "scanAttestationDigest", "scanJobTokenHash", "scanLeaseExpiresAt", "retentionExpiresAt"
      INTO related_document FROM "individual_kyc_documents"
      WHERE "id" = NEW."relatedDocumentId" AND "kycProfileId" = NEW."kycProfileId";
    IF NOT FOUND THEN RAISE EXCEPTION 'Individual KYC document audit reference is invalid' USING ERRCODE = '23503'; END IF;
    IF NEW."eventKind" = 'ID_DOCUMENT_UPLOAD_INTENT_CREATED'::"IndividualKycProfileEventKind" AND
       related_document."status" <> 'PENDING_UPLOAD'::"IndividualKycDocumentStatus" THEN
      RAISE EXCEPTION 'Upload-intent event requires pending document' USING ERRCODE = '23514';
    END IF;
    IF NEW."eventKind" = 'ID_DOCUMENT_SCAN_QUEUED'::"IndividualKycProfileEventKind" AND
       (related_document."status" <> 'PENDING_SCAN'::"IndividualKycDocumentStatus" OR related_document."scanStatus" <> 'PENDING'::"IndividualKycDocumentScanStatus" OR related_document."storageObjectVersionId" IS NULL OR related_document."scanJobTokenHash" IS NOT NULL) THEN
      RAISE EXCEPTION 'Scan-queued event requires a version-pinned pending object' USING ERRCODE = '23514';
    END IF;
    IF NEW."eventKind" = 'ID_DOCUMENT_SCAN_CLEAN'::"IndividualKycProfileEventKind" AND
       (related_document."status" <> 'UPLOADED'::"IndividualKycDocumentStatus" OR related_document."scanStatus" <> 'CLEAN'::"IndividualKycDocumentScanStatus" OR related_document."scannerVersion" IS NULL OR related_document."scanCompletedAt" IS NULL OR related_document."scanSha256" IS NULL OR related_document."scanAttestationDigest" IS NULL) THEN
      RAISE EXCEPTION 'Clean scan event requires verified scanner attestation' USING ERRCODE = '23514';
    END IF;
    IF NEW."eventKind" = 'ID_DOCUMENT_SCAN_REJECTED'::"IndividualKycProfileEventKind" AND
       (related_document."status" <> 'REMOVED'::"IndividualKycDocumentStatus" OR related_document."scanStatus" NOT IN ('REJECTED'::"IndividualKycDocumentScanStatus", 'FAILED'::"IndividualKycDocumentScanStatus") OR related_document."scanCompletedAt" IS NULL OR related_document."scanAttestationDigest" IS NULL) THEN
      RAISE EXCEPTION 'Rejected scan event requires a verified worker result' USING ERRCODE = '23514';
    END IF;
    IF NEW."eventKind" = 'ID_DOCUMENT_CLEANUP'::"IndividualKycProfileEventKind" AND
       related_document."status" <> 'REMOVED'::"IndividualKycDocumentStatus" THEN
      RAISE EXCEPTION 'Cleanup event requires a removed document' USING ERRCODE = '23514';
    END IF;
  END IF;

  IF NEW."eventKind" = 'SUBMITTED'::"IndividualKycProfileEventKind" THEN
    IF NEW."actorKind" <> 'APPLICANT'::"IndividualKycEventActorKind" OR current_status <> 'SUBMITTED'::"IndividualKycProfileStatus" THEN
      RAISE EXCEPTION 'Submission audit requires applicant and submitted profile state' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."actorKind" = 'APPLICANT'::"IndividualKycEventActorKind" THEN
    IF current_status <> 'DRAFT'::"IndividualKycProfileStatus" THEN RAISE EXCEPTION 'Applicant event requires draft profile state' USING ERRCODE = '42501'; END IF;
  ELSIF NEW."eventKind" IN ('ID_DOCUMENT_SCAN_CLEAN'::"IndividualKycProfileEventKind", 'ID_DOCUMENT_SCAN_REJECTED'::"IndividualKycProfileEventKind") THEN
    IF current_status <> 'DRAFT'::"IndividualKycProfileStatus" THEN RAISE EXCEPTION 'Scan result requires a draft profile' USING ERRCODE = '42501'; END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TABLE "individual_kyc_worker_request_nonces" (
  "id" UUID NOT NULL,
  "nonceHash" VARCHAR(64) NOT NULL,
  "workerId" VARCHAR(80) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "individual_kyc_worker_request_nonces_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "individual_kyc_worker_request_nonces_hash_check" CHECK ("nonceHash" ~ '^[0-9a-f]{64}$')
);
CREATE UNIQUE INDEX "individual_kyc_worker_request_nonces_nonceHash_key" ON "individual_kyc_worker_request_nonces"("nonceHash");
CREATE INDEX "individual_kyc_worker_request_nonces_expiresAt_idx" ON "individual_kyc_worker_request_nonces"("expiresAt");
