import {
  corporateApplicationStates,
  corporateEditableFieldNames,
  corporateSnapshotIssueCodes,
  type CorporateApplicationDiscoveryItem,
  type CorporateApplicationHistory,
  type CorporateApplicationReceipt,
  type CorporateApplicationState,
  type CorporateDetailsAmendment,
  type CorporateDraftInput,
  type CorporateDraftPatch,
  type CorporateDraftUpdateResult,
  type CorporateOnboardingRecord,
  type CorporateSnapshotFreshness,
} from "../corporate/application";
import {
  corporateProfileIfMatch,
  corporateProfileSectionKeys,
  type CorporateApplicantIdentityInput,
  type CorporateProfileBankDetailsInput,
  type CorporateProfileCompanyDetailsInput,
  type CorporateProfileInvestmentInput,
  type CorporateProfileSectionKey,
  type CorporateProfileSectionStatus,
  type CorporateProfileSourceOfFundsInput,
  type CorporateProfileView,
} from "../corporate/profile";

export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_VERIFIED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "GONE"
  | "RATE_LIMITED"
  | "FEATURE_UNAVAILABLE"
  | "SERVICE_UNAVAILABLE"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE";

type JsonRecord = Record<string, unknown>;

type ApiErrorMetadata = {
  verificationId?: string;
  maskedEmail?: string;
  retryAfterSeconds?: number;
  /** HTTP status of the failed response, when one was received. */
  status?: number;
  /** Safe backend error code exactly as returned (e.g. CSRF_VALIDATION_FAILED). */
  serverCode?: string;
  /** Backend correlation ID (error.requestId or x-request-id) for support triage. */
  requestId?: string;
  /** Names of fields the backend rejected. Backend messages are not echoed to users. */
  fieldNames?: string[];
};

const safeMessages: Record<ApiErrorCode, string> = {
  VALIDATION_FAILED: "Please review the highlighted information and try again.",
  INVALID_CREDENTIALS: "The email address or password you entered is incorrect.",
  EMAIL_NOT_VERIFIED: "Please verify your email address before signing in.",
  UNAUTHENTICATED: "Your session has ended. Please sign in again.",
  FORBIDDEN: "You do not have permission to perform this action.",
  NOT_FOUND: "This item is not available to your account.",
  CONFLICT: "An account with these details already exists.",
  GONE: "This invitation is no longer available.",
  RATE_LIMITED: "Too many requests were made. Please wait a moment and try again.",
  FEATURE_UNAVAILABLE: "Corporate registration is currently unavailable.",
  SERVICE_UNAVAILABLE: "Corporate registration is temporarily unavailable. Please try again later.",
  NETWORK_ERROR: "We could not reach Starfetch securely. Please check your connection and try again.",
  UNEXPECTED_RESPONSE: "We could not complete your request. Please try again.",
};

/**
 * Deliberately module-scoped, in-memory access-token storage. It is never
 * written to localStorage, sessionStorage, or a frontend-controlled cookie.
 */
let inMemoryAccessToken: string | null = null;
let authGeneration = 0;
let refreshInFlight: Promise<string> | null = null;
let sessionExpiredListener: (() => void) | null = null;

export function setAccessToken(accessToken: string) {
  authGeneration += 1;
  inMemoryAccessToken = accessToken;
}

export function clearAccessToken() {
  authGeneration += 1;
  inMemoryAccessToken = null;
}

export function hasAccessToken() {
  return Boolean(inMemoryAccessToken);
}

/** Lets the provider react to an unrecoverable, authenticated API failure. */
export function setSessionExpiredListener(listener: (() => void) | null) {
  sessionExpiredListener = listener;
  return () => {
    if (sessionExpiredListener === listener) sessionExpiredListener = null;
  };
}

function notifySessionExpired() {
  sessionExpiredListener?.();
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly verificationId?: string;
  readonly maskedEmail?: string;
  readonly retryAfterSeconds?: number;
  readonly status?: number;
  readonly serverCode?: string;
  readonly requestId?: string;
  readonly fieldNames?: string[];

  constructor(code: ApiErrorCode, metadata: ApiErrorMetadata = {}) {
    super(safeMessages[code]);
    this.name = "ApiError";
    this.code = code;
    this.verificationId = metadata.verificationId;
    this.maskedEmail = metadata.maskedEmail;
    this.retryAfterSeconds = metadata.retryAfterSeconds;
    this.status = metadata.status;
    this.serverCode = metadata.serverCode;
    this.requestId = metadata.requestId;
    this.fieldNames = metadata.fieldNames;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getSafeErrorMessage(error: unknown) {
  return isApiError(error) ? error.message : safeMessages.UNEXPECTED_RESPONSE;
}

export type AuthUserRole = "INVESTOR" | "STAFF" | "ADMIN";
export type AuthPrimaryAccountType = "INDIVIDUAL" | "CORPORATE";
export type AuthAccountContext = "INDIVIDUAL" | "CORPORATE" | "JOINT";

/** Safe backend user projection. Corporate applicants are authenticated INVESTORs
 * whose first/last names are deliberately empty strings because no Individual
 * InvestorProfile is created for their registration path. */
export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  /** Optional safe Corporate applicant projection when provided by the existing auth backend. */
  companyName?: string;
  companyPhoneNumber?: string;
  emailVerified?: boolean;
  role: AuthUserRole;
  /**
   * Server-derived, read-only account classification from /me and login.
   * `null` means an unclassified legacy account; `undefined` means the backend
   * did not send the field. It is used only to explain backend authorisation
   * results and is never sent to the backend or used to grant access.
   */
  primaryAccountType?: AuthPrimaryAccountType | null;
  authorizedContexts?: AuthAccountContext[];
  /**
   * Server-derived count of active Joint memberships. JOINT appears in
   * `authorizedContexts` only when this is greater than zero. Read-only; it is
   * never sent back to the backend and is not used to grant access.
   */
  jointMembershipCount?: number;
};

export type IndividualAccountProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
};

export type IndividualKycDocumentType = "PASSPORT" | "PVC" | "DRIVERS_LICENSE" | "NIN";
export type IndividualKycSectionStatus = "NOT_STARTED" | "DRAFT" | "COMPLETE";
export type IndividualKycWorkflowStatus = "DRAFT" | "SUBMITTED" | "UNDER_REVIEW" | "INFO_REQUIRED" | "INFO_REQUESTED" | "APPROVED" | "COMPLETE" | "REJECTED";

export type IndividualKycSectionStatuses = {
  personal: IndividualKycSectionStatus;
  investmentProfile: IndividualKycSectionStatus;
  sourceOfFunds: IndividualKycSectionStatus;
  bankDetails: IndividualKycSectionStatus;
};

export type IndividualKycPepDetails = {
  fullName: string;
  position: string;
  country: string;
  periodHeld: string;
};

export type IndividualKycDocumentSummary = {
  id: string | null;
  documentType: IndividualKycDocumentType | null;
  status: string | null;
  manualReviewStatus: string | null;
  originalFilename: string | null;
};

export type IndividualKycProfile = {
  status: IndividualKycWorkflowStatus;
  version: number;
  sectionStatuses: IndividualKycSectionStatuses;
  progression: { nextSection: string | null; canSubmit: boolean };
  submittedAt: string | null;
  sections: {
    personal: {
      dateOfBirth: string | null;
      gender: "MALE" | "FEMALE" | null;
      nationality: string | null;
      residentialAddress: string | null;
      stateOfResidence: string | null;
      idDocumentType: IndividualKycDocumentType | null;
      occupation: string | null;
      pepStatus: "YES" | "NO" | null;
      pepDetails: IndividualKycPepDetails | string | null;
    };
    investmentProfile: {
      primaryInvestmentObjective: string | null;
      riskTolerance: string | null;
      investmentHorizon: string | null;
      financialCurrency: string | null;
      investmentKnowledgeExperience: string | null;
      expectedWithdrawalsMinor: string | null;
      withdrawalFrequency: string | null;
      annualIncomeMinor: string | null;
      estimatedNetWorthMinor: string | null;
      investmentRestrictions: string | null;
    };
    sourceOfFunds: {
      sourceOfFunds: string[];
      otherSource: string | null;
      expectedAnnualInflowMinor: string | null;
      expectedTransactionFrequency: string | null;
    };
    bankDetails: {
      bankName: string | null;
      accountNumberMasked: string | null;
      accountName: string | null;
      accountType: string | null;
      bvnLinkedToAccount: boolean | null;
    };
  };
  documents: IndividualKycDocumentSummary[];
};

export type IndividualKycMutationResult = {
  version: number;
  sectionStatuses?: IndividualKycSectionStatuses;
  progression?: { nextSection: string | null; canSubmit: boolean };
};

export type SaveIndividualKycPersonalInput = {
  version: number;
  dateOfBirth: string;
  gender: "MALE" | "FEMALE";
  nationality: string;
  residentialAddress: string;
  stateOfResidence: string;
  idDocumentType: IndividualKycDocumentType;
  occupation: string;
  pepStatus: "YES" | "NO";
  pepDetails: IndividualKycPepDetails | null;
};

export type SaveIndividualKycInvestmentProfileInput = {
  version: number;
  primaryInvestmentObjective: string;
  riskTolerance: string;
  investmentHorizon: string;
  financialCurrency: "NGN";
  investmentKnowledgeExperience: string;
  expectedWithdrawalsMinor: string;
  withdrawalFrequency: string;
  annualIncomeMinor: string;
  estimatedNetWorthMinor: string;
  investmentRestrictions: string | null;
};

export type SaveIndividualKycSourceOfFundsInput = {
  version: number;
  sourceOfFunds: string[];
  otherSource?: string;
  expectedAnnualInflowMinor: string;
  expectedTransactionFrequency: string;
};

export type SaveIndividualKycBankDetailsInput = {
  version: number;
  bankName: string;
  accountNumber: string;
  accountName: string;
  accountType: string;
  bvnLinkedToAccount: boolean;
};

export type IndividualKycUploadIntentInput = {
  version: number;
  documentType: IndividualKycDocumentType;
  originalFilename: string;
  contentType: "application/pdf" | "image/jpeg" | "image/png";
  sizeBytes: number;
  checksumSha256: string;
};

export type IndividualKycUploadIntent = {
  documentId: string;
  uploadUrl: string;
  requiredHeaders: Record<string, string>;
  version: number;
};

export type IndividualKycSubmissionResult = {
  status: "SUBMITTED";
  version: number;
  submittedAt: string | null;
};

/** Exact Phase 2D /me/portfolio holding projection from docs/api/openapi.yaml. */
export type PortfolioHolding = {
  id: string | null;
  instrumentLabel: string | null;
  /** Decimal quantities are intentionally serialized by the API as strings. */
  quantity: string | null;
  valueMinor: number | null;
  currency: string | null;
  asOf: string | null;
  isDemo: boolean | null;
};

