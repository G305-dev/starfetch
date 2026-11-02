import {
  BadgeCheck,
  Building2,
  FileBadge2,
  FileText,
  Landmark,
  ShieldCheck,
  type LucideIcon,
  UsersRound,
} from "lucide-react";

export type CorporateDocumentStatus =
  | "Required"
  | "Uploaded"
  | "Verified"
  | "Pending Review"
  | "Not Uploaded"
  | "Requested by Compliance";

export type DocumentCategoryId =
  | "company"
  | "authorisation"
  | "identity"
  | "investment"
  | "compliance";

export type CorporateDocumentRecord = {
  id: string;
  name: string;
  description: string;
  category: DocumentCategoryId;
  status: CorporateDocumentStatus;
  uploadedAt: string;
  required: boolean;
  applicable: boolean;
  fileType: "PDF" | "JPG" | "PNG" | "DOC";
};

export type CorporateDocumentCategory = {
  id: DocumentCategoryId;
  label: string;
  icon: LucideIcon;
};

export const corporateDocumentCategories: CorporateDocumentCategory[] = [
  { id: "company", label: "Company Documents", icon: FileText },
  { id: "authorisation", label: "Authorisation Documents", icon: UsersRound },
  { id: "identity", label: "Identity Documents", icon: FileBadge2 },
  { id: "investment", label: "Investment Documents", icon: Landmark },
  { id: "compliance", label: "Compliance / Source of Funds", icon: ShieldCheck },
];

