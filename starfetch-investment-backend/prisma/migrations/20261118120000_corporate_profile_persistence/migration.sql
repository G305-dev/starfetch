-- Additive Corporate applicant identity, primary account classification and
-- four-section Corporate Profile persistence. Existing migrations are untouched.
CREATE TYPE "PrimaryAccountType" AS ENUM ('INDIVIDUAL', 'CORPORATE');
CREATE TYPE "CorporateProfileSectionStatus" AS ENUM ('NOT_STARTED', 'DRAFT', 'COMPLETE');

ALTER TABLE "users" ADD COLUMN "primaryAccountType" "PrimaryAccountType";

-- Operator-only, one-time audit record for reviewed legacy classification
-- recovery. No applicant API writes this table. Evidence remains in the
-- restricted support case; only its reference and verification method are stored.
CREATE TABLE "account_type_recovery_audits" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "assignedType" "PrimaryAccountType" NOT NULL,
  "supportCaseId" VARCHAR(120) NOT NULL,
  "verificationMethod" VARCHAR(64) NOT NULL,
  "evidenceReference" VARCHAR(255) NOT NULL,
  "requestedBy" VARCHAR(160) NOT NULL,
  "approvedBy" VARCHAR(160) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "appliedAt" TIMESTAMP(3),
  CONSTRAINT "account_type_recovery_audits_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "account_type_recovery_audits_userId_key" UNIQUE ("userId"),
  CONSTRAINT "account_type_recovery_audits_supportCaseId_key" UNIQUE ("supportCaseId"),
  CONSTRAINT "account_type_recovery_audits_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "account_type_recovery_audits_fields_nonempty" CHECK (
    length(btrim("supportCaseId")) > 0 AND
    length(btrim("verificationMethod")) > 0 AND
    length(btrim("evidenceReference")) > 0 AND
    length(btrim("requestedBy")) > 0 AND
    length(btrim("approvedBy")) > 0 AND
    "requestedBy" <> "approvedBy"
  )
);
REVOKE ALL ON TABLE "account_type_recovery_audits" FROM PUBLIC;

-- Backfill only when positive, unambiguous database evidence exists.
-- Corporate users with no O2 application (the prior registration flow did not
-- persist registrationType) remain NULL; a support-controlled recovery process
-- is documented separately. Any actual Joint membership also keeps a row
-- unclassified here, preserving its existing membership-based access path.
UPDATE "users" AS u
SET "primaryAccountType" = 'INDIVIDUAL'::"PrimaryAccountType"
WHERE u."role" = 'INVESTOR'::"UserRole"
  AND EXISTS (SELECT 1 FROM "investor_profiles" ip WHERE ip."userId" = u."id")
  AND NOT EXISTS (
    SELECT 1 FROM "onboarding_applications" oa
    WHERE oa."initiatingUserId" = u."id"
      AND oa."kind" = 'CORPORATE'::"OnboardingApplicationKind"
      AND oa."ownerCorporateAccountId" IS NOT NULL
  );

UPDATE "users" AS u
SET "primaryAccountType" = 'CORPORATE'::"PrimaryAccountType"
WHERE u."role" = 'INVESTOR'::"UserRole"
  AND NOT EXISTS (SELECT 1 FROM "investor_profiles" ip WHERE ip."userId" = u."id")
  AND EXISTS (
    SELECT 1 FROM "onboarding_applications" oa
    WHERE oa."initiatingUserId" = u."id"
      AND oa."kind" = 'CORPORATE'::"OnboardingApplicationKind"
      AND oa."ownerCorporateAccountId" IS NOT NULL
  )
  AND NOT EXISTS (
    SELECT 1 FROM "joint_account_members" jam WHERE jam."userId" = u."id"
  );

CREATE INDEX "users_primaryAccountType_idx" ON "users"("primaryAccountType");

CREATE OR REPLACE FUNCTION "guard_account_type_recovery_audit_mutation"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Account type recovery audit is append-only' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW."appliedAt" IS NOT NULL THEN
      RAISE EXCEPTION 'Recovery audit must be pending before classification' USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
  END IF;
  IF OLD."appliedAt" IS NOT NULL OR NEW."appliedAt" IS NULL OR
     NEW."id" IS DISTINCT FROM OLD."id" OR NEW."userId" IS DISTINCT FROM OLD."userId" OR
     NEW."assignedType" IS DISTINCT FROM OLD."assignedType" OR NEW."supportCaseId" IS DISTINCT FROM OLD."supportCaseId" OR
     NEW."verificationMethod" IS DISTINCT FROM OLD."verificationMethod" OR NEW."evidenceReference" IS DISTINCT FROM OLD."evidenceReference" OR
     NEW."requestedBy" IS DISTINCT FROM OLD."requestedBy" OR NEW."approvedBy" IS DISTINCT FROM OLD."approvedBy" OR
     NEW."createdAt" IS DISTINCT FROM OLD."createdAt" THEN
    RAISE EXCEPTION 'Only a pending recovery audit may be marked applied' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "account_type_recovery_audits_append_only"
