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
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE";

type JsonRecord = Record<string, unknown>;

type ApiErrorMetadata = {
  verificationId?: string;
  maskedEmail?: string;
  retryAfterSeconds?: number;
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

  constructor(code: ApiErrorCode, metadata: ApiErrorMetadata = {}) {
    super(safeMessages[code]);
    this.name = "ApiError";
    this.code = code;
    this.verificationId = metadata.verificationId;
    this.maskedEmail = metadata.maskedEmail;
    this.retryAfterSeconds = metadata.retryAfterSeconds;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export function getSafeErrorMessage(error: unknown) {
  return isApiError(error) ? error.message : safeMessages.UNEXPECTED_RESPONSE;
}

export type AuthUser = {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  emailVerified?: boolean;
};

export type IndividualAccountProfile = {
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
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

export type RegisterIndividualResponse = {
  userId: string;
  verificationId: string;
  maskedEmail: string;
  emailVerified: false;
  nextAction: "VERIFY_EMAIL";
};

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

  return new ApiError(toKnownErrorCode(readString(errorRecord, "code") ?? readString(root, "code"), response.status), {
    verificationId: readString(context, "verificationId") ?? readString(errorRecord, "verificationId") ?? readString(rootData, "verificationId") ?? readString(root, "verificationId"),
    maskedEmail: readString(context, "email"),
    retryAfterSeconds,
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
  method?: "GET" | "POST" | "PUT";
  body?: unknown;
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
        ...(options.body !== undefined ? { "Content-Type": "application/json" } : {}),
        ...options.headers,
      },
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
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
async function authenticatedMutation(path: string, body?: unknown) {
  return authenticatedRequest(path, {
    method: "POST",
    body,
    attemptHeaders: csrfHeaders,
  });
}

function normaliseUser(payload: unknown): AuthUser {
  const data = unwrapPayload(payload);
  const user = isRecord(data.user) ? data.user : data;
  const id = readString(user, "id") ?? readString(user, "userId");
  const firstName = readString(user, "firstName");
  const lastName = readString(user, "lastName");
  const email = readString(user, "email");
  if (!id || !firstName || !lastName || !email) throw new ApiError("UNEXPECTED_RESPONSE");
  return {
    id,
    firstName,
    lastName,
    email,
    emailVerified: typeof user.emailVerified === "boolean" ? user.emailVerified : undefined,
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

export async function registerIndividual(input: { firstName: string; lastName: string; email: string; password: string }): Promise<RegisterIndividualResponse> {
  const data = unwrapPayload(await request("/auth/register", { method: "POST", body: input }));
  const userId = readString(data, "userId");
  const verificationId = readString(data, "verificationId");
  // The canonical backend field is `email`; its value is already masked.
  const maskedEmail = readString(data, "email");
  const emailVerified = data.emailVerified;
  const nextAction = readString(data, "nextAction");
  if (!userId || !verificationId || !maskedEmail || emailVerified !== false || nextAction !== "VERIFY_EMAIL") throw new ApiError("UNEXPECTED_RESPONSE");
  return { userId, verificationId, maskedEmail, emailVerified: false, nextAction: "VERIFY_EMAIL" };
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

export async function loginIndividual(input: { email: string; password: string }) {
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