/** Local-only mock records. Future backend document records, statuses and URLs replace this source. */
export const corporateDocumentsByCategory: Record<DocumentCategoryId, CorporateDocumentRecord[]> = {
  company: [
    { id: "company-incorporation", name: "Certificate of Incorporation", description: "CAC Certificate", category: "company", status: "Verified", uploadedAt: "12 Jan 2024", required: true, applicable: true, fileType: "PDF" },
    { id: "company-memorandum", name: "Memorandum & Articles of Association", description: "M&A", category: "company", status: "Verified", uploadedAt: "12 Jan 2024", required: true, applicable: true, fileType: "PDF" },
    { id: "company-cac", name: "CAC Status Report", description: "Directors and Shareholders", category: "company", status: "Verified", uploadedAt: "15 Jan 2024", required: true, applicable: true, fileType: "PDF" },
    { id: "company-tin", name: "Tax Identification Number (TIN) Certificate", description: "TIN Certificate", category: "company", status: "Verified", uploadedAt: "15 Jan 2024", required: true, applicable: true, fileType: "DOC" },
    { id: "company-address", name: "Proof of Business Address", description: "Utility Bill (not older than 3 months)", category: "company", status: "Pending Review", uploadedAt: "20 Jun 2024", required: true, applicable: true, fileType: "JPG" },
    { id: "company-scuml", name: "SCUML Registration Certificate", description: "If applicable to your institution type", category: "company", status: "Not Uploaded", uploadedAt: "—", required: true, applicable: false, fileType: "PDF" },
  ],
  authorisation: [
    { id: "authorisation-resolution", name: "Board Resolution", description: "Authorisation to open and operate this investment account", category: "authorisation", status: "Verified", uploadedAt: "16 Jan 2024", required: true, applicable: true, fileType: "PDF" },
    { id: "authorisation-signature-1", name: "Specimen Signature — Signatory 1", description: "Adaeze Okafor", category: "authorisation", status: "Verified", uploadedAt: "16 Jan 2024", required: true, applicable: true, fileType: "PNG" },
    { id: "authorisation-signature-2", name: "Specimen Signature — Signatory 2", description: "Chinedu Adeyemi", category: "authorisation", status: "Verified", uploadedAt: "16 Jan 2024", required: true, applicable: true, fileType: "PNG" },
    { id: "authorisation-seal", name: "Company Seal / Stamp", description: "Where required by your company constitution", category: "authorisation", status: "Not Uploaded", uploadedAt: "—", required: false, applicable: true, fileType: "PNG" },
  ],
  identity: [
    { id: "identity-director", name: "Director Identity Record", description: "Passport / National ID / Driver’s Licence / PVC", category: "identity", status: "Verified", uploadedAt: "17 Jan 2024", required: true, applicable: true, fileType: "PDF" },
    { id: "identity-signatory", name: "Authorised Signatory Identity Record", description: "Passport / National ID / Driver’s Licence / PVC", category: "identity", status: "Verified", uploadedAt: "17 Jan 2024", required: true, applicable: true, fileType: "PDF" },
    { id: "identity-bvn", name: "BVN Confirmation", description: "Verification confirmation for authorised signatories", category: "identity", status: "Verified", uploadedAt: "17 Jan 2024", required: true, applicable: true, fileType: "PDF" },
    { id: "identity-nin", name: "NIN Confirmation", description: "National Identification Number confirmation", category: "identity", status: "Pending Review", uploadedAt: "20 Jun 2024", required: true, applicable: true, fileType: "PDF" },
    { id: "identity-beneficial-owner", name: "Beneficial Owner Passport Photograph", description: "Recent colour passport photograph", category: "identity", status: "Not Uploaded", uploadedAt: "—", required: true, applicable: true, fileType: "JPG" },
  ],
  investment: [
    { id: "investment-policy", name: "Investment Policy Statement", description: "For discretionary mandate only", category: "investment", status: "Not Uploaded", uploadedAt: "—", required: false, applicable: true, fileType: "PDF" },
    { id: "investment-confirmation", name: "Investment Confirmation", description: "Confirmation for an approved investment", category: "investment", status: "Verified", uploadedAt: "03 May 2024", required: true, applicable: true, fileType: "PDF" },
    { id: "investment-mandate", name: "Mandate Confirmation", description: "Execution or discretionary mandate confirmation", category: "investment", status: "Verified", uploadedAt: "03 May 2024", required: true, applicable: true, fileType: "PDF" },
    { id: "investment-product", name: "Product-specific Documents", description: "Other documents for eligible approved products", category: "investment", status: "Required", uploadedAt: "—", required: false, applicable: true, fileType: "PDF" },
  ],
  compliance: [
    { id: "compliance-source-funds", name: "Evidence of Source of Funds", description: "Supporting evidence for corporate investment funds", category: "compliance", status: "Verified", uploadedAt: "18 Jan 2024", required: true, applicable: true, fileType: "PDF" },
    { id: "compliance-aml", name: "AML / KYC Supporting Documents", description: "Additional know-your-customer documentation", category: "compliance", status: "Verified", uploadedAt: "18 Jan 2024", required: true, applicable: true, fileType: "PDF" },
    { id: "compliance-pep", name: "PEP-related Supporting Documents", description: "Only if requested for relevant persons", category: "compliance", status: "Not Uploaded", uploadedAt: "—", required: false, applicable: true, fileType: "PDF" },
    { id: "compliance-additional", name: "Additional Compliance-request Documents", description: "Documents requested by Compliance when applicable", category: "compliance", status: "Requested by Compliance", uploadedAt: "—", required: false, applicable: true, fileType: "PDF" },
  ],
};

export const requiredCompanyDocuments = corporateDocumentsByCategory.company.filter((document) => document.required);

export const documentGuidelines = [
  "Use clear and legible documents",
  "Accepted formats: PDF, JPG, PNG",
  "Maximum file size: 10MB per file",
  "Ensure documents are up to date",
  "Documents must be certified where required",
] as const;

export const documentStatusFilters: Array<"All" | CorporateDocumentStatus> = ["All", "Verified", "Pending Review", "Not Uploaded", "Required"];

export const corporateDocumentVerification = {
  heading: "Account verification complete",
  detail: "All required corporate documents have been submitted and verified.",
  icon: BadgeCheck,
};

export const corporateDocumentCompany = {
  name: "Meridian Holdings",
  icon: Building2,
};
