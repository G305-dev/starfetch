-- Additive repair for the Individual KYC upload-completion path.
-- Existing migration files are intentionally unchanged.

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

  -- Applicant completion is permitted only after the API has verified the
  -- signed object's exact checksum, size, content type, metadata, SSE and
  -- version with HEAD. The database enforces the resulting immutable, finite-
  -- retention manual-review state; this never signifies scan or KYC approval.
  IF OLD."status" = 'PENDING_UPLOAD'::"IndividualKycDocumentStatus" AND
     NEW."status" = 'UNDER_REVIEW'::"IndividualKycDocumentStatus" THEN
    IF OLD."manualReviewStatus" <> 'NOT_REVIEWED'::"ManualDocumentReviewStatus" OR
       NEW."manualReviewStatus" <> 'UNDER_REVIEW'::"ManualDocumentReviewStatus" OR
       OLD."scanStatus" <> 'PENDING'::"IndividualKycDocumentScanStatus" OR
       NEW."scanStatus" <> 'PENDING'::"IndividualKycDocumentScanStatus" OR
       OLD."scannerVersion" IS NOT NULL OR NEW."scannerVersion" IS NOT NULL OR
       OLD."scanRequestedAt" IS NOT NULL OR NEW."scanRequestedAt" IS NOT NULL OR
       OLD."scanClaimedAt" IS NOT NULL OR NEW."scanClaimedAt" IS NOT NULL OR
       OLD."scanLeaseExpiresAt" IS NOT NULL OR NEW."scanLeaseExpiresAt" IS NOT NULL OR
       OLD."scanWorkerId" IS NOT NULL OR NEW."scanWorkerId" IS NOT NULL OR
       OLD."scanJobTokenHash" IS NOT NULL OR NEW."scanJobTokenHash" IS NOT NULL OR
       OLD."scanCompletedAt" IS NOT NULL OR NEW."scanCompletedAt" IS NOT NULL OR
       OLD."scanSha256" IS NOT NULL OR NEW."scanSha256" IS NOT NULL OR
       OLD."scanAttestationDigest" IS NOT NULL OR NEW."scanAttestationDigest" IS NOT NULL OR
       NEW."scanAttemptCount" <> 0 OR OLD."scanAttemptCount" <> 0 THEN
      RAISE EXCEPTION 'Applicant upload completion cannot assert a scan or review decision' USING ERRCODE = '42501';
    END IF;
    IF OLD."storageObjectVersionId" IS NOT NULL OR NEW."storageObjectVersionId" IS NULL OR
       BTRIM(NEW."storageObjectVersionId") = '' OR LOWER(BTRIM(NEW."storageObjectVersionId")) = 'null' OR
       OLD."expectedChecksumSha256" IS NULL OR
       OLD."expectedChecksumSha256" !~ '^[A-Za-z0-9+/]{43}=$' OR
       NEW."expectedChecksumSha256" IS DISTINCT FROM OLD."expectedChecksumSha256" OR
       OLD."uploadedAt" IS NOT NULL OR NEW."uploadedAt" IS NULL OR
       NEW."uploadedAt" < OLD."createdAt" OR
       NEW."uploadedAt" > CURRENT_TIMESTAMP + INTERVAL '5 minutes' OR
       OLD."uploadExpiresAt" <= CURRENT_TIMESTAMP OR
       OLD."retentionExpiresAt" IS NOT NULL OR NEW."retentionExpiresAt" IS NULL OR
       NEW."retentionExpiresAt" <= NEW."uploadedAt" OR
       NEW."retentionExpiresAt" <= CURRENT_TIMESTAMP OR
       NEW."retentionExpiresAt" > NEW."uploadedAt" + INTERVAL '3650 days' OR
       OLD."objectDeletedAt" IS NOT NULL OR NEW."objectDeletedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'Applicant upload completion requires a verified version, timestamp, checksum and finite retention expiry' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
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
                               'ID_DOCUMENT_UPLOADED'::"IndividualKycProfileEventKind",
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

  IF (NEW."eventKind" IN ('SECTION_SAVED'::"IndividualKycProfileEventKind", 'ID_DOCUMENT_SCAN_QUEUED'::"IndividualKycProfileEventKind", 'ID_DOCUMENT_UPLOADED'::"IndividualKycProfileEventKind")) IS DISTINCT FROM (NEW."section" IS NOT NULL) THEN
    RAISE EXCEPTION 'Section event must identify exactly one section' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" = 'ID_DOCUMENT_UPLOADED'::"IndividualKycProfileEventKind" AND
     NEW."section" <> 'PERSONAL'::"IndividualKycSection" THEN
    RAISE EXCEPTION 'Uploaded ID document event must be associated with Personal KYC' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" IN ('ID_DOCUMENT_SCAN_QUEUED'::"IndividualKycProfileEventKind") AND NEW."section" <> 'PERSONAL'::"IndividualKycSection" THEN
    RAISE EXCEPTION 'Document scan job is associated with Personal KYC' USING ERRCODE = '23514';
  END IF;
  IF NEW."eventKind" IN ('ID_DOCUMENT_UPLOAD_INTENT_CREATED'::"IndividualKycProfileEventKind",
                          'ID_DOCUMENT_UPLOADED'::"IndividualKycProfileEventKind",
                          'ID_DOCUMENT_SCAN_QUEUED'::"IndividualKycProfileEventKind",
                          'ID_DOCUMENT_SCAN_CLEAN'::"IndividualKycProfileEventKind",
                          'ID_DOCUMENT_SCAN_REJECTED'::"IndividualKycProfileEventKind",
                          'ID_DOCUMENT_CLEANUP'::"IndividualKycProfileEventKind") IS DISTINCT FROM (NEW."relatedDocumentId" IS NOT NULL) THEN
    RAISE EXCEPTION 'Document event must identify exactly one document' USING ERRCODE = '23514';
  END IF;

  IF NEW."relatedDocumentId" IS NOT NULL THEN
    SELECT "investorUserId", "status", "manualReviewStatus", "scanStatus", "scannerVersion",
           "expectedChecksumSha256", "storageObjectVersionId", "uploadedAt", "uploadExpiresAt",
           "createdAt", "retentionExpiresAt", "objectDeletedAt", "scanRequestedAt", "scanClaimedAt",
           "scanCompletedAt", "scanSha256",
           "scanAttestationDigest", "scanJobTokenHash", "scanLeaseExpiresAt", "scanAttemptCount"
      INTO related_document FROM "individual_kyc_documents"
      WHERE "id" = NEW."relatedDocumentId" AND "kycProfileId" = NEW."kycProfileId";
    IF NOT FOUND THEN RAISE EXCEPTION 'Individual KYC document audit reference is invalid' USING ERRCODE = '23503'; END IF;
    IF NEW."eventKind" = 'ID_DOCUMENT_UPLOAD_INTENT_CREATED'::"IndividualKycProfileEventKind" AND
       related_document."status" <> 'PENDING_UPLOAD'::"IndividualKycDocumentStatus" THEN
      RAISE EXCEPTION 'Upload-intent event requires pending document' USING ERRCODE = '23514';
    END IF;
    IF NEW."eventKind" = 'ID_DOCUMENT_UPLOADED'::"IndividualKycProfileEventKind" AND
       (related_document."investorUserId" IS DISTINCT FROM profile_owner OR
        related_document."status" <> 'UNDER_REVIEW'::"IndividualKycDocumentStatus" OR
        related_document."manualReviewStatus" <> 'UNDER_REVIEW'::"ManualDocumentReviewStatus" OR
        related_document."scanStatus" <> 'PENDING'::"IndividualKycDocumentScanStatus" OR
        related_document."scannerVersion" IS NOT NULL OR
        related_document."expectedChecksumSha256" IS NULL OR
        related_document."expectedChecksumSha256" !~ '^[A-Za-z0-9+/]{43}=$' OR
        related_document."storageObjectVersionId" IS NULL OR
        BTRIM(related_document."storageObjectVersionId") = '' OR
        LOWER(BTRIM(related_document."storageObjectVersionId")) = 'null' OR
        related_document."uploadedAt" IS NULL OR
        related_document."uploadedAt" < related_document."createdAt" OR
        related_document."uploadedAt" > CURRENT_TIMESTAMP + INTERVAL '5 minutes' OR
        related_document."uploadExpiresAt" <= CURRENT_TIMESTAMP OR
        related_document."retentionExpiresAt" IS NULL OR
        related_document."retentionExpiresAt" <= related_document."uploadedAt" OR
        related_document."retentionExpiresAt" <= CURRENT_TIMESTAMP OR
        related_document."retentionExpiresAt" > related_document."uploadedAt" + INTERVAL '3650 days' OR
        related_document."objectDeletedAt" IS NOT NULL OR
        related_document."scanRequestedAt" IS NOT NULL OR
        related_document."scanClaimedAt" IS NOT NULL OR
        related_document."scanCompletedAt" IS NOT NULL OR
        related_document."scanSha256" IS NOT NULL OR
        related_document."scanAttestationDigest" IS NOT NULL OR
        related_document."scanJobTokenHash" IS NOT NULL OR
        related_document."scanLeaseExpiresAt" IS NOT NULL OR
        related_document."scanAttemptCount" <> 0) THEN
      RAISE EXCEPTION 'ID document upload event requires a verified manual-review object and no scan result' USING ERRCODE = '23514';
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