BEFORE INSERT OR UPDATE OR DELETE ON "account_type_recovery_audits"
FOR EACH ROW EXECUTE FUNCTION "guard_account_type_recovery_audit_mutation"();

CREATE OR REPLACE FUNCTION "guard_primary_account_type_immutable"() RETURNS TRIGGER AS $$
DECLARE recovery_audit_id UUID;
BEGIN
  IF OLD."primaryAccountType" IS NOT NULL AND NEW."primaryAccountType" IS DISTINCT FROM OLD."primaryAccountType" THEN
    RAISE EXCEPTION 'Primary account type is immutable once assigned' USING ERRCODE = '42501';
  END IF;
  IF OLD."primaryAccountType" IS NULL AND NEW."primaryAccountType" IS NOT NULL THEN
    SELECT a."id" INTO recovery_audit_id
    FROM "account_type_recovery_audits" a
    WHERE a."userId" = OLD."id"
      AND a."assignedType" = NEW."primaryAccountType"
      AND a."appliedAt" IS NULL
    ORDER BY a."createdAt"
    LIMIT 1
    FOR UPDATE;
    IF recovery_audit_id IS NULL THEN
      RAISE EXCEPTION 'Legacy account type assignment requires a recovery audit' USING ERRCODE = '42501';
    END IF;
    UPDATE "account_type_recovery_audits"
      SET "appliedAt" = clock_timestamp()
      WHERE "id" = recovery_audit_id AND "appliedAt" IS NULL;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Recovery audit was already consumed' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "users_primary_account_type_immutable"
BEFORE UPDATE OF "primaryAccountType" ON "users"
FOR EACH ROW EXECUTE FUNCTION "guard_primary_account_type_immutable"();

CREATE TABLE "corporate_applicant_profiles" (
  "id" UUID NOT NULL,
  "userId" UUID NOT NULL,
  "companyName" VARCHAR(160) NOT NULL,
  "companyPhoneNumber" VARCHAR(32) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "corporate_applicant_profiles_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corporate_applicant_profiles_userId_key" UNIQUE ("userId"),
  CONSTRAINT "corporate_applicant_profiles_userId_fkey"
    FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "corporate_applicant_profiles_name_nonempty" CHECK (length(btrim("companyName")) BETWEEN 1 AND 160),
  CONSTRAINT "corporate_applicant_profiles_phone_nonempty" CHECK (length(btrim("companyPhoneNumber")) BETWEEN 7 AND 32)
);

CREATE OR REPLACE FUNCTION "guard_corporate_applicant_profile_kind"() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "users" u
    WHERE u."id" = NEW."userId" AND u."role" = 'INVESTOR'::"UserRole"
      AND u."primaryAccountType" = 'CORPORATE'::"PrimaryAccountType"
  ) THEN
    RAISE EXCEPTION 'Corporate applicant profile requires a Corporate INVESTOR identity' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "corporate_applicant_profiles_kind_guard"
BEFORE INSERT OR UPDATE ON "corporate_applicant_profiles"
FOR EACH ROW EXECUTE FUNCTION "guard_corporate_applicant_profile_kind"();