/** Exact Phase 2D /me/portfolio data projection from docs/api/openapi.yaml. */
export type InvestorPortfolio = {
  currency: string | null;
  totalValueMinor: number | null;
  holdingCount: number | null;
  totalReturnMinor: number | null;
  holdings: PortfolioHolding[];
};

/** Exact Phase 2D /me/transactions item projection from docs/api/openapi.yaml. */
export type InvestorTransaction = {
  id: string | null;
  type: string | null;
  status: string | null;
  amountMinor: number | null;
  currency: string | null;
  description: string | null;
  occurredAt: string | null;
};

export type InvestorTransactionsPage = {
  transactions: InvestorTransaction[];
  page: number | null;
  pageSize: number | null;
  total: number | null;
};

/** Phase 4A Joint API views. IDs originate only from authenticated API responses. */
export type JointAccountSummary = {
  jointAccountId: string;
  displayName: string;
  memberCount: number;
  holderNames: string[];
  myJoinedAt: string;
  isFull: boolean;
  awaitingSecondHolder: boolean;
};

export type JointAccountMember = {
  userId: string;
  firstName: string;
  lastName: string;
  email: string;
  joinedAt: string;
};

export type JointAccountDetail = {
  jointAccountId: string;
  displayName: string;
  createdAt: string;
  members: JointAccountMember[];
  membership: {
    capacity: number;
    activeCount: number;
    awaitingSecondHolder: boolean;
  };
};

export type JointInvitation = {
  invitationId: string;
  jointAccountId: string;
  accountDisplayName: string;
  inviterFirstName: string;
  expiresAt: string;
  sentAt: string;
};

export type CreatedJointAccount = {
  jointAccountId: string;
  displayName: string;
  invitation: {
    invitationId: string;
    invitedEmailMasked: string;
    expiresAt: string;
    status: "PENDING";
  };
};

export type CreatedJointInvitation = {
  invitationId: string;
  invitedEmailMasked: string;
  expiresAt: string;
  status: "PENDING";
};

export type RegisterResponse = {
  userId: string;
  verificationId: string;
  maskedEmail: string;
  emailVerified: false;
  nextAction: "VERIFY_EMAIL";
};

/** Retained name for the unchanged legacy Individual registration caller. */
export type RegisterIndividualResponse = RegisterResponse;
export type RegisterCorporateApplicantResponse = RegisterResponse;

export type EmailVerificationResponse = {
  nextAction: "LOGIN";
  maskedEmail?: string;
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function unwrapPayload(payload: unknown): JsonRecord {
  if (!isRecord(payload)) return {};
  return isRecord(payload.data) ? payload.data : payload;
}

function readString(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "string" ? value : undefined;
}

function readNumber(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
}

function readBoolean(record: JsonRecord, key: string) {
  const value = record[key];
  return typeof value === "boolean" ? value : undefined;
}

function extractErrorRecord(payload: unknown): JsonRecord {
  if (!isRecord(payload)) return {};
  if (isRecord(payload.error)) return payload.error;
  if (isRecord(payload.data) && isRecord(payload.data.error)) return payload.data.error;
  return payload;
}

function toKnownErrorCode(value: string | undefined, status: number): ApiErrorCode {
  if (value && value in safeMessages) return value as ApiErrorCode;
  if (status === 400 || status === 422) return "VALIDATION_FAILED";
  if (status === 401) return "UNAUTHENTICATED";
  if (status === 403) return "FORBIDDEN";
  if (status === 404) return "NOT_FOUND";
  if (status === 409) return "CONFLICT";
  if (status === 410) return "GONE";
  if (status === 429) return "RATE_LIMITED";
  return "UNEXPECTED_RESPONSE";
}

function errorFromResponse(response: Response, payload: unknown) {
  const root = isRecord(payload) ? payload : {};
  const rootData = isRecord(root.data) ? root.data : {};
  const errorRecord = extractErrorRecord(payload);
  // The Starfetch API exposes workflow values in error.context, not details.
  const context = isRecord(errorRecord.context) ? errorRecord.context : {};
  const retryAfterHeader = Number(response.headers.get("Retry-After"));
  const retryAfterSeconds = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
    ? retryAfterHeader
    : readNumber(errorRecord, "retryAfterSeconds") ?? readNumber(errorRecord, "retryAfter") ?? readNumber(context, "retryAfterSeconds") ?? readNumber(rootData, "retryAfterSeconds");

  const rawCode = readString(errorRecord, "code") ?? readString(root, "code");
  const serverCode = rawCode && /^[A-Z][A-Z0-9_]{1,63}$/.test(rawCode) ? rawCode : undefined;
  const rawRequestId = readString(errorRecord, "requestId") ?? response.headers.get("x-request-id") ?? undefined;
  const requestId = rawRequestId && /^[A-Za-z0-9][A-Za-z0-9._-]{7,99}$/.test(rawRequestId) ? rawRequestId : undefined;
  const fields = isRecord(errorRecord.fields) ? Object.keys(errorRecord.fields).filter((name) => /^[A-Za-z][A-Za-z0-9]{0,63}$/.test(name)) : [];

  return new ApiError(toKnownErrorCode(rawCode, response.status), {
    verificationId: readString(context, "verificationId") ?? readString(errorRecord, "verificationId") ?? readString(rootData, "verificationId") ?? readString(root, "verificationId"),
    maskedEmail: readString(context, "email"),
    retryAfterSeconds,
    status: response.status,
    serverCode,
    requestId,
    ...(fields.length ? { fieldNames: fields } : {}),
  });
}

async function parseJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (!text) return {};
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return {};
  }
}

type RequestOptions = {
  method?: "GET" | "POST" | "PUT" | "PATCH";
  body?: unknown;
  rawBody?: BodyInit;
  headers?: HeadersInit;
};

type AuthenticatedRequestOptions = RequestOptions & {
  /**
   * Evaluated immediately before every authenticated HTTP attempt. This is
   * required for mutation CSRF headers because a successful refresh can rotate
   * the readable double-submit cookie between the original request and retry.
   */
  attemptHeaders?: () => Record<string, string>;
};

