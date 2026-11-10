import { BadRequestException } from '@nestjs/common';
import { Prisma, VerificationSubjectTargetKind } from '@prisma/client';

/** Data keys are supplied by an approved policy owner; C1.3 defines no categories. */
export interface RulesetDraftDefinitionsInput {
  requiredSubjects: Array<{
    subjectKey: string;
    targetKind: VerificationSubjectTargetKind;
    requiredChecks: Array<{
      checkKindKey: string;
      acceptedEvidenceSourceKeys: string[];
    }>;
  }>;
  conditionalDocumentRequirements: Array<{
    requirementKey: string;
    documentKindKey: string;
    condition: Record<string, unknown>;
    completeness: Record<string, unknown>;
  }>;
}

export interface CanonicalRulesetDraftDefinitions {
  requiredSubjects: Array<{
    subjectKey: string;
    targetKind: VerificationSubjectTargetKind;
    requiredChecks: Array<{
      checkKindKey: string;
      acceptedEvidenceSourceKeys: string[];
    }>;
  }>;
  conditionalDocumentRequirements: Array<{
    requirementKey: string;
    documentKindKey: string;
    condition: Prisma.InputJsonObject;
    completeness: Prisma.InputJsonObject;
  }>;
}

const TOP_LEVEL_KEYS = new Set(['requiredSubjects', 'conditionalDocumentRequirements']);
const SUBJECT_KEYS = new Set(['subjectKey', 'targetKind', 'requiredChecks']);
const CHECK_KEYS = new Set(['checkKindKey', 'acceptedEvidenceSourceKeys']);
const DOCUMENT_KEYS = new Set(['requirementKey', 'documentKindKey', 'condition', 'completeness']);
const SAFE_KEY = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,119}$/;