CREATE TABLE "corporate_profiles" (
  "applicationId" UUID NOT NULL,
  "profileVersion" INTEGER NOT NULL DEFAULT 0,
  "companyDetailsDetailsVersion" INTEGER,
  "companyDetailsStatus" "CorporateProfileSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "investmentProfileStatus" "CorporateProfileSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "sourceOfFundsStatus" "CorporateProfileSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "bankDetailsStatus" "CorporateProfileSectionStatus" NOT NULL DEFAULT 'NOT_STARTED',
  "registeredAddress" VARCHAR(255),
  "city" VARCHAR(120),
  "state" VARCHAR(120),
  "primaryObjective" VARCHAR(40),
  "riskTolerance" VARCHAR(40),
  "investmentHorizon" VARCHAR(40),
  "expectedWithdrawals" VARCHAR(120),
  "expectedWithdrawalsMinor" BIGINT,
  "withdrawalFrequency" VARCHAR(120),
  "restrictionsOrExclusions" VARCHAR(500),
  "selectedSources" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  "otherSource" VARCHAR(500),
  "expectedAnnualInflowMinor" BIGINT,
  "expectedTransactionFrequency" VARCHAR(120),
  "bankName" VARCHAR(120),
  "accountName" VARCHAR(160),
  "accountType" VARCHAR(80),
  "bvnLinkedToAccount" BOOLEAN,
  "bankAccountNumberCiphertext" TEXT,
  "bankAccountNumberIv" VARCHAR(32),
  "bankAccountNumberAuthTag" VARCHAR(32),
  "bankAccountNumberEncryptedDataKey" TEXT,
  "bankAccountNumberKeyProvider" VARCHAR(32),
  "bankAccountNumberKeyId" TEXT,
  "bankAccountNumberKeyVersion" VARCHAR(64),
  "bankAccountNumberContextVersion" INTEGER,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "corporate_profiles_pkey" PRIMARY KEY ("applicationId"),
  CONSTRAINT "corporate_profiles_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "onboarding_applications"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corporate_profiles_version_nonnegative" CHECK ("profileVersion" >= 0),
  CONSTRAINT "corporate_profiles_withdrawals_nonnegative" CHECK ("expectedWithdrawalsMinor" IS NULL OR "expectedWithdrawalsMinor" >= 0),
  CONSTRAINT "corporate_profiles_annual_inflow_nonnegative" CHECK ("expectedAnnualInflowMinor" IS NULL OR "expectedAnnualInflowMinor" >= 0),
  CONSTRAINT "corporate_profiles_bank_envelope_complete" CHECK (
    ("bankAccountNumberCiphertext" IS NULL AND "bankAccountNumberIv" IS NULL AND "bankAccountNumberAuthTag" IS NULL AND "bankAccountNumberEncryptedDataKey" IS NULL AND "bankAccountNumberKeyProvider" IS NULL AND "bankAccountNumberKeyId" IS NULL AND "bankAccountNumberKeyVersion" IS NULL AND "bankAccountNumberContextVersion" IS NULL)
    OR
    ("bankAccountNumberCiphertext" IS NOT NULL AND "bankAccountNumberIv" IS NOT NULL AND "bankAccountNumberAuthTag" IS NOT NULL AND "bankAccountNumberEncryptedDataKey" IS NOT NULL AND "bankAccountNumberKeyProvider" = 'AWS_KMS' AND "bankAccountNumberKeyId" IS NOT NULL AND "bankAccountNumberKeyVersion" IS NOT NULL AND "bankAccountNumberContextVersion" = 1)
  )
);

CREATE OR REPLACE FUNCTION "guard_corporate_profile_parent"() RETURNS TRIGGER AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "onboarding_applications" oa
    WHERE oa."id" = NEW."applicationId"
      AND oa."kind" = 'CORPORATE'::"OnboardingApplicationKind"
      AND oa."ownerCorporateAccountId" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Corporate Profile requires an existing Corporate-owned application' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "corporate_profiles_parent_guard"
BEFORE INSERT OR UPDATE ON "corporate_profiles"
FOR EACH ROW EXECUTE FUNCTION "guard_corporate_profile_parent"();

CREATE TABLE "corporate_profile_revisions" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "profileVersion" INTEGER NOT NULL,
  "section" VARCHAR(40) NOT NULL,
  "changedByUserId" UUID NOT NULL,
  "changedFieldNames" TEXT[] NOT NULL,
  "safeSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "corporate_profile_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corporate_profile_revisions_applicationId_profileVersion_key" UNIQUE ("applicationId", "profileVersion"),
  CONSTRAINT "corporate_profile_revisions_applicationId_fkey"
    FOREIGN KEY ("applicationId") REFERENCES "corporate_profiles"("applicationId") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "corporate_profile_revisions_changedByUserId_fkey"
    FOREIGN KEY ("changedByUserId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "corporate_profile_revisions_applicationId_createdAt_idx" ON "corporate_profile_revisions"("applicationId", "createdAt");

-- Keep audit history append-only at the database boundary as well as in services.
CREATE OR REPLACE FUNCTION "reject_corporate_profile_revision_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Corporate Profile revision rows are append-only' USING ERRCODE = '42501';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "corporate_profile_revisions_append_only"
BEFORE UPDATE OR DELETE ON "corporate_profile_revisions"
FOR EACH ROW EXECUTE FUNCTION "reject_corporate_profile_revision_mutation"();