/** All browser requests use the same-origin /api/v1 Next.js rewrite. */
async function request(path: string, options: RequestOptions = {}) {
  try {
    const response = await fetch(`/api/v1${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
      cache: "no-store",
      headers: {
        ...(options.rawBody === undefined && options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.rawBody !== undefined ? options.rawBody : options.body === undefined ? undefined : JSON.stringify(options.body),
    });
    const payload = await parseJson(response);
    if (!response.ok) throw errorFromResponse(response, payload);
    return payload;
  } catch (error) {
    if (isApiError(error)) throw error;
    throw new ApiError("NETWORK_ERROR");
  }
}

function readCsrfToken() {
  if (typeof document === "undefined") return undefined;
  const cookies = document.cookie.split(";").map((value) => value.trim());
  // Production/staging uses the host-only secure name. Local development keeps
  // the shorter cookie name so a non-HTTPS localhost setup still works.
  const csrfCookie = cookies.find((value) => value.startsWith("__Host-sf_csrf="))
    ?? cookies.find((value) => value.startsWith("sf_csrf="));
  if (!csrfCookie) return undefined;
  return decodeURIComponent(csrfCookie.slice(csrfCookie.indexOf("=") + 1));
}

function csrfHeaders(): Record<string, string> {
  const csrfToken = readCsrfToken();
  return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
}

function authorizationHeaders() {
  if (!inMemoryAccessToken) throw new ApiError("UNAUTHENTICATED");
  return { Authorization: `Bearer ${inMemoryAccessToken}` };
}

/**
 * Makes one bounded refresh-and-retry attempt for an authenticated request.
 * Concurrent 401s share refreshAccessToken's single-flight rotation.
 */
async function authenticatedRequest(path: string, options: AuthenticatedRequestOptions = {}) {
  const generationAtStart = authGeneration;
  const { attemptHeaders, ...requestOptions } = options;
  const requestWithCurrentToken = () => request(path, {
    ...requestOptions,
    // Rebuild both authorization and per-attempt headers for every request.
    // In particular, a refresh can rotate the CSRF cookie before a POST retry.
    headers: { ...requestOptions.headers, ...attemptHeaders?.(), ...authorizationHeaders() },
  });

  try {
    return await requestWithCurrentToken();
  } catch (error) {
    if (!isApiError(error) || error.code !== "UNAUTHENTICATED" || generationAtStart !== authGeneration) throw error;

    let generationAfterRefresh: number;
    try {
      await refreshAccessToken();
      generationAfterRefresh = authGeneration;
    } catch (refreshError) {
      // A logout or newer login owns the current session. A stale request must
      // never clear that newer authority when its old refresh finishes.
      if (generationAtStart === authGeneration) {
        clearAccessToken();
        notifySessionExpired();
      }
      throw refreshError;
    }

    try {
      return await requestWithCurrentToken();
    } catch (retryError) {
      if (isApiError(retryError) && retryError.code === "UNAUTHENTICATED" && generationAfterRefresh === authGeneration) {
        clearAccessToken();
        notifySessionExpired();
      }
      throw retryError;
    }
  }
}

/**
 * Authenticated mutations use the existing CSRF double-submit helper. The
 * cookie is intentionally read per HTTP attempt, not once for the full
 * request, so a bounded post-refresh retry sends the rotated CSRF token.
 */
async function authenticatedMutation(path: string, body?: unknown, headers?: HeadersInit, method: "POST" | "PUT" | "PATCH" = "POST") {
  return authenticatedRequest(path, {
    method,
    body,
    headers,
    attemptHeaders: csrfHeaders,
  });
}

function normaliseUser(payload: unknown): AuthUser {
  const data = unwrapPayload(payload);
  const user = isRecord(data.user) ? data.user : data;
  const id = readString(user, "id") ?? readString(user, "userId");
  // Empty names are the approved SafeUser projection for a verified Corporate
  // applicant without an Individual InvestorProfile. Do not manufacture names
  // or force a profile lookup to make this session appear authenticated.
  const firstName = readString(user, "firstName");
  const lastName = readString(user, "lastName");
  const email = readString(user, "email");
  const companyName = readString(user, "companyName");
  const companyPhoneNumber = readString(user, "companyPhoneNumber");
  const role = user.role;
  const primaryAccountTypeValue = user.primaryAccountType;
  const primaryAccountType = primaryAccountTypeValue === "INDIVIDUAL" || primaryAccountTypeValue === "CORPORATE" ? primaryAccountTypeValue : primaryAccountTypeValue === null ? null : undefined;
  const authorizedContexts = Array.isArray(user.authorizedContexts)
    ? user.authorizedContexts.filter((value): value is AuthAccountContext => value === "INDIVIDUAL" || value === "CORPORATE" || value === "JOINT")
    : undefined;
  const jointMembershipCountValue = user.jointMembershipCount;
  const jointMembershipCount = typeof jointMembershipCountValue === "number" && Number.isInteger(jointMembershipCountValue) && jointMembershipCountValue >= 0 ? jointMembershipCountValue : undefined;
  if (!id || firstName === undefined || lastName === undefined || !email || (role !== "INVESTOR" && role !== "STAFF" && role !== "ADMIN")) throw new ApiError("UNEXPECTED_RESPONSE");
  return {
    id,
    firstName,
    lastName,
    email,
    ...(companyName ? { companyName } : {}),
    ...(companyPhoneNumber ? { companyPhoneNumber } : {}),
    emailVerified: typeof user.emailVerified === "boolean" ? user.emailVerified : undefined,
    role,
    ...(primaryAccountType !== undefined ? { primaryAccountType } : {}),
    ...(authorizedContexts ? { authorizedContexts } : {}),
    ...(jointMembershipCount !== undefined ? { jointMembershipCount } : {}),
  };
}

function normaliseProfile(payload: unknown): IndividualAccountProfile {
  const data = unwrapPayload(payload);
  const profile = isRecord(data.profile) ? data.profile : data;
  const firstName = readString(profile, "firstName");
  const lastName = readString(profile, "lastName");
  const email = readString(profile, "email");
  const phoneValue = profile.phone;
  const phone: string | null = typeof phoneValue === "string" ? phoneValue : null;
  if (!firstName || !lastName || !email) throw new ApiError("UNEXPECTED_RESPONSE");
  return { firstName, lastName, email, phone };
}

function nullableString(record: JsonRecord, key: string): string | null {
  return typeof record[key] === "string" ? record[key] as string : null;
}

function readNonNegativeInteger(record: JsonRecord, key: string): number | null {
  const value = record[key];
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return value;
  if (typeof value === "string" && /^\d+$/.test(value)) {
    const parsed = Number(value);
    if (Number.isSafeInteger(parsed)) return parsed;
  }
  return null;
}

function readMinorDigits(record: JsonRecord, key: string): string | null {
  const value = record[key];
  if (typeof value === "string" && /^\d+$/.test(value)) return value;
  if (typeof value === "number" && Number.isSafeInteger(value) && value >= 0) return String(value);
  return null;
}

function isIndividualKycDocumentType(value: unknown): value is IndividualKycDocumentType {
  return value === "PASSPORT" || value === "PVC" || value === "DRIVERS_LICENSE" || value === "NIN";
}

function normaliseIndividualKycSectionStatus(value: unknown): IndividualKycSectionStatus {
  return value === "COMPLETE" || value === "DRAFT" ? value : "NOT_STARTED";
}

function normaliseIndividualKycSectionStatuses(value: unknown): IndividualKycSectionStatuses {
  const statuses = isRecord(value) ? value : {};
  return {
    personal: normaliseIndividualKycSectionStatus(statuses.personal),
    investmentProfile: normaliseIndividualKycSectionStatus(statuses.investmentProfile ?? statuses.investment),
    sourceOfFunds: normaliseIndividualKycSectionStatus(statuses.sourceOfFunds),
    bankDetails: normaliseIndividualKycSectionStatus(statuses.bankDetails ?? statuses.bank),
  };
}

function normaliseIndividualKycProgression(value: unknown): IndividualKycProfile["progression"] {
  if (!isRecord(value)) return { nextSection: "personal", canSubmit: false };
  const nextSectionValue = value.nextSection;
  return {
    nextSection: typeof nextSectionValue === "string" ? nextSectionValue : null,
    canSubmit: readBoolean(value, "canSubmit") ?? false,
  };
}

function normaliseIndividualKycPepDetails(value: unknown): IndividualKycProfile["sections"]["personal"]["pepDetails"] {
  if (typeof value === "string") return value;
  if (!isRecord(value)) return null;
  const fullName = readString(value, "fullName");
  const position = readString(value, "position");
  const country = readString(value, "country");
  const periodHeld = readString(value, "periodHeld");
  if (fullName === undefined && position === undefined && country === undefined && periodHeld === undefined) return null;
  return {
    fullName: fullName ?? "",
    position: position ?? "",
    country: country ?? "",
    periodHeld: periodHeld ?? "",
  };
}

function normaliseIndividualKycDocument(record: JsonRecord, fallbackType: unknown = null): IndividualKycDocumentSummary {
  const documentTypeValue = record.documentType ?? fallbackType;
  return {
    id: readString(record, "id") ?? null,
    documentType: isIndividualKycDocumentType(documentTypeValue) ? documentTypeValue : null,
    status: nullableString(record, "status"),
    manualReviewStatus: nullableString(record, "manualReviewStatus") ?? nullableString(record, "reviewStatus"),
    originalFilename: nullableString(record, "originalFilename"),
  };
}

function emptyIndividualKycProfile(): IndividualKycProfile {
  return {
    status: "DRAFT",
    version: 0,
    sectionStatuses: {
      personal: "NOT_STARTED",
      investmentProfile: "NOT_STARTED",
      sourceOfFunds: "NOT_STARTED",
      bankDetails: "NOT_STARTED",
    },
    progression: { nextSection: "personal", canSubmit: false },
    submittedAt: null,
    sections: {
      personal: { dateOfBirth: null, gender: null, nationality: null, residentialAddress: null, stateOfResidence: null, idDocumentType: null, occupation: null, pepStatus: null, pepDetails: null },
      investmentProfile: { primaryInvestmentObjective: null, riskTolerance: null, investmentHorizon: null, financialCurrency: null, investmentKnowledgeExperience: null, expectedWithdrawalsMinor: null, withdrawalFrequency: null, annualIncomeMinor: null, estimatedNetWorthMinor: null, investmentRestrictions: null },
      sourceOfFunds: { sourceOfFunds: [], otherSource: null, expectedAnnualInflowMinor: null, expectedTransactionFrequency: null },
      // The API deliberately returns only a masked account number. Never hydrate an account-number input from a response.
      bankDetails: { bankName: null, accountNumberMasked: null, accountName: null, accountType: null, bvnLinkedToAccount: null },
    },
    documents: [],
  };
}

function normaliseIndividualKycProfile(payload: unknown): IndividualKycProfile {
  const data = unwrapPayload(payload);
  const source = isRecord(data.kycProfile) ? data.kycProfile : data;
  const version = readNonNegativeInteger(source, "version");
  if (version === null) throw new ApiError("UNEXPECTED_RESPONSE");

  const rawSections = isRecord(source.sections) ? source.sections : source;
  const personal = isRecord(rawSections.personal) ? rawSections.personal : {};
  const investment = isRecord(rawSections.investmentProfile) ? rawSections.investmentProfile : isRecord(rawSections.investment) ? rawSections.investment : {};
  const sourceOfFunds = isRecord(rawSections.sourceOfFunds) ? rawSections.sourceOfFunds : {};
  const bank = isRecord(rawSections.bankDetails) ? rawSections.bankDetails : isRecord(rawSections.bank) ? rawSections.bank : {};
  const rawStatuses = source.sectionStatuses ?? source.sectionStatus;
  const rawStatus = readString(source, "status");
  const knownStatuses: readonly string[] = ["DRAFT", "SUBMITTED", "UNDER_REVIEW", "INFO_REQUIRED", "INFO_REQUESTED", "APPROVED", "COMPLETE", "REJECTED"];
  const status: IndividualKycWorkflowStatus = rawStatus && knownStatuses.includes(rawStatus) ? rawStatus as IndividualKycWorkflowStatus : "DRAFT";
  const genderValue = readString(personal, "gender");
  const pepStatusValue = readString(personal, "pepStatus");
  const sourcesValue = sourceOfFunds.sourceOfFunds;
  const rawDocuments = Array.isArray(source.documents) ? source.documents : [];
  const documents = rawDocuments.filter(isRecord).map((document) => normaliseIndividualKycDocument(document));
  if (documents.length === 0 && isRecord(personal.idDocument)) documents.push(normaliseIndividualKycDocument(personal.idDocument, personal.idDocumentType));

  return {
    status,
    version,
    sectionStatuses: normaliseIndividualKycSectionStatuses(rawStatuses),
    progression: normaliseIndividualKycProgression(source.progression),
    submittedAt: readString(source, "submittedAt") ?? readString(source, "timestamp") ?? null,
    sections: {
      personal: {
        dateOfBirth: nullableString(personal, "dateOfBirth"),
        gender: genderValue === "MALE" || genderValue === "FEMALE" ? genderValue : null,
        nationality: nullableString(personal, "nationality"),
        residentialAddress: nullableString(personal, "residentialAddress"),
        stateOfResidence: nullableString(personal, "stateOfResidence"),
        idDocumentType: isIndividualKycDocumentType(personal.idDocumentType) ? personal.idDocumentType : null,
        occupation: nullableString(personal, "occupation"),
        pepStatus: pepStatusValue === "YES" || pepStatusValue === "NO" ? pepStatusValue : null,
        pepDetails: normaliseIndividualKycPepDetails(personal.pepDetails),
      },
      investmentProfile: {
        primaryInvestmentObjective: nullableString(investment, "primaryInvestmentObjective"),
        riskTolerance: nullableString(investment, "riskTolerance"),
        investmentHorizon: nullableString(investment, "investmentHorizon"),
        financialCurrency: nullableString(investment, "financialCurrency"),
        investmentKnowledgeExperience: nullableString(investment, "investmentKnowledgeExperience"),
        expectedWithdrawalsMinor: readMinorDigits(investment, "expectedWithdrawalsMinor"),
        withdrawalFrequency: nullableString(investment, "withdrawalFrequency"),
        annualIncomeMinor: readMinorDigits(investment, "annualIncomeMinor"),
        estimatedNetWorthMinor: readMinorDigits(investment, "estimatedNetWorthMinor"),
        investmentRestrictions: nullableString(investment, "investmentRestrictions"),
      },
      sourceOfFunds: {
        sourceOfFunds: Array.isArray(sourcesValue) ? sourcesValue.filter((value): value is string => typeof value === "string") : [],
        otherSource: nullableString(sourceOfFunds, "otherSource"),
        expectedAnnualInflowMinor: readMinorDigits(sourceOfFunds, "expectedAnnualInflowMinor"),
        expectedTransactionFrequency: nullableString(sourceOfFunds, "expectedTransactionFrequency"),
      },
      bankDetails: {
        bankName: nullableString(bank, "bankName"),
        accountNumberMasked: nullableString(bank, "accountNumberMasked"),
        accountName: nullableString(bank, "accountName"),
        accountType: nullableString(bank, "accountType"),
        bvnLinkedToAccount: readBoolean(bank, "bvnLinkedToAccount") ?? null,
      },
    },
    documents,
  };
}

function normaliseIndividualKycMutationResult(payload: unknown): IndividualKycMutationResult {
  const data = unwrapPayload(payload);
  const version = readNonNegativeInteger(data, "version");
  if (version === null) throw new ApiError("UNEXPECTED_RESPONSE");
  const rawStatuses = data.sectionStatuses ?? data.sectionStatus;
  const progression = isRecord(data.progression) ? normaliseIndividualKycProgression(data.progression) : undefined;
  return {
    version,
    ...(rawStatuses !== undefined ? { sectionStatuses: normaliseIndividualKycSectionStatuses(rawStatuses) } : {}),
    ...(progression ? { progression } : {}),
  };
}

function normaliseIndividualKycUploadIntent(payload: unknown): IndividualKycUploadIntent {
  const data = unwrapPayload(payload);
  const documentId = readString(data, "documentId");
  const uploadUrl = readString(data, "uploadUrl");
  const version = readNonNegativeInteger(data, "version");
  const headers = isRecord(data.requiredHeaders) ? data.requiredHeaders : {};
  if (!documentId || !uploadUrl || version === null || !Object.values(headers).every((value) => typeof value === "string")) throw new ApiError("UNEXPECTED_RESPONSE");
  try {
    const parsed = new URL(uploadUrl);
    const localHttp = parsed.protocol === "http:" && ["localhost", "127.0.0.1"].includes(parsed.hostname);
    if (parsed.protocol !== "https:" && !localHttp) throw new Error("invalid upload scheme");
  } catch {
    throw new ApiError("UNEXPECTED_RESPONSE");
  }
  return { documentId, uploadUrl, version, requiredHeaders: headers as Record<string, string> };
}

function normaliseIndividualKycSubmission(payload: unknown): IndividualKycSubmissionResult {
  const data = unwrapPayload(payload);
  const version = readNonNegativeInteger(data, "version");
  const status = readString(data, "status");
  if (version === null || status !== "SUBMITTED") throw new ApiError("UNEXPECTED_RESPONSE");
  return { status: "SUBMITTED", version, submittedAt: readString(data, "submittedAt") ?? readString(data, "timestamp") ?? null };
}

function readMinor(record: JsonRecord, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isSafeInteger(value)) return value;
    if (typeof value === "string" && /^-?\d+$/.test(value)) {
      const parsed = Number(value);
      if (Number.isSafeInteger(parsed)) return parsed;
    }
  }
  return null;
}

function normalisePortfolio(payload: unknown): InvestorPortfolio {
  const data = unwrapPayload(payload);
  const holdingRecords = data.holdings;
  if (!Array.isArray(holdingRecords)) throw new ApiError("UNEXPECTED_RESPONSE");

  const holdings = holdingRecords.filter(isRecord).map((holding) => ({
    id: readString(holding, "id") ?? null,
    instrumentLabel: readString(holding, "instrumentLabel") ?? null,
    quantity: readString(holding, "quantity") ?? null,
    valueMinor: readMinor(holding, ["valueMinor"]),
    currency: readString(holding, "currency") ?? null,
    asOf: readString(holding, "asOf") ?? null,
    isDemo: readBoolean(holding, "isDemo") ?? null,
  }));

  return {
    currency: readString(data, "currency") ?? null,
    totalValueMinor: readMinor(data, ["totalValueMinor"]),
    holdingCount: readMinor(data, ["holdingCount"]),
    totalReturnMinor: readMinor(data, ["totalReturnMinor"]),
    holdings,
  };
}

function normaliseTransactions(payload: unknown): InvestorTransactionsPage {
  if (!isRecord(payload) || !Array.isArray(payload.data)) throw new ApiError("UNEXPECTED_RESPONSE");
  const meta = isRecord(payload.meta) ? payload.meta : {};
  const transactions = payload.data.filter(isRecord).map((transaction) => ({
    id: readString(transaction, "id") ?? null,
    type: readString(transaction, "type") ?? null,
    status: readString(transaction, "status") ?? null,
    amountMinor: readMinor(transaction, ["amountMinor"]),
    currency: readString(transaction, "currency") ?? null,
    description: readString(transaction, "description") ?? null,
    occurredAt: readString(transaction, "occurredAt") ?? null,
  }));
  return {
    transactions,
    page: readMinor(meta, ["page"]),
    pageSize: readMinor(meta, ["pageSize"]),
    total: readMinor(meta, ["total"]),
  };
}

function isCorporateApplicationState(value: unknown): value is CorporateApplicationState {
  return typeof value === "string" && (corporateApplicationStates as readonly string[]).includes(value);
}

function normaliseCorporateApplicationReceipt(payload: unknown): CorporateApplicationReceipt {
  const data = unwrapPayload(payload);
  const corporateAccountId = readString(data, "corporateAccountId");
  const applicationId = readString(data, "applicationId");
  const detailsVersion = readNumber(data, "detailsVersion");
  if (!corporateAccountId || !applicationId || data.applicationStatus !== "DRAFT" || detailsVersion !== 1) throw new ApiError("UNEXPECTED_RESPONSE");
  return { corporateAccountId, applicationId, applicationStatus: "DRAFT", detailsVersion: 1 };
}

function normaliseCorporateDetails(value: unknown) {
  if (!isRecord(value)) throw new ApiError("UNEXPECTED_RESPONSE");
  const institutionName = readString(value, "institutionName");
  const dateOfIncorporation = readString(value, "dateOfIncorporation");
  const rcNumber = readString(value, "rcNumber");
  const businessPhoneNumber = readString(value, "businessPhoneNumber");
  const businessEmail = readString(value, "businessEmail");
  const maskedValue = value.taxIdentificationNumberMasked;
  const taxIdentificationNumberMasked = typeof maskedValue === "string" ? maskedValue : maskedValue === null ? null : undefined;
  const version = readNumber(value, "version");
  const createdAt = readString(value, "createdAt");
  const updatedAt = readString(value, "updatedAt");
  if (!institutionName || !dateOfIncorporation || !rcNumber || !businessPhoneNumber || !businessEmail || taxIdentificationNumberMasked === undefined || !version || !createdAt || !updatedAt) throw new ApiError("UNEXPECTED_RESPONSE");
  return { institutionName, dateOfIncorporation, rcNumber, businessPhoneNumber, businessEmail, taxIdentificationNumberMasked, version, createdAt, updatedAt };
}

function normaliseCorporateOnboarding(payload: unknown): CorporateOnboardingRecord {
  const data = unwrapPayload(payload);
  const corporateAccountId = readString(data, "corporateAccountId");
  const applicationId = readString(data, "applicationId");
  const status = data.status;
  const createdAt = readString(data, "createdAt");
  const updatedAt = readString(data, "updatedAt");
  if (!corporateAccountId || !applicationId || !isCorporateApplicationState(status) || !createdAt || !updatedAt) throw new ApiError("UNEXPECTED_RESPONSE");
  return { corporateAccountId, applicationId, status, createdAt, updatedAt, details: normaliseCorporateDetails(data.details) };
}

function normaliseCorporateDraftUpdate(payload: unknown): CorporateDraftUpdateResult {
  const data = unwrapPayload(payload);
  const corporateAccountId = readString(data, "corporateAccountId");
  const applicationId = readString(data, "applicationId");
  const status = data.status;
  if (!corporateAccountId || !applicationId || !isCorporateApplicationState(status)) throw new ApiError("UNEXPECTED_RESPONSE");
  return { corporateAccountId, applicationId, status, details: normaliseCorporateDetails(data.details) };
}

function normaliseCorporateDiscovery(payload: unknown): CorporateApplicationDiscoveryItem[] {
  if (!isRecord(payload) || !Array.isArray(payload.data) || !payload.data.every(isRecord)) throw new ApiError("UNEXPECTED_RESPONSE");
  return payload.data.map((item) => {
    const corporateAccountId = readString(item, "corporateAccountId");
    const applicationId = readString(item, "applicationId");
    const status = item.status;
    const detailsVersion = readNumber(item, "detailsVersion");
    const createdAt = readString(item, "createdAt");
    const updatedAt = readString(item, "updatedAt");
    if (!corporateAccountId || !applicationId || !isCorporateApplicationState(status) || !detailsVersion || !createdAt || !updatedAt || item.accessVia !== "INITIATING_APPLICANT") throw new ApiError("UNEXPECTED_RESPONSE");
    return { corporateAccountId, applicationId, status, detailsVersion, createdAt, updatedAt, accessVia: "INITIATING_APPLICANT" as const };
  });
}

function normaliseCorporateHistory(payload: unknown): CorporateApplicationHistory {
  const data = unwrapPayload(payload);
  const corporateAccountId = readString(data, "corporateAccountId");
  const applicationId = readString(data, "applicationId");
  const historyValue = data.history;
  const amendmentsValue = data.detailsAmendments;
  if (!corporateAccountId || !applicationId || !Array.isArray(historyValue) || !historyValue.every(isRecord) || !Array.isArray(amendmentsValue) || !amendmentsValue.every(isRecord)) throw new ApiError("UNEXPECTED_RESPONSE");
  const history = historyValue.map((entry) => {
    const id = readString(entry, "id");
    const fromStatusValue = entry.fromStatus;
    const fromStatus = fromStatusValue === null ? null : isCorporateApplicationState(fromStatusValue) ? fromStatusValue : undefined;
    const toStatus = entry.toStatus;
    const createdAt = readString(entry, "createdAt");
    if (!id || entry.event !== "CREATED" || fromStatus === undefined || !isCorporateApplicationState(toStatus) || !createdAt) throw new ApiError("UNEXPECTED_RESPONSE");
    return { id, event: "CREATED" as const, fromStatus, toStatus, createdAt };
  });
  const detailsAmendments: CorporateDetailsAmendment[] = amendmentsValue.map((entry) => {
    const version = readNumber(entry, "version");
    const changedAt = readString(entry, "changedAt");
    const changedFieldNames = entry.changedFieldNames;
    if (!version || version < 2 || !changedAt || !Array.isArray(changedFieldNames) || !changedFieldNames.every((field) => typeof field === "string" && (corporateEditableFieldNames as readonly string[]).includes(field))) throw new ApiError("UNEXPECTED_RESPONSE");
    return { version, changedFieldNames: [...changedFieldNames] as CorporateDetailsAmendment["changedFieldNames"], changedAt };
  });
  return { corporateAccountId, applicationId, history, detailsAmendments };
}

function normaliseCorporateSnapshotFreshness(payload: unknown): CorporateSnapshotFreshness {
  const data = unwrapPayload(payload);
  const applicationId = readString(data, "applicationId");
  const snapshotIdValue = data.snapshotId;
  const generationValue = data.generation;
  const snapshotId = typeof snapshotIdValue === "string" ? snapshotIdValue : snapshotIdValue === null ? null : undefined;
  const generation = typeof generationValue === "number" && Number.isInteger(generationValue) && generationValue >= 1 ? generationValue : generationValue === null ? null : undefined;
  const isFresh = readBoolean(data, "isFresh");
  const issues = data.issues;
  if (!applicationId || snapshotId === undefined || generation === undefined || isFresh === undefined || !Array.isArray(issues) || !issues.every((issue) => typeof issue === "string" && (corporateSnapshotIssueCodes as readonly string[]).includes(issue))) throw new ApiError("UNEXPECTED_RESPONSE");
  return { applicationId, snapshotId, generation, isFresh, issues: [...issues] as CorporateSnapshotFreshness["issues"] };
}

function corporateAccountPathSegment(corporateAccountId: string) {
  return encodeURIComponent(corporateAccountId);
}

function nullableRecordString(record: JsonRecord, key: string): string | null | undefined {
  const value = record[key];
  return typeof value === "string" ? value : value === null || value === undefined ? null : undefined;
}

function normaliseCorporateProfileSectionStatus(value: unknown): CorporateProfileSectionStatus | undefined {
  return value === "NOT_STARTED" || value === "DRAFT" || value === "COMPLETE" ? value : undefined;
}

/**
 * Strict CorporateProfileView normaliser. Only the documented safe projection is
 * kept: a plaintext TIN or account number is never read, even if one appeared.
 */
function normaliseCorporateProfile(payload: unknown): CorporateProfileView {
  const data = unwrapPayload(payload);
  const corporateAccountId = readString(data, "corporateAccountId");
  const applicationId = readString(data, "applicationId");
  const applicant = isRecord(data.applicant) ? data.applicant : null;
  const canonical = isRecord(data.canonicalDetails) ? data.canonicalDetails : null;
  const company = isRecord(data.companyDetails) ? data.companyDetails : null;
  const investment = isRecord(data.investmentProfile) ? data.investmentProfile : null;
  const sources = isRecord(data.sourceOfFunds) ? data.sourceOfFunds : null;
  const bank = isRecord(data.bankDetails) ? data.bankDetails : null;
  const statuses = isRecord(data.sectionStatuses) ? data.sectionStatuses : null;
  const progress = isRecord(data.progress) ? data.progress : null;
  const profileVersion = readNonNegativeInteger(data, "profileVersion");
  const detailsVersion = readNonNegativeInteger(data, "detailsVersion");
  if (!corporateAccountId || !applicationId || !applicant || !canonical || !company || !investment || !sources || !bank || !statuses || !progress || profileVersion === null || detailsVersion === null || detailsVersion < 1) throw new ApiError("UNEXPECTED_RESPONSE");

  const email = readString(applicant, "email");
  const companyName = nullableRecordString(applicant, "companyName");
  const companyPhoneNumber = nullableRecordString(applicant, "companyPhoneNumber");
  const institutionName = readString(canonical, "institutionName");
  const dateOfIncorporation = readString(canonical, "dateOfIncorporation");
  const rcNumber = readString(canonical, "rcNumber");
  const businessPhoneNumber = readString(canonical, "businessPhoneNumber");
  const businessEmail = readString(canonical, "businessEmail");
  const taxIdentificationNumberMasked = nullableRecordString(canonical, "taxIdentificationNumberMasked");
  if (!email || companyName === undefined || companyPhoneNumber === undefined || !institutionName || !dateOfIncorporation || !rcNumber || businessPhoneNumber === undefined || businessEmail === undefined || taxIdentificationNumberMasked === undefined) throw new ApiError("UNEXPECTED_RESPONSE");

  const sectionStatuses = {} as Record<CorporateProfileSectionKey, CorporateProfileSectionStatus>;
  for (const key of corporateProfileSectionKeys) {
    const status = normaliseCorporateProfileSectionStatus(statuses[key]);
    if (!status) throw new ApiError("UNEXPECTED_RESPONSE");
    sectionStatuses[key] = status;
  }
  const percentage = readNonNegativeInteger(progress, "percentage");
  const nextSectionValue = progress.nextSection;
  const nextSection = nextSectionValue === null ? null : (corporateProfileSectionKeys as readonly unknown[]).includes(nextSectionValue) ? nextSectionValue as CorporateProfileSectionKey : undefined;
  if (percentage === null || percentage > 100 || nextSection === undefined || progress.canSubmit !== false) throw new ApiError("UNEXPECTED_RESPONSE");

  const selectedSourcesValue = sources.selectedSources;
  if (!Array.isArray(selectedSourcesValue) || !selectedSourcesValue.every((value) => typeof value === "string")) throw new ApiError("UNEXPECTED_RESPONSE");
  const bvnValue = bank.bvnLinkedToAccount;
  const updatedAt = nullableRecordString(data, "updatedAt");

  const text = (record: JsonRecord, key: string) => {
    const value = nullableRecordString(record, key);
    if (value === undefined) throw new ApiError("UNEXPECTED_RESPONSE");
    return value;
  };

  return {
    corporateAccountId,
    applicationId,
    applicant: { companyName, companyPhoneNumber, email },
    canonicalDetails: { institutionName, dateOfIncorporation, rcNumber, businessPhoneNumber, businessEmail, taxIdentificationNumberMasked },
    companyDetails: { registeredAddress: text(company, "registeredAddress"), city: text(company, "city"), state: text(company, "state") },
    investmentProfile: {
      primaryObjective: text(investment, "primaryObjective"),
      riskTolerance: text(investment, "riskTolerance"),
      investmentHorizon: text(investment, "investmentHorizon"),
      expectedWithdrawals: text(investment, "expectedWithdrawals"),
      withdrawalFrequency: text(investment, "withdrawalFrequency"),
      restrictionsOrExclusions: text(investment, "restrictionsOrExclusions"),
    },
    sourceOfFunds: {
      selectedSources: [...selectedSourcesValue] as string[],
      otherSource: text(sources, "otherSource"),
      expectedAnnualInflow: text(sources, "expectedAnnualInflow"),
      expectedTransactionFrequency: text(sources, "expectedTransactionFrequency"),
    },
    bankDetails: {
      bankName: text(bank, "bankName"),
      // Only the backend mask is kept. A raw account number is never read.
      accountNumberMasked: text(bank, "accountNumberMasked"),
      accountName: text(bank, "accountName"),
      accountType: text(bank, "accountType"),
      bvnLinkedToAccount: typeof bvnValue === "boolean" ? bvnValue : null,
    },
    profileVersion,
    detailsVersion,
    sectionStatuses,
    progress: { percentage, nextSection, canSubmit: false, meaning: "SAVED_FORM_COMPLETION_ONLY" },
    updatedAt: updatedAt ?? null,
  };
}

function normaliseCorporateApplicantIdentity(payload: unknown): CorporateApplicantIdentityInput {
  const data = unwrapPayload(payload);
  const companyName = readString(data, "companyName");
  const companyPhoneNumber = readString(data, "companyPhoneNumber");
  if (!companyName || !companyPhoneNumber) throw new ApiError("UNEXPECTED_RESPONSE");
  return { companyName, companyPhoneNumber };
}

function corporateProfileVersionHeader(profileVersion: number, detailsVersion?: number) {
  try {
    return { "If-Match": corporateProfileIfMatch(profileVersion, detailsVersion) };
  } catch {
    throw new ApiError("VALIDATION_FAILED");
  }
}

function normaliseJointAccountSummary(record: JsonRecord): JointAccountSummary {
  const jointAccountId = readString(record, "jointAccountId");
  const displayName = readString(record, "displayName");
  const memberCount = readNumber(record, "memberCount");
  const holderNamesValue = record.holderNames;
  const myJoinedAt = readString(record, "myJoinedAt");
  const isFull = readBoolean(record, "isFull");
  const awaitingSecondHolder = readBoolean(record, "awaitingSecondHolder");
  if (!jointAccountId || !displayName || memberCount === undefined || !Array.isArray(holderNamesValue) || !holderNamesValue.every((name) => typeof name === "string") || !myJoinedAt || isFull === undefined || awaitingSecondHolder === undefined) throw new ApiError("UNEXPECTED_RESPONSE");
  return { jointAccountId, displayName, memberCount, holderNames: holderNamesValue, myJoinedAt, isFull, awaitingSecondHolder };
}

function normaliseJointAccounts(payload: unknown): JointAccountSummary[] {
  if (!isRecord(payload) || !Array.isArray(payload.data) || !payload.data.every(isRecord)) throw new ApiError("UNEXPECTED_RESPONSE");
  return payload.data.map(normaliseJointAccountSummary);
}

function normaliseJointAccountDetail(payload: unknown): JointAccountDetail {
  const data = unwrapPayload(payload);
  const jointAccountId = readString(data, "jointAccountId");
  const displayName = readString(data, "displayName");
  const createdAt = readString(data, "createdAt");
  const membersValue = data.members;
  const membership = data.membership;
  if (!jointAccountId || !displayName || !createdAt || !Array.isArray(membersValue) || !membersValue.every(isRecord) || !isRecord(membership)) throw new ApiError("UNEXPECTED_RESPONSE");
  const members = membersValue.map((member) => {
    const userId = readString(member, "userId");
    const firstName = readString(member, "firstName");
    const lastName = readString(member, "lastName");
    const email = readString(member, "email");
    const joinedAt = readString(member, "joinedAt");
    if (!userId || firstName === undefined || lastName === undefined || !email || !joinedAt) throw new ApiError("UNEXPECTED_RESPONSE");
    return { userId, firstName, lastName, email, joinedAt };
  });
  const capacity = readNumber(membership, "capacity");
  const activeCount = readNumber(membership, "activeCount");
  const awaitingSecondHolder = readBoolean(membership, "awaitingSecondHolder");
  if (capacity === undefined || activeCount === undefined || awaitingSecondHolder === undefined) throw new ApiError("UNEXPECTED_RESPONSE");
  return { jointAccountId, displayName, createdAt, members, membership: { capacity, activeCount, awaitingSecondHolder } };
}

function normaliseJointInvitations(payload: unknown): JointInvitation[] {
  if (!isRecord(payload) || !Array.isArray(payload.data) || !payload.data.every(isRecord)) throw new ApiError("UNEXPECTED_RESPONSE");
  return payload.data.map((invitation) => {
    const invitationId = readString(invitation, "invitationId");
    const jointAccountId = readString(invitation, "jointAccountId");
    const accountDisplayName = readString(invitation, "accountDisplayName");
    const inviterFirstName = readString(invitation, "inviterFirstName");
    const expiresAt = readString(invitation, "expiresAt");
    const sentAt = readString(invitation, "sentAt");
    if (!invitationId || !jointAccountId || !accountDisplayName || !inviterFirstName || !expiresAt || !sentAt) throw new ApiError("UNEXPECTED_RESPONSE");
    return { invitationId, jointAccountId, accountDisplayName, inviterFirstName, expiresAt, sentAt };
  });
}

function normaliseCreatedJointAccount(payload: unknown): CreatedJointAccount {
  const data = unwrapPayload(payload);
  const jointAccountId = readString(data, "jointAccountId");
  const displayName = readString(data, "displayName");
  const invitation = data.invitation;
  if (!jointAccountId || !displayName || !isRecord(invitation)) throw new ApiError("UNEXPECTED_RESPONSE");
  const invitationId = readString(invitation, "invitationId");
  const invitedEmailMasked = readString(invitation, "invitedEmailMasked");
  const expiresAt = readString(invitation, "expiresAt");
  if (!invitationId || !invitedEmailMasked || !expiresAt || invitation.status !== "PENDING") throw new ApiError("UNEXPECTED_RESPONSE");
  return { jointAccountId, displayName, invitation: { invitationId, invitedEmailMasked, expiresAt, status: "PENDING" } };
}

function normaliseCreatedJointInvitation(payload: unknown): CreatedJointInvitation {
  const data = unwrapPayload(payload);
  const invitationId = readString(data, "invitationId");
  const invitedEmailMasked = readString(data, "invitedEmailMasked");
  const expiresAt = readString(data, "expiresAt");
  if (!invitationId || !invitedEmailMasked || !expiresAt || data.status !== "PENDING") throw new ApiError("UNEXPECTED_RESPONSE");
  return { invitationId, invitedEmailMasked, expiresAt, status: "PENDING" };
}

function normaliseJointInvitationAcceptance(payload: unknown) {
  const data = unwrapPayload(payload);
  const jointAccountId = readString(data, "jointAccountId");
  const joinedAt = readString(data, "joinedAt");
  if (!jointAccountId || !joinedAt) throw new ApiError("UNEXPECTED_RESPONSE");
  return { jointAccountId, joinedAt };
}

function normaliseJointInvitationDecline(payload: unknown) {
  const data = unwrapPayload(payload);
  const invitationId = readString(data, "invitationId");
  if (!invitationId || data.status !== "DECLINED") throw new ApiError("UNEXPECTED_RESPONSE");
  return { invitationId, status: "DECLINED" as const };
}

function jointPathSegment(id: string) {
  return encodeURIComponent(id);
}

function normaliseRegistrationResponse(payload: unknown): RegisterResponse {
  const data = unwrapPayload(payload);
  const userId = readString(data, "userId");
  const verificationId = readString(data, "verificationId");
  // The canonical backend field is `email`; its value is already masked.
  const maskedEmail = readString(data, "email");
  const emailVerified = data.emailVerified;
  const nextAction = readString(data, "nextAction");
  if (!userId || !verificationId || !maskedEmail || emailVerified !== false || nextAction !== "VERIFY_EMAIL") throw new ApiError("UNEXPECTED_RESPONSE");
  return { userId, verificationId, maskedEmail, emailVerified: false, nextAction: "VERIFY_EMAIL" };
}

/** Legacy Individual registration remains unchanged: names are required and no registrationType is sent. */
export async function registerIndividual(input: { firstName: string; lastName: string; email: string; password: string }): Promise<RegisterIndividualResponse> {
  return normaliseRegistrationResponse(await request("/auth/register", { method: "POST", body: input }));
}

/** Corporate applicant registration captures the immutable applicant-company identity required by the approved Corporate Profile workflow. Confirm-password remains frontend-only. */
export async function registerCorporateApplicant(input: { companyName: string; companyPhoneNumber: string; email: string; password: string }): Promise<RegisterCorporateApplicantResponse> {
  const body = {
    registrationType: "CORPORATE" as const,
    companyName: input.companyName,
    companyPhoneNumber: input.companyPhoneNumber,
    email: input.email,
    password: input.password,
  };
  return normaliseRegistrationResponse(await request("/auth/register", { method: "POST", body }));
}

export async function verifyEmail(input: { verificationId: string; code: string }): Promise<EmailVerificationResponse> {
  const data = unwrapPayload(await request("/auth/email/verify", { method: "POST", body: input }));
  const nextAction = readString(data, "nextAction");
  if (nextAction !== "LOGIN") throw new ApiError("UNEXPECTED_RESPONSE");
  return { nextAction: "LOGIN", maskedEmail: readString(data, "email") };
}

export async function resendVerificationEmail(input: { verificationId: string }) {
  const data = unwrapPayload(await request("/auth/email/resend", { method: "POST", body: input }));
  return {
    maskedEmail: readString(data, "email"),
    cooldownSeconds: readNumber(data, "resendInSeconds") ?? readNumber(data, "cooldownSeconds") ?? readNumber(data, "retryAfterSeconds"),
  };
}

/** Existing Investor authentication shared by Individual, Joint, and Corporate applicants. */
export async function loginInvestor(input: { email: string; password: string }) {
  const payload = await request("/auth/login", { method: "POST", body: input });
  const data = unwrapPayload(payload);
  const accessToken = readString(data, "accessToken");
  if (!accessToken) throw new ApiError("UNEXPECTED_RESPONSE");
  try {
    return { accessToken, user: normaliseUser(data) };
  } catch (error) {
    if (isApiError(error) && error.code === "UNEXPECTED_RESPONSE") return { accessToken, user: undefined };
    throw error;
  }
}

/** Compatibility export for pre-Revision-8 callers. It is the same Investor login endpoint. */
export const loginIndividual = loginInvestor;

/** Shares a single refresh-token rotation across concurrent authenticated requests. */
export async function refreshAccessToken() {
  if (refreshInFlight) return refreshInFlight;
  const generationAtStart = authGeneration;
  refreshInFlight = (async () => {
    const data = unwrapPayload(await request("/auth/refresh", { method: "POST", headers: csrfHeaders() }));
    const accessToken = readString(data, "accessToken");
    if (!accessToken || generationAtStart !== authGeneration) throw new ApiError("UNAUTHENTICATED");
    setAccessToken(accessToken);
    return accessToken;
  })();

  try {
    return await refreshInFlight;
  } finally {
    refreshInFlight = null;
  }
}

export async function logoutSession() {
  await request("/auth/logout", { method: "POST", headers: csrfHeaders() });
}

export async function getCurrentUser() {
  return normaliseUser(await authenticatedRequest("/me"));
}

export async function getMyProfile() {
  return normaliseProfile(await authenticatedRequest("/me/profile"));
}

export async function updateMyProfile(input: { firstName: string; lastName: string; phone: string | null }) {
  return normaliseProfile(await authenticatedRequest("/me/profile", { method: "PUT", body: input }));
}

function requireIndividualKycVersion(version: number) {
  if (!Number.isSafeInteger(version) || version < 0) throw new ApiError("VALIDATION_FAILED");
}

/** Load KYC state only for the currently authenticated Investor. No owner ID is accepted. */
export async function getIndividualKycProfile(): Promise<IndividualKycProfile> {
  try {
    return normaliseIndividualKycProfile(await authenticatedRequest("/me/kyc-profile"));
  } catch (error) {
    // A first-time applicant may not have a profile record yet. A missing
    // owner-scoped record starts at version 0; other API failures are not hidden.
    if (isApiError(error) && error.code === "NOT_FOUND") return emptyIndividualKycProfile();
    throw error;
  }
}

export async function saveIndividualKycPersonal(input: SaveIndividualKycPersonalInput): Promise<IndividualKycMutationResult> {
  requireIndividualKycVersion(input.version);
  return normaliseIndividualKycMutationResult(await authenticatedMutation("/me/kyc-profile/personal", input, undefined, "PUT"));
}

export async function saveIndividualKycInvestmentProfile(input: SaveIndividualKycInvestmentProfileInput): Promise<IndividualKycMutationResult> {
  requireIndividualKycVersion(input.version);
  return normaliseIndividualKycMutationResult(await authenticatedMutation("/me/kyc-profile/investment-profile", input, undefined, "PUT"));
}

export async function saveIndividualKycSourceOfFunds(input: SaveIndividualKycSourceOfFundsInput): Promise<IndividualKycMutationResult> {
  requireIndividualKycVersion(input.version);
  return normaliseIndividualKycMutationResult(await authenticatedMutation("/me/kyc-profile/source-of-funds", input, undefined, "PUT"));
}

export async function saveIndividualKycBankDetails(input: SaveIndividualKycBankDetailsInput): Promise<IndividualKycMutationResult> {
  requireIndividualKycVersion(input.version);
  return normaliseIndividualKycMutationResult(await authenticatedMutation("/me/kyc-profile/bank-details", input, undefined, "PUT"));
}

export async function submitIndividualKycProfile(version: number): Promise<IndividualKycSubmissionResult> {
  requireIndividualKycVersion(version);
  return normaliseIndividualKycSubmission(await authenticatedMutation("/me/kyc-profile/submit", { version }));
}

/** The signed upload URL is used with credentials omitted; only the intent/finalize calls use the authenticated API. */
export async function createIndividualKycUploadIntent(input: IndividualKycUploadIntentInput): Promise<IndividualKycUploadIntent> {
  requireIndividualKycVersion(input.version);
  return normaliseIndividualKycUploadIntent(await authenticatedMutation("/me/kyc-profile/id-document/upload-intent", input));
}

export async function completeIndividualKycDocument(documentId: string, version: number): Promise<IndividualKycMutationResult> {
  requireIndividualKycVersion(version);
  if (!documentId.trim()) throw new ApiError("VALIDATION_FAILED");
  return normaliseIndividualKycMutationResult(await authenticatedMutation(`/me/kyc-profile/id-document/${encodeURIComponent(documentId)}/complete`, { version }));
}

/** O2 — feature-gated Corporate DRAFT creation. The six-field body is explicit. */
export async function createCorporateApplication(input: CorporateDraftInput, idempotencyKey: string) {
  const body: CorporateDraftInput = {
    institutionName: input.institutionName,
    dateOfIncorporation: input.dateOfIncorporation,
    rcNumber: input.rcNumber,
    taxIdentificationNumber: input.taxIdentificationNumber,
    businessPhoneNumber: input.businessPhoneNumber,
    businessEmail: input.businessEmail,
  };
  return normaliseCorporateApplicationReceipt(await authenticatedMutation("/corporate-accounts/applications", body, { "Idempotency-Key": idempotencyKey }));
}

/** Owner-scoped discovery for the authenticated initiating applicant; empty is normal. */
export async function getMyCorporateApplications() {
  return normaliseCorporateDiscovery(await authenticatedRequest("/me/corporate-accounts"));
}

/** O3 — owner-scoped onboarding read. The account ID must originate from O2 or discovery. */
export async function getCorporateOnboarding(corporateAccountId: string) {
  return normaliseCorporateOnboarding(await authenticatedRequest(`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/onboarding`));
}

/** O4 — optimistic DRAFT/INFO_REQUESTED amendment with the mandatory quoted details version. */
export async function updateCorporateDraft(corporateAccountId: string, detailsVersion: number, patch: CorporateDraftPatch) {
  if (!Number.isSafeInteger(detailsVersion) || detailsVersion < 1) throw new ApiError("VALIDATION_FAILED");
  const body: CorporateDraftPatch = {};
  for (const field of corporateEditableFieldNames) {
    const value = patch[field];
    if (value !== undefined) body[field] = value;
  }
  if (Object.keys(body).length === 0) throw new ApiError("VALIDATION_FAILED");
  return normaliseCorporateDraftUpdate(await authenticatedMutation(`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/onboarding/draft`, body, { "If-Match": `"${detailsVersion}"` }, "PATCH"));
}

/** O11 — owner-scoped permitted lifecycle and safe amendment metadata. */
export async function getCorporateOnboardingHistory(corporateAccountId: string) {
  return normaliseCorporateHistory(await authenticatedRequest(`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/onboarding/history`));
}

/** Read-only technical snapshot freshness; no snapshot regeneration is called by this UI. */
export async function getCorporateSnapshotFreshness(corporateAccountId: string) {
  return normaliseCorporateSnapshotFreshness(await authenticatedRequest(`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/onboarding/verification-snapshot/freshness`));
}

/** Corporate Profile read. The account ID must originate from owner-scoped discovery. */
export async function getCorporateProfile(corporateAccountId: string) {
  return normaliseCorporateProfile(await authenticatedRequest(`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/profile`));
}

/** Section 1 — If-Match "profile-N;details-M". The TIN is sent only when explicitly entered. */
export async function saveCorporateProfileCompanyDetails(corporateAccountId: string, versions: { profileVersion: number; detailsVersion: number }, input: CorporateProfileCompanyDetailsInput) {
  const tin = input.taxIdentificationNumber?.trim();
  const body: CorporateProfileCompanyDetailsInput = {
    rcNumber: input.rcNumber,
    dateOfIncorporation: input.dateOfIncorporation,
    ...(tin ? { taxIdentificationNumber: tin } : {}),
    registeredAddress: input.registeredAddress,
    city: input.city,
    state: input.state,
  };
  return normaliseCorporateProfile(await authenticatedMutation(`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/profile/company-details`, body, corporateProfileVersionHeader(versions.profileVersion, versions.detailsVersion), "PATCH"));
}

/** Section 2 — If-Match "profile-N". */
export async function saveCorporateProfileInvestmentProfile(corporateAccountId: string, profileVersion: number, input: CorporateProfileInvestmentInput) {
  const body: CorporateProfileInvestmentInput = {
    primaryObjective: input.primaryObjective,
    riskTolerance: input.riskTolerance,
    investmentHorizon: input.investmentHorizon,
    expectedWithdrawals: input.expectedWithdrawals,
    withdrawalFrequency: input.withdrawalFrequency,
    ...(input.restrictionsOrExclusions?.trim() ? { restrictionsOrExclusions: input.restrictionsOrExclusions } : {}),
  };
  return normaliseCorporateProfile(await authenticatedMutation(`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/profile/investment-profile`, body, corporateProfileVersionHeader(profileVersion), "PATCH"));
}

/** Section 3 — If-Match "profile-N". */
export async function saveCorporateProfileSourceOfFunds(corporateAccountId: string, profileVersion: number, input: CorporateProfileSourceOfFundsInput) {
  const body: CorporateProfileSourceOfFundsInput = {
    selectedSources: [...input.selectedSources],
    ...(input.selectedSources.includes("Other (specify)") && input.otherSource?.trim() ? { otherSource: input.otherSource } : {}),
    expectedAnnualInflow: input.expectedAnnualInflow,
    expectedTransactionFrequency: input.expectedTransactionFrequency,
  };
  return normaliseCorporateProfile(await authenticatedMutation(`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/profile/source-of-funds`, body, corporateProfileVersionHeader(profileVersion), "PATCH"));
}

/** Section 4 — If-Match "profile-N". The account number exists only in this request body. */
export async function saveCorporateProfileBankDetails(corporateAccountId: string, profileVersion: number, input: CorporateProfileBankDetailsInput) {
  const body: CorporateProfileBankDetailsInput = {
    bankName: input.bankName,
    accountNumber: input.accountNumber,
    accountName: input.accountName,
    accountType: input.accountType,
    bvnLinkedToAccount: input.bvnLinkedToAccount,
  };
  return normaliseCorporateProfile(await authenticatedMutation(`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/profile/bank-details`, body, corporateProfileVersionHeader(profileVersion), "PATCH"));
}

/** One-time completion of missing legacy Corporate applicant display identity. */
export async function completeCorporateApplicantIdentity(input: CorporateApplicantIdentityInput) {
  return normaliseCorporateApplicantIdentity(await authenticatedMutation("/me/corporate-applicant-profile", { companyName: input.companyName, companyPhoneNumber: input.companyPhoneNumber }, undefined, "PATCH"));
}

/** Corporate KYC section 5 — exactly three approved mandatory documents. */
export type CorporateKycDocumentCategory = "CERTIFICATE_OF_INCORPORATION" | "MEMART" | "TIN_CERTIFICATE";

export type CorporateKycDocument = {
  documentId: string;
  version: number;
  contentType: "application/pdf" | "image/jpeg" | "image/png";
  sizeBytes: number;
  displayFilename: string;
  uploadedAt: string;
  scanStatus: "NOT_SCANNED";
  reviewStatus: "NOT_SUBMITTED" | "AWAITING_REVIEW" | "UNDER_REVIEW" | "INFORMATION_REQUESTED" | "REVIEW_COMPLETED";
};

export type CorporateKycRequirement = {
  category: CorporateKycDocumentCategory;
  title: string;
  description: string;
  mandatory: true;
  acceptedContentTypes: string[];
  acceptedExtensions: string[];
  maxSizeBytes: number;
  uploadStatus: "NOT_UPLOADED" | "UPLOADED";
  canUpload: boolean;
  canReplace: boolean;
  blockedReason: "APPLICATION_NOT_EDITABLE" | null;
  currentDocument: CorporateKycDocument | null;
};

export type CorporateSubmissionBlocker = {
  kind: "APPLICATION_STATE" | "PROFILE_SECTION" | "DOCUMENT";
  key: string;
};

export type CorporateKycDocumentsData = {
  corporateAccountId: string;
  applicationId: string;
  applicationStatus: CorporateApplicationState;
  section: {
    key: "kycDocuments";
    order: 5;
    status: "NOT_STARTED" | "DRAFT" | "COMPLETE";
    uploadedCount: number;
    requiredCount: 3;
  };
  limits: {
    acceptedContentTypes: string[];
    acceptedExtensions: string[];
    maxSizeBytes: number;
  };
  requirements: CorporateKycRequirement[];
  submission: {
    canSubmit: boolean;
    blockers: CorporateSubmissionBlocker[];
    submissionId: string | null;
    submittedAt: string | null;
  };
};

export type CorporateKycViewAuthorization = {
  documentId: string;
  category: CorporateKycDocumentCategory;
  version: number;
  viewUrl: string;
  expiresAt: string;
  disposition: "attachment";
};

export type CorporateSubmissionReceipt = {
  submissionId: string;
  applicationId: string;
  corporateAccountId: string;
  applicationStatus: CorporateApplicationState;
  submittedAt: string;
  profileVersion: number;
  detailsVersion: number;
  documents: Array<{ category: CorporateKycDocumentCategory; documentId: string }>;
  idempotentReplay: boolean;
};

const corporateKycDocumentCategories: readonly CorporateKycDocumentCategory[] = ["CERTIFICATE_OF_INCORPORATION", "MEMART", "TIN_CERTIFICATE"];

function isCorporateKycDocumentCategory(value: unknown): value is CorporateKycDocumentCategory {
  return typeof value === "string" && (corporateKycDocumentCategories as readonly string[]).includes(value);
}

function readStringArray(record: JsonRecord, key: string): string[] | undefined {
  const value = record[key];
  return Array.isArray(value) && value.every((item) => typeof item === "string") ? [...value] as string[] : undefined;
}

function normaliseCorporateKycDocument(value: unknown): CorporateKycDocument | undefined {
  if (!isRecord(value)) return undefined;
  const documentId = readString(value, "documentId");
  const version = readNumber(value, "version");
  const contentType = readString(value, "contentType");
  const sizeBytes = readNumber(value, "sizeBytes");
  const displayFilename = readString(value, "displayFilename");
  const uploadedAt = readString(value, "uploadedAt");
  const scanStatus = readString(value, "scanStatus");
  const reviewStatus = readString(value, "reviewStatus");
  if (!documentId || version === undefined || version < 1 || (contentType !== "application/pdf" && contentType !== "image/jpeg" && contentType !== "image/png") || sizeBytes === undefined || sizeBytes < 1 || !displayFilename || !uploadedAt || scanStatus !== "NOT_SCANNED" || (reviewStatus !== "NOT_SUBMITTED" && reviewStatus !== "AWAITING_REVIEW" && reviewStatus !== "UNDER_REVIEW" && reviewStatus !== "INFORMATION_REQUESTED" && reviewStatus !== "REVIEW_COMPLETED")) return undefined;
  return { documentId, version, contentType, sizeBytes, displayFilename, uploadedAt, scanStatus, reviewStatus };
}

function normaliseCorporateKycRequirement(value: unknown): CorporateKycRequirement | undefined {
  if (!isRecord(value)) return undefined;
  const category = value.category;
  const title = readString(value, "title");
  const description = readString(value, "description");
  const mandatory = readBoolean(value, "mandatory");
  const acceptedContentTypes = readStringArray(value, "acceptedContentTypes");
  const acceptedExtensions = readStringArray(value, "acceptedExtensions");
  const maxSizeBytes = readNumber(value, "maxSizeBytes");
  const uploadStatus = readString(value, "uploadStatus");
  const canUpload = readBoolean(value, "canUpload");
  const canReplace = readBoolean(value, "canReplace");
  const blockedReason = value.blockedReason;
  const currentDocumentValue = value.currentDocument;
  const currentDocument = currentDocumentValue === null ? null : normaliseCorporateKycDocument(currentDocumentValue);
  if (!isCorporateKycDocumentCategory(category) || !title || description === undefined || mandatory !== true || !acceptedContentTypes || !acceptedExtensions || maxSizeBytes === undefined || (uploadStatus !== "NOT_UPLOADED" && uploadStatus !== "UPLOADED") || canUpload === undefined || canReplace === undefined || (blockedReason !== null && blockedReason !== "APPLICATION_NOT_EDITABLE") || currentDocument === undefined) return undefined;
  return { category, title, description, mandatory: true, acceptedContentTypes, acceptedExtensions, maxSizeBytes, uploadStatus, canUpload, canReplace, blockedReason: blockedReason as CorporateKycRequirement["blockedReason"], currentDocument };
}

function normaliseCorporateSubmissionBlocker(value: unknown): CorporateSubmissionBlocker | undefined {
  if (!isRecord(value)) return undefined;
  const kind = readString(value, "kind");
  const key = readString(value, "key");
  if ((kind !== "APPLICATION_STATE" && kind !== "PROFILE_SECTION" && kind !== "DOCUMENT") || !key) return undefined;
  return { kind, key };
}

function normaliseCorporateKycDocuments(payload: unknown): CorporateKycDocumentsData {
  const data = unwrapPayload(payload);
  const corporateAccountId = readString(data, "corporateAccountId");
  const applicationId = readString(data, "applicationId");
  const applicationStatus = data.applicationStatus;
  const sectionValue = isRecord(data.section) ? data.section : undefined;
  const limitsValue = isRecord(data.limits) ? data.limits : undefined;
  const requirementsValue = data.requirements;
  const submissionValue = isRecord(data.submission) ? data.submission : undefined;
  if (!corporateAccountId || !applicationId || !isCorporateApplicationState(applicationStatus) || !sectionValue || !limitsValue || !Array.isArray(requirementsValue) || !submissionValue) throw new ApiError("UNEXPECTED_RESPONSE");
  if (sectionValue.key !== "kycDocuments" || sectionValue.order !== 5 || (sectionValue.status !== "NOT_STARTED" && sectionValue.status !== "DRAFT" && sectionValue.status !== "COMPLETE") || typeof sectionValue.uploadedCount !== "number" || sectionValue.requiredCount !== 3) throw new ApiError("UNEXPECTED_RESPONSE");
  const acceptedContentTypes = readStringArray(limitsValue, "acceptedContentTypes");
  const acceptedExtensions = readStringArray(limitsValue, "acceptedExtensions");
  const maxSizeBytes = readNumber(limitsValue, "maxSizeBytes");
  if (!acceptedContentTypes || !acceptedExtensions || maxSizeBytes === undefined) throw new ApiError("UNEXPECTED_RESPONSE");
  const requirements = requirementsValue.map(normaliseCorporateKycRequirement);
  if (requirements.length !== 3 || requirements.some((item) => item === undefined)) throw new ApiError("UNEXPECTED_RESPONSE");
  const canSubmit = readBoolean(submissionValue, "canSubmit");
  const blockersValue = submissionValue.blockers;
  const submissionId = submissionValue.submissionId;
  const submittedAt = submissionValue.submittedAt;
  if (canSubmit === undefined || !Array.isArray(blockersValue) || (submissionId !== null && typeof submissionId !== "string") || (submittedAt !== null && typeof submittedAt !== "string")) throw new ApiError("UNEXPECTED_RESPONSE");
  const blockers = blockersValue.map(normaliseCorporateSubmissionBlocker);
  if (blockers.some((item) => item === undefined)) throw new ApiError("UNEXPECTED_RESPONSE");
  return {
    corporateAccountId,
    applicationId,
    applicationStatus,
    section: { key: "kycDocuments", order: 5, status: sectionValue.status as CorporateKycDocumentsData["section"]["status"], uploadedCount: sectionValue.uploadedCount as number, requiredCount: 3 },
    limits: { acceptedContentTypes, acceptedExtensions, maxSizeBytes },
    requirements: requirements as CorporateKycRequirement[],
    submission: { canSubmit, blockers: blockers as CorporateSubmissionBlocker[], submissionId: submissionId as string | null, submittedAt: submittedAt as string | null },
  };
}

function normaliseCorporateKycViewAuthorization(payload: unknown): CorporateKycViewAuthorization {
  const data = unwrapPayload(payload);
  const documentId = readString(data, "documentId");
  const category = data.category;
  const version = readNumber(data, "version");
  const viewUrl = readString(data, "viewUrl");
  const expiresAt = readString(data, "expiresAt");
  const disposition = readString(data, "disposition");
  if (!documentId || !isCorporateKycDocumentCategory(category) || version === undefined || !viewUrl || !expiresAt || disposition !== "attachment") throw new ApiError("UNEXPECTED_RESPONSE");
  return { documentId, category, version, viewUrl, expiresAt, disposition };
}

function normaliseCorporateSubmission(payload: unknown): CorporateSubmissionReceipt {
  const data = unwrapPayload(payload);
  const submissionId = readString(data, "submissionId");
  const applicationId = readString(data, "applicationId");
  const corporateAccountId = readString(data, "corporateAccountId");
  const applicationStatus = data.applicationStatus;
  const submittedAt = readString(data, "submittedAt");
  const profileVersion = readNumber(data, "profileVersion");
  const detailsVersion = readNumber(data, "detailsVersion");
  const documentsValue = data.documents;
  const idempotentReplay = readBoolean(data, "idempotentReplay");
  if (!submissionId || !applicationId || !corporateAccountId || !isCorporateApplicationState(applicationStatus) || !submittedAt || profileVersion === undefined || detailsVersion === undefined || !Array.isArray(documentsValue) || idempotentReplay === undefined) throw new ApiError("UNEXPECTED_RESPONSE");
  const documents = documentsValue.map((entry) => {
    if (!isRecord(entry) || !isCorporateKycDocumentCategory(entry.category)) return undefined;
    const documentId = readString(entry, "documentId");
    return documentId ? { category: entry.category, documentId } : undefined;
  });
  if (documents.length !== 3 || documents.some((item) => item === undefined)) throw new ApiError("UNEXPECTED_RESPONSE");
  return { submissionId, applicationId, corporateAccountId, applicationStatus, submittedAt, profileVersion, detailsVersion, documents: documents as CorporateSubmissionReceipt["documents"], idempotentReplay };
}

/** Corporate KYC section 5 — authoritative requirements, uploads and submission readiness. */
export async function getCorporateKycDocuments(corporateAccountId: string) {
  return normaliseCorporateKycDocuments(await authenticatedRequest(`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/kyc-documents`));
}

/**
 * Upload (or explicitly replace) one of the three mandatory Corporate KYC
 * documents. The browser sets the multipart boundary; Content-Type is never
 * set manually. Replacement requires the current documentId.
 */
export async function uploadCorporateKycDocument(corporateAccountId: string, category: CorporateKycDocumentCategory, file: File, replacesDocumentId?: string) {
  if (!isCorporateKycDocumentCategory(category)) throw new ApiError("VALIDATION_FAILED");
  const formData = new FormData();
  formData.append("file", file);
  if (replacesDocumentId !== undefined) formData.append("replacesDocumentId", replacesDocumentId);
  return normaliseCorporateKycDocuments(await authenticatedRequest(`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/kyc-documents/${category}`, {
    method: "POST",
    rawBody: formData,
    attemptHeaders: csrfHeaders,
  }));
}

/** Short-lived, version-pinned view grant. The URL must be used immediately and never stored. */
export async function authorizeCorporateKycDocumentView(corporateAccountId: string, documentId: string) {
  return normaliseCorporateKycViewAuthorization(await authenticatedMutation(`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/kyc-documents/${encodeURIComponent(documentId)}/view-authorization`));
}

/** Submit the Corporate application for Starfetch review (DRAFT → SUBMITTED). */
export async function submitCorporateApplication(corporateAccountId: string, idempotencyKey: string) {
  return normaliseCorporateSubmission(await authenticatedMutation(`/corporate-accounts/${corporateAccountPathSegment(corporateAccountId)}/submission`, undefined, { "Idempotency-Key": idempotencyKey }));
}

export async function getMyPortfolio() {
  return normalisePortfolio(await authenticatedRequest("/me/portfolio"));
}

export async function getMyTransactions(page = 1, pageSize = 5) {
  return normaliseTransactions(await authenticatedRequest(`/me/transactions?page=${page}&pageSize=${pageSize}`));
}

/** R1 — active memberships for the authenticated Investor only. */
export async function getMyJointAccounts() {
  return normaliseJointAccounts(await authenticatedRequest("/me/joint-accounts"));
}

/** R2 — account detail. The server verifies membership; callers must use an ID from R1. */
export async function getJointAccount(jointAccountId: string) {
  return normaliseJointAccountDetail(await authenticatedRequest(`/joint-accounts/${jointPathSegment(jointAccountId)}`));
}

/** R3 prepared for Phase 4B; no joint financial UI consumes it in Phase 4A. */
export async function getJointPortfolio(jointAccountId: string) {
  return normalisePortfolio(await authenticatedRequest(`/joint-accounts/${jointPathSegment(jointAccountId)}/portfolio`));
}

/** R4 prepared for Phase 4B; no joint financial UI consumes it in Phase 4A. */
export async function getJointTransactions(jointAccountId: string, page = 1, pageSize = 10) {
  return normaliseTransactions(await authenticatedRequest(`/joint-accounts/${jointPathSegment(jointAccountId)}/transactions?page=${page}&pageSize=${pageSize}`));
}

/** M1 — create an account with one ACTIVE holder and one PENDING invitation. */
export async function createJointAccount(input: { inviteeEmail: string; displayName?: string }) {
  const body = input.displayName ? { inviteeEmail: input.inviteeEmail, displayName: input.displayName } : { inviteeEmail: input.inviteeEmail };
  return normaliseCreatedJointAccount(await authenticatedMutation("/joint-accounts", body));
}

/** M2 — send or safely replace the invitation for an awaiting-second-holder account. */
export async function createJointInvitation(jointAccountId: string, email: string) {
  return normaliseCreatedJointInvitation(await authenticatedMutation(`/joint-accounts/${jointPathSegment(jointAccountId)}/invitations`, { email }));
}

/** M3 — current user's pending, unexpired invitation inbox. */
export async function getMyJointInvitations() {
  return normaliseJointInvitations(await authenticatedRequest("/me/joint-invitations"));
}

/** M4 — explicit consent; backend makes an authorized retry idempotent. */
export async function acceptJointInvitation(invitationId: string) {
  return normaliseJointInvitationAcceptance(await authenticatedMutation(`/me/joint-invitations/${jointPathSegment(invitationId)}/accept`));
}

/** M5 — explicit decline; backend makes a same-recipient retry idempotent. */
export async function declineJointInvitation(invitationId: string) {
  return normaliseJointInvitationDecline(await authenticatedMutation(`/me/joint-invitations/${jointPathSegment(invitationId)}/decline`));
}
