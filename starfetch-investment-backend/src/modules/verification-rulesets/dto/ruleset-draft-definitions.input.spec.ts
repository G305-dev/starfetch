import { BadRequestException } from '@nestjs/common';
import { VerificationSubjectTargetKind } from '@prisma/client';
import { canonicalizeRulesetDraftDefinitions } from './ruleset-draft-definitions.input';

describe('canonicalizeRulesetDraftDefinitions', () => {
  it('preserves policy-provided keys and condition JSON without interpreting policy', () => {
    expect(canonicalizeRulesetDraftDefinitions({
      requiredSubjects: [{
        subjectKey: 'synthetic-subject',
        targetKind: VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY,
        requiredChecks: [{
          checkKindKey: 'synthetic-check',
          acceptedEvidenceSourceKeys: ['synthetic-source'],
        }],
      }],
      conditionalDocumentRequirements: [{
        requirementKey: 'synthetic-requirement',
        documentKindKey: 'synthetic-document-kind',
        condition: { when: 'synthetic-test-only', nested: { enabled: true } },
        completeness: { minimumFiles: 1, testOnly: true },
      }],
    })).toEqual({
      requiredSubjects: [{
        subjectKey: 'synthetic-subject',
        targetKind: VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY,
        requiredChecks: [{
          checkKindKey: 'synthetic-check',
          acceptedEvidenceSourceKeys: ['synthetic-source'],
        }],
      }],
      conditionalDocumentRequirements: [{
        requirementKey: 'synthetic-requirement',
        documentKindKey: 'synthetic-document-kind',
        condition: { when: 'synthetic-test-only', nested: { enabled: true } },
        completeness: { minimumFiles: 1, testOnly: true },
      }],
    });
  });

  it('allows an empty DRAFT definition set; later publication/binding gates fail closed', () => {
    expect(canonicalizeRulesetDraftDefinitions({ requiredSubjects: [], conditionalDocumentRequirements: [] }))
      .toEqual({ requiredSubjects: [], conditionalDocumentRequirements: [] });
  });

  it('rejects runtime extra keys, malformed keys, duplicate definitions and non-object conditions', () => {
    expect(() => canonicalizeRulesetDraftDefinitions({
      requiredSubjects: [],
      conditionalDocumentRequirements: [],
      approved: true,
    } as any)).toThrow(BadRequestException);
    expect(() => canonicalizeRulesetDraftDefinitions({
      requiredSubjects: [
        { subjectKey: 'same', targetKind: VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY, requiredChecks: [] },
        { subjectKey: 'same', targetKind: VerificationSubjectTargetKind.CORPORATE_LEGAL_ENTITY, requiredChecks: [] },
      ],
      conditionalDocumentRequirements: [],
    })).toThrow(BadRequestException);
    expect(() => canonicalizeRulesetDraftDefinitions({
      requiredSubjects: [],
      conditionalDocumentRequirements: [{
        requirementKey: 'req',
        documentKindKey: 'doc-kind',
        condition: 'always',
      } as any],
    })).toThrow(BadRequestException);
  });
});
