-- Phase C1.1A safe Corporate DRAFT foundation.
-- TIN is intentionally not persisted or represented in this migration.
-- Existing Individual/Joint tables and rows are not altered.

CREATE TYPE "OnboardingApplicationKind" AS ENUM ('INDIVIDUAL', 'CORPORATE', 'JOINT');
CREATE TYPE "OnboardingApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'INFO_REQUESTED', 'APPROVED', 'REJECTED');
CREATE TYPE "OnboardingApplicationHistoryEvent" AS ENUM ('CREATED');

CREATE TABLE "corporate_accounts" (
    "id" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "corporate_accounts_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "onboarding_applications" (
    "id" UUID NOT NULL,
    "kind" "OnboardingApplicationKind" NOT NULL,
    "ownerUserId" UUID,
    "ownerCorporateAccountId" UUID,
    "ownerJointAccountId" UUID,
    "initiatingUserId" UUID NOT NULL,
    "submittedByUserId" UUID,
    "status" "OnboardingApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "onboarding_applications_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "onboarding_applications_exactly_one_owner_check" CHECK (
      ("kind" = 'INDIVIDUAL' AND "ownerUserId" IS NOT NULL AND "ownerCorporateAccountId" IS NULL AND "ownerJointAccountId" IS NULL) OR
      ("kind" = 'CORPORATE' AND "ownerUserId" IS NULL AND "ownerCorporateAccountId" IS NOT NULL AND "ownerJointAccountId" IS NULL) OR
      ("kind" = 'JOINT' AND "ownerUserId" IS NULL AND "ownerCorporateAccountId" IS NULL AND "ownerJointAccountId" IS NOT NULL)
    ),
    CONSTRAINT "onboarding_applications_submit_attribution_pair_check" CHECK (
      ("submittedByUserId" IS NULL) = ("submittedAt" IS NULL)
    ),
    CONSTRAINT "onboarding_applications_draft_submitter_null_check" CHECK (
      "status" <> 'DRAFT' OR ("submittedByUserId" IS NULL AND "submittedAt" IS NULL)
    ),
    CONSTRAINT "onboarding_applications_non_draft_submitter_required_check" CHECK (
      "status" = 'DRAFT' OR ("submittedByUserId" IS NOT NULL AND "submittedAt" IS NOT NULL)
    )
);

CREATE TABLE "corporate_onboarding_details" (
    "applicationId" UUID NOT NULL,
    "institutionName" TEXT NOT NULL,
    "dateOfIncorporation" DATE NOT NULL,
    "rcNumber" TEXT NOT NULL,
    "businessPhoneNumber" TEXT NOT NULL,
    "businessEmail" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "corporate_onboarding_details_pkey" PRIMARY KEY ("applicationId"),
    CONSTRAINT "corporate_onboarding_details_version_positive_check" CHECK ("version" >= 1),
    CONSTRAINT "corporate_onboarding_details_institution_name_nonempty_check" CHECK (length(btrim("institutionName")) > 0),
    CONSTRAINT "corporate_onboarding_details_rc_nonempty_check" CHECK (length(btrim("rcNumber")) > 0),
    CONSTRAINT "corporate_onboarding_details_phone_nonempty_check" CHECK (length(btrim("businessPhoneNumber")) > 0),
    CONSTRAINT "corporate_onboarding_details_email_nonempty_check" CHECK (length(btrim("businessEmail")) > 0)
);

CREATE TABLE "onboarding_application_history" (
    "id" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "event" "OnboardingApplicationHistoryEvent" NOT NULL,
    "fromStatus" "OnboardingApplicationStatus",
    "toStatus" "OnboardingApplicationStatus" NOT NULL,
    "actorUserId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "onboarding_application_history_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "onboarding_application_history_creation_shape_check" CHECK (
      "event" <> 'CREATED' OR ("fromStatus" IS NULL AND "toStatus" = 'DRAFT')
    )
);

CREATE TABLE "corporate_draft_creations" (
    "id" UUID NOT NULL,
    "initiatingUserId" UUID NOT NULL,
    "operation" VARCHAR(64) NOT NULL,
    "payloadFingerprintHmac" CHAR(64) NOT NULL,
    "corporateAccountId" UUID NOT NULL,
    "applicationId" UUID NOT NULL,
    "receipt" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "corporate_draft_creations_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "corporate_draft_creations_applicationId_key" UNIQUE ("applicationId"),
    CONSTRAINT "corporate_draft_creations_initiator_operation_payload_key" UNIQUE ("initiatingUserId", "operation", "payloadFingerprintHmac")
);

CREATE TABLE "corporate_draft_idempotency_keys" (
    "id" UUID NOT NULL,
    "initiatingUserId" UUID NOT NULL,
    "operation" VARCHAR(64) NOT NULL,
    "idempotencyKeyDigest" CHAR(64) NOT NULL,
    "creationId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "corporate_draft_idempotency_keys_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "corporate_draft_idempotency_keys_initiator_operation_key_key" UNIQUE ("initiatingUserId", "operation", "idempotencyKeyDigest")
);

