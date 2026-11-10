-- Corporate O4 foundation: append-only encrypted amendment history and
-- versioned immutable verification-snapshot generations for safe regeneration.

CREATE TABLE "corporate_details_revisions" (
  "id" UUID NOT NULL,
  "applicationId" UUID NOT NULL,
  "version" INTEGER NOT NULL,
  "changedByUserId" UUID NOT NULL,
  "changedFieldNames" TEXT[] NOT NULL,
  "beforeSnapshot" JSONB NOT NULL,
  "afterSnapshot" JSONB NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "corporate_details_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "corporate_details_revisions_version_check" CHECK ("version" > 1),
  CONSTRAINT "corporate_details_revisions_fields_check" CHECK (
    cardinality("changedFieldNames") > 0 AND
    "changedFieldNames" <@ ARRAY[
      'institutionName', 'dateOfIncorporation', 'rcNumber',
      'businessPhoneNumber', 'businessEmail', 'taxIdentificationNumber'
    ]::TEXT[]
  )
);
CREATE UNIQUE INDEX "corporate_details_revisions_applicationId_version_key"
  ON "corporate_details_revisions"("applicationId", "version");
CREATE INDEX "corporate_details_revisions_applicationId_createdAt_idx"
  ON "corporate_details_revisions"("applicationId", "createdAt");
ALTER TABLE "corporate_details_revisions"
  ADD CONSTRAINT "corporate_details_revisions_applicationId_fkey"
  FOREIGN KEY ("applicationId") REFERENCES "corporate_onboarding_details"("applicationId")
  ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "corporate_details_revisions"
  ADD CONSTRAINT "corporate_details_revisions_changedByUserId_fkey"
  FOREIGN KEY ("changedByUserId") REFERENCES "users"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE FUNCTION "validate_corporate_details_revision"() RETURNS TRIGGER AS $$
DECLARE canonical_version INTEGER;
BEGIN
  SELECT "version" INTO canonical_version FROM "corporate_onboarding_details"
    WHERE "applicationId" = NEW."applicationId";
  IF canonical_version IS DISTINCT FROM NEW."version" THEN
    RAISE EXCEPTION 'Corporate details revision must match the current canonical version' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "corporate_details_revisions_insert_guard_trigger"
  BEFORE INSERT ON "corporate_details_revisions"
  FOR EACH ROW EXECUTE FUNCTION "validate_corporate_details_revision"();
CREATE FUNCTION "reject_corporate_details_revision_mutation"() RETURNS TRIGGER AS $$
BEGIN
  RAISE EXCEPTION 'Corporate details amendment history is append-only' USING ERRCODE = '55000';
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "corporate_details_revisions_immutable_trigger"
  BEFORE UPDATE OR DELETE ON "corporate_details_revisions"
  FOR EACH ROW EXECUTE FUNCTION "reject_corporate_details_revision_mutation"();
CREATE TRIGGER "corporate_details_revisions_no_truncate_trigger"
  BEFORE TRUNCATE ON "corporate_details_revisions"
  FOR EACH STATEMENT EXECUTE FUNCTION "reject_protected_table_truncate"();

-- Existing snapshots remain immutable. Regeneration appends the next numbered
-- generation after the owning application row is locked and source versions re-read.
ALTER TABLE "application_verification_snapshots"
  ADD COLUMN "generation" INTEGER NOT NULL DEFAULT 1;
DROP INDEX "application_verification_snapshots_applicationId_key";
DROP INDEX "application_verification_snapshots_bindingId_key";
DROP INDEX "application_verification_snapshots_applicationId_accountKin_key";
DROP INDEX "application_verification_snapshots_bindingId_applicationId__key";
CREATE UNIQUE INDEX "application_verification_snapshots_applicationId_generation_key"
  ON "application_verification_snapshots"("applicationId", "generation");
CREATE UNIQUE INDEX "application_verification_snapshots_bindingId_generation_key"
  ON "application_verification_snapshots"("bindingId", "generation");
CREATE INDEX "application_verification_snapshots_applicationId_generation_idx"
  ON "application_verification_snapshots"("applicationId", "generation" DESC);

CREATE FUNCTION "validate_application_verification_snapshot_generation"() RETURNS TRIGGER AS $$
DECLARE current_generation INTEGER;
BEGIN
  PERFORM 1 FROM "onboarding_applications" WHERE "id" = NEW."applicationId" FOR UPDATE;
  SELECT COALESCE(MAX("generation"), 0) INTO current_generation
    FROM "application_verification_snapshots" WHERE "applicationId" = NEW."applicationId";
  IF NEW."generation" <> current_generation + 1 THEN
    RAISE EXCEPTION 'Verification snapshot generation must append the next generation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "application_verification_snapshot_generation_guard_trigger"
  BEFORE INSERT ON "application_verification_snapshots"
  FOR EACH ROW EXECUTE FUNCTION "validate_application_verification_snapshot_generation"();
