import { Building2, FileText, Pencil, UsersRound } from "lucide-react";

export const corporateProfileTabs = [
  { id: "company-information", label: "Company Information" },
  { id: "contact-person", label: "Contact Person" },
  { id: "directors-signatories", label: "Directors & Signatories" },
  { id: "bank-details", label: "Bank Details" },
  { id: "regulatory-compliance", label: "Regulatory & Compliance" },
] as const;

export type CorporateProfileTabId = (typeof corporateProfileTabs)[number]["id"];

export type EditableCompanyInfo = {
  institutionName: string;
  registrationNumber: string;
  dateOfIncorporation: string;
  placeOfIncorporation: string;
  legalEntityType: string;
  businessSector: string;
  natureOfBusiness: string;
  taxIdentificationNumber: string;
  lei: string;
  website: string;
  annualTurnover: string;
};

export const initialCompanyInfo: EditableCompanyInfo = {
  institutionName: "Meridian Holdings Limited",
  registrationNumber: "RC 1234567",
  dateOfIncorporation: "15 March 2018",
  placeOfIncorporation: "Nigeria",
  legalEntityType: "Private Limited Company",
  businessSector: "Financial Services",
  natureOfBusiness: "Investment and Asset Management",
  taxIdentificationNumber: "12345678-0001",
  lei: "Not provided",
  website: "www.meridianholdings.com",
  annualTurnover: "₦1,200,000,000",
};

export type AddressInfo = {
  address: string;
  city: string;
  state: string;
  country: string;
};

export const initialRegisteredAddress: AddressInfo = {
  address: "123 Victoria Island Road, Lagos, Nigeria",
  city: "Lagos",
  state: "Lagos State",
  country: "Nigeria",
};

export const initialBusinessAddress: AddressInfo = {
  address: "Plot 45, Adeola Odeku Street, Victoria Island",
  city: "Lagos",
  state: "Lagos State",
  country: "Nigeria",
};

export type ContactPerson = {
  fullName: string;
  designation: string;
  email: string;
  phoneNumber: string;
};

export const initialContactPerson: ContactPerson = {
  fullName: "Adaeze Okafor",
  designation: "Chief Operating Officer",
  email: "adaeze.okafor@meridianholdings.com",
  phoneNumber: "+234 801 234 5678",
};

export type Signatory = {
  id: string;
  fullName: string;
  designation: string;
  email: string;
  phone: string;
  signatoryStatus: "Authorised" | "Primary";
  verificationStatus: "Verified" | "Pending Review";
};

export const initialSignatories: Signatory[] = [
  { id: "sig-1", fullName: "Adaeze Okafor", designation: "Chief Operating Officer", email: "adaeze.okafor@meridianholdings.com", phone: "+234 801 234 5678", signatoryStatus: "Primary", verificationStatus: "Verified" },
  { id: "sig-2", fullName: "Chinedu Adeyemi", designation: "Finance Director", email: "chinedu.adeyemi@meridianholdings.com", phone: "+234 802 987 6543", signatoryStatus: "Authorised", verificationStatus: "Verified" },
];

export const corporateBankDetails = {
  bankName: "Meridian Commercial Bank",
  accountNumber: "******4567",
  accountName: "Meridian Holdings Limited",
  accountType: "Corporate Current",
  linkedBvn: "*******109",
};

export const corporateComplianceStatus = [
  { label: "Corporate KYC Status", status: "Verified" },
  { label: "AML Screening", status: "Passed" },
  { label: "PEP Check", status: "Cleared" },
  { label: "Beneficial Ownership", status: "Completed" },
  { label: "Corporate Documents", status: "Completed" },
  { label: "Compliance Officer Approval", status: "Approved" },
] as const;

export const profileCompletion = [
  { label: "Company information", status: "Completed" },
  { label: "Contact person", status: "Completed" },
  { label: "Directors & signatories", status: "Completed" },
  { label: "Bank details", status: "Completed" },
  { label: "Regulatory & compliance", status: "Completed" },
] as const;

export const corporateProfileQuickActions = [
  { label: "Update company details", tab: "company-information" as const, icon: Pencil },
  { label: "Manage signatories", tab: "directors-signatories" as const, icon: UsersRound },
  { label: "View documents", href: "/corporate/dashboard#documents", icon: FileText },
] as const;

export const companyLogo = {
  name: "Meridian Holdings Limited",
  icon: Building2,
};