CREATE INDEX "onboarding_applications_initiatingUserId_status_idx" ON "onboarding_applications"("initiatingUserId", "status");
CREATE INDEX "onboarding_applications_ownerUserId_status_idx" ON "onboarding_applications"("ownerUserId", "status");
CREATE INDEX "onboarding_applications_ownerCorporateAccountId_status_idx" ON "onboarding_applications"("ownerCorporateAccountId", "status");
CREATE INDEX "onboarding_applications_ownerJointAccountId_status_idx" ON "onboarding_applications"("ownerJointAccountId", "status");
CREATE INDEX "onboarding_application_history_applicationId_createdAt_idx" ON "onboarding_application_history"("applicationId", "createdAt");
CREATE INDEX "corporate_draft_creations_corporateAccountId_idx" ON "corporate_draft_creations"("corporateAccountId");
CREATE INDEX "corporate_draft_idempotency_keys_creationId_idx" ON "corporate_draft_idempotency_keys"("creationId");

-- D-09: one active application per account context. Prisma cannot declare
-- partial indexes; these include every D-08 active state and leave terminal
-- APPROVED/REJECTED applications outside the active uniqueness key.
CREATE UNIQUE INDEX "onboarding_applications_one_active_individual_per_owner_key"
  ON "onboarding_applications" ("ownerUserId")
  WHERE "ownerUserId" IS NOT NULL AND "status" IN ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'INFO_REQUESTED');
CREATE UNIQUE INDEX "onboarding_applications_one_active_corporate_per_account_key"
  ON "onboarding_applications" ("ownerCorporateAccountId")
  WHERE "ownerCorporateAccountId" IS NOT NULL AND "status" IN ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'INFO_REQUESTED');
CREATE UNIQUE INDEX "onboarding_applications_one_active_joint_per_account_key"
  ON "onboarding_applications" ("ownerJointAccountId")
  WHERE "ownerJointAccountId" IS NOT NULL AND "status" IN ('DRAFT', 'SUBMITTED', 'IN_REVIEW', 'INFO_REQUESTED');