/** Strict structural validation only. It does not interpret policy conditions. */
export function canonicalizeRulesetDraftDefinitions(
  input: RulesetDraftDefinitionsInput,
): CanonicalRulesetDraftDefinitions {
  if (!isRecord(input)) throw new BadRequestException(['ruleset definitions must be an object']);
  const errors: string[] = [];
  rejectUnknownKeys(input, TOP_LEVEL_KEYS, 'definitions', errors);
  if (!Array.isArray(input.requiredSubjects)) errors.push('requiredSubjects must be an array');
  if (!Array.isArray(input.conditionalDocumentRequirements)) {
    errors.push('conditionalDocumentRequirements must be an array');
  }
  if (errors.length) throw new BadRequestException(errors);

  const requiredSubjects: CanonicalRulesetDraftDefinitions['requiredSubjects'] = [];
  const subjectSet = new Set<string>();
  for (const [subjectIndex, rawSubject] of input.requiredSubjects.entries()) {
    if (!isRecord(rawSubject)) {
      errors.push(`requiredSubjects[${subjectIndex}] must be an object`);
      continue;
    }
    rejectUnknownKeys(rawSubject, SUBJECT_KEYS, `requiredSubjects[${subjectIndex}]`, errors);
    const subjectKey = readKey(rawSubject.subjectKey, `requiredSubjects[${subjectIndex}].subjectKey`, errors);
    const targetKind = readTargetKind(rawSubject.targetKind, `requiredSubjects[${subjectIndex}].targetKind`, errors);
    if (!Array.isArray(rawSubject.requiredChecks)) {
      errors.push(`requiredSubjects[${subjectIndex}].requiredChecks must be an array`);
      continue;
    }
    if (subjectKey && subjectSet.has(subjectKey)) errors.push(`duplicate subjectKey '${subjectKey}'`);
    if (subjectKey) subjectSet.add(subjectKey);

    const checks: CanonicalRulesetDraftDefinitions['requiredSubjects'][number]['requiredChecks'] = [];
    const checkSet = new Set<string>();
    for (const [checkIndex, rawCheck] of rawSubject.requiredChecks.entries()) {
      if (!isRecord(rawCheck)) {
        errors.push(`requiredSubjects[${subjectIndex}].requiredChecks[${checkIndex}] must be an object`);
        continue;
      }
      rejectUnknownKeys(
        rawCheck,
        CHECK_KEYS,
        `requiredSubjects[${subjectIndex}].requiredChecks[${checkIndex}]`,
        errors,
      );
      const checkKindKey = readKey(
        rawCheck.checkKindKey,
        `requiredSubjects[${subjectIndex}].requiredChecks[${checkIndex}].checkKindKey`,
        errors,
      );
      if (!Array.isArray(rawCheck.acceptedEvidenceSourceKeys) ||
          rawCheck.acceptedEvidenceSourceKeys.some((source) => typeof source !== 'string')) {
        errors.push(`requiredSubjects[${subjectIndex}].requiredChecks[${checkIndex}].acceptedEvidenceSourceKeys must be an array of strings`);
        continue;
      }
      const acceptedEvidenceSourceKeys = rawCheck.acceptedEvidenceSourceKeys.map((source, sourceIndex) =>
        readKey(source, `requiredSubjects[${subjectIndex}].requiredChecks[${checkIndex}].acceptedEvidenceSourceKeys[${sourceIndex}]`, errors),
      ).filter((source): source is string => source !== null);
      if (checkKindKey && checkSet.has(checkKindKey)) {
        errors.push(`duplicate checkKindKey '${checkKindKey}' for subject '${subjectKey ?? ''}'`);
      }
      if (checkKindKey) checkSet.add(checkKindKey);
      if (new Set(acceptedEvidenceSourceKeys).size !== acceptedEvidenceSourceKeys.length) {
        errors.push(`duplicate accepted evidence-source key for check '${checkKindKey ?? ''}'`);
      }
      if (checkKindKey) checks.push({ checkKindKey, acceptedEvidenceSourceKeys });
    }
    if (subjectKey && targetKind) requiredSubjects.push({ subjectKey, targetKind, requiredChecks: checks });
  }

  const conditionalDocumentRequirements: CanonicalRulesetDraftDefinitions['conditionalDocumentRequirements'] = [];
  const requirementSet = new Set<string>();
  for (const [index, rawRequirement] of input.conditionalDocumentRequirements.entries()) {
    if (!isRecord(rawRequirement)) {
      errors.push(`conditionalDocumentRequirements[${index}] must be an object`);
      continue;
    }
    rejectUnknownKeys(rawRequirement, DOCUMENT_KEYS, `conditionalDocumentRequirements[${index}]`, errors);
    const requirementKey = readKey(rawRequirement.requirementKey, `conditionalDocumentRequirements[${index}].requirementKey`, errors);
    const documentKindKey = readKey(rawRequirement.documentKindKey, `conditionalDocumentRequirements[${index}].documentKindKey`, errors);
    const condition = canonicalJsonObject(rawRequirement.condition, `conditionalDocumentRequirements[${index}].condition`, errors);
    const completeness = canonicalJsonObject(rawRequirement.completeness, `conditionalDocumentRequirements[${index}].completeness`, errors);
    if (completeness && Object.keys(completeness).length === 0) {
      errors.push(`conditionalDocumentRequirements[${index}].completeness must declare at least one completeness rule`);
    }
    if (requirementKey && requirementSet.has(requirementKey)) errors.push(`duplicate requirementKey '${requirementKey}'`);
    if (requirementKey) requirementSet.add(requirementKey);
    if (requirementKey && documentKindKey && condition && completeness && Object.keys(completeness).length > 0) {
      conditionalDocumentRequirements.push({ requirementKey, documentKindKey, condition, completeness });
    }
  }

  if (errors.length) throw new BadRequestException(errors);
  return { requiredSubjects, conditionalDocumentRequirements };
}

function readTargetKind(value: unknown, field: string, errors: string[]): VerificationSubjectTargetKind | null {
  const allowed = Object.values(VerificationSubjectTargetKind) as string[];
  if (typeof value !== 'string' || !allowed.includes(value)) {
    errors.push(`${field} must be a supported verification subject target kind`);
    return null;
  }
  return value as VerificationSubjectTargetKind;
}

function readKey(value: unknown, field: string, errors: string[]): string | null {
  if (typeof value !== 'string' || !SAFE_KEY.test(value)) {
    errors.push(`${field} must be a non-empty stable key of at most 120 safe characters`);
    return null;
  }
  return value;
}

function canonicalJsonObject(
  value: unknown,
  field: string,
  errors: string[],
): Prisma.InputJsonObject | null {
  if (!isRecord(value)) {
    errors.push(`${field} must be a JSON object`);
    return null;
  }
  try {
    const encoded = JSON.stringify(value);
    if (!encoded) throw new Error('not serializable');
    return JSON.parse(encoded) as Prisma.InputJsonObject;
  } catch {
    errors.push(`${field} must contain valid JSON data`);
    return null;
  }
}

function rejectUnknownKeys(
  value: Record<string, unknown>,
  allowed: Set<string>,
  field: string,
  errors: string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) errors.push(`${field}.${key} is not allowed`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
