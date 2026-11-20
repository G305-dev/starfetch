import { CorporateKycDocumentCategory, OnboardingApplicationStatus } from '@prisma/client';

/**
 * Authoritative Corporate KYC document catalogue (KYC section 5).
 * Exactly three approved categories, all mandatory. No other category is
 * accepted by the API, the DTOs or the database enum.
 */
export const CORPORATE_KYC_DOCUMENT_CATEGORIES = [
  CorporateKycDocumentCategory.CERTIFICATE_OF_INCORPORATION,
  CorporateKycDocumentCategory.MEMART,
  CorporateKycDocumentCategory.TIN_CERTIFICATE,
] as const;

export type CorporateKycAcceptedContentType = 'application/pdf' | 'image/jpeg' | 'image/png';

export const CORPORATE_KYC_ACCEPTED_CONTENT_TYPES: readonly CorporateKycAcceptedContentType[] = ['application/pdf', 'image/jpeg', 'image/png'];
export const CORPORATE_KYC_ACCEPTED_EXTENSIONS = ['.pdf', '.jpg', '.jpeg', '.png'] as const;

/**
 * 4 MiB. Uploads are proxied through the API (so the server can verify the
 * file signature, type and size before storage) and Vercel Functions reject
 * request bodies above 4.5 MB. 4 MiB leaves headroom for multipart overhead.
 */
export const CORPORATE_KYC_MAX_DOCUMENT_BYTES = 4 * 1024 * 1024;

/** Short-lived, version-pinned, attachment-only view authorization. */
export const CORPORATE_KYC_VIEW_TTL_SECONDS = 60;

/** Matches the existing Corporate profile editing rule. */
export const CORPORATE_KYC_DOCUMENT_EDITABLE_STATES: readonly OnboardingApplicationStatus[] = [
  OnboardingApplicationStatus.DRAFT,
  OnboardingApplicationStatus.INFO_REQUESTED,
];

export interface CorporateKycDocumentRequirementDefinition {
  readonly category: CorporateKycDocumentCategory;
  readonly title: string;
  readonly description: string;
  readonly mandatory: true;
  readonly displayFilenameStem: string;
}

export const CORPORATE_KYC_DOCUMENT_REQUIREMENTS: readonly CorporateKycDocumentRequirementDefinition[] = [
  {
    category: CorporateKycDocumentCategory.CERTIFICATE_OF_INCORPORATION,
    title: 'Certificate of Incorporation',
    description: 'The company\'s Certificate of Incorporation issued by the Corporate Affairs Commission (CAC).',
    mandatory: true,
    displayFilenameStem: 'certificate-of-incorporation',
  },
  {
    category: CorporateKycDocumentCategory.MEMART,
    title: 'Memorandum and Articles of Association (MEMART)',
    description: 'The company\'s registered Memorandum and Articles of Association.',
    mandatory: true,
    displayFilenameStem: 'memart',
  },
  {
    category: CorporateKycDocumentCategory.TIN_CERTIFICATE,
    title: 'TIN Certificate',
    description: 'The company\'s Tax Identification Number (TIN) certificate.',
    mandatory: true,
    displayFilenameStem: 'tin-certificate',
  },
];

export function isCorporateKycDocumentCategory(value: unknown): value is CorporateKycDocumentCategory {
  return typeof value === 'string' && (CORPORATE_KYC_DOCUMENT_CATEGORIES as readonly string[]).includes(value);
}

export function requirementFor(category: CorporateKycDocumentCategory): CorporateKycDocumentRequirementDefinition {
  const found = CORPORATE_KYC_DOCUMENT_REQUIREMENTS.find((r) => r.category === category);
  if (!found) throw new Error('Unknown Corporate KYC document category.');
  return found;
}

export function extensionFor(contentType: string): string {
  if (contentType === 'application/pdf') return 'pdf';
  if (contentType === 'image/jpeg') return 'jpg';
  return 'png';
}

/** Server-generated display name; the uploaded filename (possible PII) is never stored. */
export function displayFilename(category: CorporateKycDocumentCategory, version: number, contentType: string): string {
  return `${requirementFor(category).displayFilenameStem}-v${version}.${extensionFor(contentType)}`;
}