ALTER TABLE "onboarding_applications"
  ADD CONSTRAINT "onboarding_applications_ownerUserId_fkey"
    FOREIGN KEY ("ownerUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "onboarding_applications_ownerCorporateAccountId_fkey"
    FOREIGN KEY ("ownerCorporateAccountId") REFERENCES "corporate_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "onboarding_applications_ownerJointAccountId_fkey"
    FOREIGN KEY ("ownerJointAccountId") REFERENCES "joint_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "onboarding_applications_initiatingUserId_fkey"
    FOREIGN KEY ("initiatingUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "onboarding_applications_submittedByUserId_fkey"
    FOREIGN KEY ("submittedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "corporate_onboarding_details"
  ADD CONSTRAINT "corporate_onboarding_details_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "onboarding_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "onboarding_application_history"
  ADD CONSTRAINT "onboarding_application_history_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "onboarding_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "onboarding_application_history_actorUserId_fkey"
    FOREIGN KEY ("actorUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "corporate_draft_creations"
  ADD CONSTRAINT "corporate_draft_creations_initiatingUserId_fkey"
    FOREIGN KEY ("initiatingUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "corporate_draft_creations_corporateAccountId_fkey"
    FOREIGN KEY ("corporateAccountId") REFERENCES "corporate_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "corporate_draft_creations_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "onboarding_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "corporate_draft_idempotency_keys"
  ADD CONSTRAINT "corporate_draft_idempotency_keys_initiatingUserId_fkey"
    FOREIGN KEY ("initiatingUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "corporate_draft_idempotency_keys_creationId_fkey"
    FOREIGN KEY ("creationId") REFERENCES "corporate_draft_creations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Persisted initiating-user and account context are immutable. Application
-- status remains mutable for later authorized transition services.
CREATE FUNCTION "enforce_onboarding_application_identity_immutable"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."kind" IS DISTINCT FROM OLD."kind"
     OR NEW."ownerUserId" IS DISTINCT FROM OLD."ownerUserId"
     OR NEW."ownerCorporateAccountId" IS DISTINCT FROM OLD."ownerCorporateAccountId"
     OR NEW."ownerJointAccountId" IS DISTINCT FROM OLD."ownerJointAccountId"
     OR NEW."initiatingUserId" IS DISTINCT FROM OLD."initiatingUserId" THEN
    RAISE EXCEPTION 'Onboarding application identity/owner is immutable' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "onboarding_applications_identity_immutable_trigger"
  BEFORE UPDATE ON "onboarding_applications"
  FOR EACH ROW EXECUTE FUNCTION "enforce_onboarding_application_identity_immutable"();

-- Corporate details may be inserted only for Corporate applications; every
-- committed Corporate application must retain exactly one canonical details row.
CREATE FUNCTION "enforce_corporate_details_application_kind"() RETURNS TRIGGER AS $$
DECLARE app_kind "OnboardingApplicationKind";
BEGIN
  SELECT "kind" INTO app_kind FROM "onboarding_applications" WHERE "id" = NEW."applicationId";
  IF app_kind IS DISTINCT FROM 'CORPORATE'::"OnboardingApplicationKind" THEN
    RAISE EXCEPTION 'Corporate details require a Corporate application' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "corporate_onboarding_details_kind_trigger"
  BEFORE INSERT OR UPDATE ON "corporate_onboarding_details"
  FOR EACH ROW EXECUTE FUNCTION "enforce_corporate_details_application_kind"();

CREATE FUNCTION "ensure_corporate_application_has_details"() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM "onboarding_applications" a
    WHERE a."id" = NEW."id" AND a."kind" = 'CORPORATE'::"OnboardingApplicationKind"
  ) AND NOT EXISTS (
    SELECT 1 FROM "corporate_onboarding_details" d WHERE d."applicationId" = NEW."id"
  ) THEN
    RAISE EXCEPTION 'Corporate application requires one canonical details row' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "onboarding_applications_corporate_details_required_trigger"
  AFTER INSERT ON "onboarding_applications"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "ensure_corporate_application_has_details"();

CREATE FUNCTION "ensure_corporate_details_not_orphaned"() RETURNS TRIGGER AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM "onboarding_applications" a WHERE a."id" = OLD."applicationId")
     AND NOT EXISTS (SELECT 1 FROM "corporate_onboarding_details" d WHERE d."applicationId" = OLD."applicationId") THEN
    RAISE EXCEPTION 'Corporate application must retain its canonical details row' USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER "corporate_onboarding_details_required_after_delete_trigger"
  AFTER DELETE ON "corporate_onboarding_details"
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION "ensure_corporate_details_not_orphaned"();

-- History creation is tied to the immutable initiating user. Future lifecycle
-- transitions add approved event vocabulary and separate transition services.
CREATE FUNCTION "validate_onboarding_application_creation_history"() RETURNS TRIGGER AS $$
DECLARE app_initiator UUID;
BEGIN
  SELECT "initiatingUserId" INTO app_initiator FROM "onboarding_applications" WHERE "id" = NEW."applicationId";
  IF NEW."event" = 'CREATED'::"OnboardingApplicationHistoryEvent"
     AND (NEW."fromStatus" IS NOT NULL OR NEW."toStatus" <> 'DRAFT'::"OnboardingApplicationStatus" OR NEW."actorUserId" <> app_initiator) THEN
    RAISE EXCEPTION 'Creation history must be attributed to the DRAFT initiator' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "onboarding_application_history_creation_guard_trigger"
  BEFORE INSERT ON "onboarding_application_history"
  FOR EACH ROW EXECUTE FUNCTION "validate_onboarding_application_creation_history"();

-- Idempotency rows must reference the same authenticated initiator, operation,
-- Corporate account and application as their immutable creation receipt.
CREATE FUNCTION "validate_corporate_draft_creation_context"() RETURNS TRIGGER AS $$
DECLARE app_kind "OnboardingApplicationKind";
DECLARE app_owner UUID;
DECLARE app_initiator UUID;
BEGIN
  SELECT "kind", "ownerCorporateAccountId", "initiatingUserId"
    INTO app_kind, app_owner, app_initiator
    FROM "onboarding_applications" WHERE "id" = NEW."applicationId";
  IF app_kind IS DISTINCT FROM 'CORPORATE'::"OnboardingApplicationKind"
     OR app_owner IS DISTINCT FROM NEW."corporateAccountId"
     OR app_initiator IS DISTINCT FROM NEW."initiatingUserId" THEN
    RAISE EXCEPTION 'Corporate draft receipt context does not match its application' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "corporate_draft_creations_context_trigger"
  BEFORE INSERT OR UPDATE ON "corporate_draft_creations"
  FOR EACH ROW EXECUTE FUNCTION "validate_corporate_draft_creation_context"();

CREATE FUNCTION "validate_corporate_draft_idempotency_context"() RETURNS TRIGGER AS $$
DECLARE creation_user UUID;
DECLARE creation_operation VARCHAR(64);
BEGIN
  SELECT "initiatingUserId", "operation" INTO creation_user, creation_operation
    FROM "corporate_draft_creations" WHERE "id" = NEW."creationId";
  IF creation_user IS DISTINCT FROM NEW."initiatingUserId"
     OR creation_operation IS DISTINCT FROM NEW."operation" THEN
    RAISE EXCEPTION 'Idempotency key scope does not match its creation receipt' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "corporate_draft_idempotency_context_trigger"
  BEFORE INSERT OR UPDATE ON "corporate_draft_idempotency_keys"
  FOR EACH ROW EXECUTE FUNCTION "validate_corporate_draft_idempotency_context"();
