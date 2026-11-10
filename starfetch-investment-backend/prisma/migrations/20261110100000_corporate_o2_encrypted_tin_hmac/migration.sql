-- Forward-only Corporate O2 security foundation: encrypted TIN envelope,
-- versioned dedicated HMAC metadata, and versioned Joint membership context.
-- Existing details rows remain valid with an all-NULL TIN envelope.

-- Prisma-generated additive schema changes.
ALTER TABLE "application_verification_snapshots" ADD COLUMN "jointMembershipVersion" INTEGER;
ALTER TABLE "corporate_draft_creations" ADD COLUMN "payloadFingerprintKeyVersion" VARCHAR(32);
ALTER TABLE "corporate_draft_idempotency_keys" ADD COLUMN "idempotencyHmacVersion" VARCHAR(32);
ALTER TABLE "corporate_onboarding_details"
  ADD COLUMN "taxIdentificationNumberAuthTag" VARCHAR(32),
  ADD COLUMN "taxIdentificationNumberCiphertext" TEXT,
  ADD COLUMN "taxIdentificationNumberContextVersion" INTEGER,
  ADD COLUMN "taxIdentificationNumberEncryptedDataKey" TEXT,
  ADD COLUMN "taxIdentificationNumberIv" VARCHAR(32),
  ADD COLUMN "taxIdentificationNumberKeyId" TEXT,
  ADD COLUMN "taxIdentificationNumberKeyProvider" VARCHAR(32),
  ADD COLUMN "taxIdentificationNumberKeyVersion" VARCHAR(64);
ALTER TABLE "joint_accounts" ADD COLUMN "membershipVersion" INTEGER NOT NULL DEFAULT 1;

-- A TIN envelope is either entirely absent (legacy C1.1A row) or complete.
-- The database never has a plaintext taxIdentificationNumber column.
ALTER TABLE "corporate_onboarding_details"
  ADD CONSTRAINT "corporate_details_tin_envelope_complete_check"
  CHECK (
    (
      "taxIdentificationNumberCiphertext" IS NULL AND
      "taxIdentificationNumberIv" IS NULL AND
      "taxIdentificationNumberAuthTag" IS NULL AND
      "taxIdentificationNumberEncryptedDataKey" IS NULL AND
      "taxIdentificationNumberKeyProvider" IS NULL AND
      "taxIdentificationNumberKeyId" IS NULL AND
      "taxIdentificationNumberKeyVersion" IS NULL AND
      "taxIdentificationNumberContextVersion" IS NULL
    ) OR (
      "taxIdentificationNumberCiphertext" IS NOT NULL AND length("taxIdentificationNumberCiphertext") > 0 AND
      "taxIdentificationNumberIv" IS NOT NULL AND length("taxIdentificationNumberIv") > 0 AND
      "taxIdentificationNumberAuthTag" IS NOT NULL AND length("taxIdentificationNumberAuthTag") > 0 AND
      "taxIdentificationNumberEncryptedDataKey" IS NOT NULL AND length("taxIdentificationNumberEncryptedDataKey") > 0 AND
      "taxIdentificationNumberKeyProvider" IN ('AWS_KMS', 'TEST_AES_GCM') AND
      "taxIdentificationNumberKeyId" IS NOT NULL AND length("taxIdentificationNumberKeyId") > 0 AND
      "taxIdentificationNumberKeyVersion" IS NOT NULL AND length("taxIdentificationNumberKeyVersion") > 0 AND
      "taxIdentificationNumberContextVersion" = 1
    )
  );

ALTER TABLE "corporate_draft_creations"
  ADD CONSTRAINT "corporate_draft_o2_payload_hmac_version_check"
  CHECK (
    ("operation" = 'CORPORATE_DRAFT_BOOTSTRAP_O2_V1' AND "payloadFingerprintKeyVersion" IS NOT NULL) OR
    ("operation" <> 'CORPORATE_DRAFT_BOOTSTRAP_O2_V1' AND "payloadFingerprintKeyVersion" IS NULL)
  );
ALTER TABLE "corporate_draft_idempotency_keys"
  ADD CONSTRAINT "corporate_draft_o2_idempotency_hmac_version_check"
  CHECK (
    ("operation" = 'CORPORATE_DRAFT_BOOTSTRAP_O2_V1' AND "idempotencyHmacVersion" IS NOT NULL) OR
    ("operation" <> 'CORPORATE_DRAFT_BOOTSTRAP_O2_V1' AND "idempotencyHmacVersion" IS NULL)
  );

-- Monotonic source-context version: every inserted, deleted, or moved Joint
-- membership advances the owning account revision in the same transaction.
CREATE FUNCTION "bump_joint_account_membership_version"() RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE "joint_accounts" SET "membershipVersion" = "membershipVersion" + 1 WHERE "id" = NEW."jointAccountId";
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE "joint_accounts" SET "membershipVersion" = "membershipVersion" + 1 WHERE "id" = OLD."jointAccountId";
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD."jointAccountId" IS DISTINCT FROM NEW."jointAccountId" THEN
      UPDATE "joint_accounts" SET "membershipVersion" = "membershipVersion" + 1 WHERE "id" = OLD."jointAccountId";
      UPDATE "joint_accounts" SET "membershipVersion" = "membershipVersion" + 1 WHERE "id" = NEW."jointAccountId";
    ELSIF OLD."userId" IS DISTINCT FROM NEW."userId" THEN
      UPDATE "joint_accounts" SET "membershipVersion" = "membershipVersion" + 1 WHERE "id" = NEW."jointAccountId";
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "joint_account_membership_revision_trigger"
  AFTER INSERT OR UPDATE OR DELETE ON "joint_account_members"
  FOR EACH ROW EXECUTE FUNCTION "bump_joint_account_membership_version"();

-- Prevent callers from directly rewriting the revision counter. The nested
-- update from the membership trigger runs at trigger depth >= 2.
CREATE FUNCTION "reject_direct_joint_membership_version_change"() RETURNS TRIGGER AS $$
BEGIN
  IF NEW."membershipVersion" IS DISTINCT FROM OLD."membershipVersion" AND pg_trigger_depth() < 2 THEN
    RAISE EXCEPTION 'Joint membership version is database-maintained' USING ERRCODE = '55000';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "joint_account_membership_version_guard_trigger"
  BEFORE UPDATE OF "membershipVersion" ON "joint_accounts"
  FOR EACH ROW EXECUTE FUNCTION "reject_direct_joint_membership_version_change"();

-- TRUNCATE would bypass row triggers and leave the revision stale. The
-- isolated test cleanup helper disables only this guard after DB identity check.
CREATE TRIGGER "joint_account_members_no_truncate_trigger"
  BEFORE TRUNCATE ON "joint_account_members"
  FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();
