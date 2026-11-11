-- Forward-only C1.4 document-category and completeness snapshots.
-- AlterTable
ALTER TABLE "application_verification_requirements" ADD COLUMN     "documentCompletenessSnapshot" JSONB,
ADD COLUMN     "documentKindKeySnapshot" VARCHAR(120);

-- AlterTable
ALTER TABLE "conditional_document_requirement_definitions" ADD COLUMN     "completeness" JSONB;



-- Opaque policy-authored completeness rules are preserved without interpreting
-- their vocabulary. Legacy null remains unresolved and is never auto-promoted.
ALTER TABLE "conditional_document_requirement_definitions"
  ADD CONSTRAINT "conditional_document_requirement_completeness_object_check"
  CHECK (
    "completeness" IS NULL OR
    (jsonb_typeof("completeness") = 'object' AND "completeness" <> '{}'::jsonb)
  );

CREATE FUNCTION "validate_document_requirement_snapshot_completeness"() RETURNS TRIGGER AS $$
DECLARE source_kind VARCHAR(120);
DECLARE source_completeness JSONB;
BEGIN
  IF NEW."requirementKind" = 'CONDITIONAL_DOCUMENT'::"ApplicationVerificationRequirementKind" THEN
    SELECT d."documentKindKey", d."completeness"
      INTO source_kind, source_completeness
      FROM "conditional_document_requirement_definitions" d
      WHERE d."id" = NEW."sourceDocumentRequirementDefinitionId"
        AND d."rulesetVersionId" = NEW."rulesetVersionId";
    IF source_kind IS NULL OR NEW."documentKindKeySnapshot" IS DISTINCT FROM source_kind
       OR NEW."documentCompletenessSnapshot" IS DISTINCT FROM source_completeness THEN
      RAISE EXCEPTION 'Tier 2 document category and completeness snapshot must match the exact ruleset definition' USING ERRCODE = '23514';
    END IF;
  ELSIF NEW."documentKindKeySnapshot" IS NOT NULL OR NEW."documentCompletenessSnapshot" IS NOT NULL THEN
    RAISE EXCEPTION 'Only Tier 2 document requirements may contain document completeness snapshots' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER "application_verification_document_completeness_guard_trigger"
  BEFORE INSERT ON "application_verification_requirements"
  FOR EACH ROW EXECUTE FUNCTION "validate_document_requirement_snapshot_completeness"();
