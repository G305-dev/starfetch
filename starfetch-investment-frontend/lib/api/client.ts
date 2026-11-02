export type ApiErrorCode =
  | "VALIDATION_FAILED"
  | "INVALID_CREDENTIALS"
  | "EMAIL_NOT_VERIFIED"
  | "UNAUTHENTICATED"
  | "FORBIDDEN"
  | "CONFLICT"
  | "RATE_LIMITED"
  | "NETWORK_ERROR"
  | "UNEXPECTED_RESPONSE";

type JsonRecord = Record<string, unknown>;

type ApiErrorMetadata = {
  verificationId?: string;
  retryAfterSeconds?: number;
};

const safeMessages: Record<ApiErrorCode, string> = {
  VALIDATION_FAILED: "Please review the highlighted information and try again.",
  INVALID_CREDENTIALS: "The email address or password you entered is incorrect.",
  EMAIL_NOT_VERIFIED: "Please verify your email address before signing in.",
  UNAUTHENTICATED: "Your session has ended. Please sign in again.",
  FORBIDDEN: "You do not have permission to perform this action.",
  CONFLICT: "An account with these details already exists.",
  RATE_LIMITED: "Too many requests were made. Please wait a moment and try again.",
  NETWORK_ERROR: "We could not reach Starfetch securely. Please check your connection and try again.",
  UNEXPECTED_RESPONSE: "We could not complete your request. Please try again.",
};

/**
 * Deliberately module-scoped, in-memory access-token storage. It is never
 * written to localStorage, sessionStorage, or a frontend-controlled cookie.
 */
let inMemoryAccessToken: string | null = null;

export function setAccessToken(accessToken: string) {
  inMemoryAccessToken = accessToken;
}

export function clearAccessToken() {
  inMemoryAccessToken = null;
}

export function hasAccessToken() {
  return Boolean(inMemoryAccessToken);
}

export class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly verificationId?: string;
  readonly retryAfterSeconds?: number;

  constructor(code: ApiErrorCode, metadata: ApiErrorMetadata = {}) {
    super(safeMessages[code]);
    this.name = "ApiError";
    this.code = code;
    this.verificationId = metadata.verificationId;
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
  phone: string;
};

export type RegisterIndividualResponse = {
  userId: string;
  verificationId: string;
  maskedEmail: string;
  emailVerified: false;
  nextAction: "VERIFY_EMAIL";
};

export type EmailVerificationResponse = {
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
  if (status === 409) return "CONFLICT";
  if (status === 429) return "RATE_LIMITED";
  return "UNEXPECTED_RESPONSE";
}

function errorFromResponse(response: Response, payload: unknown) {
  const root = isRecord(payload) ? payload : {};
  const rootData = isRecord(root.data) ? root.data : {};
  const errorRecord = extractErrorRecord(payload);
  const nestedDetails = isRecord(errorRecord.details) ? errorRecord.details : {};
  const retryAfterHeader = Number(response.headers.get("Retry-After"));
  const retryAfterSeconds = Number.isFinite(retryAfterHeader) && retryAfterHeader > 0
    ? retryAfterHeader
    : readNumber(errorRecord, "retryAfterSeconds") ?? readNumber(errorRecord, "retryAfter") ?? readNumber(nestedDetails, "retryAfterSeconds") ?? readNumber(rootData, "retryAfterSeconds");

  return new ApiError(toKnownErrorCode(readString(errorRecord, "code") ?? readString(root, "code"), response.status), {
    verificationId: readString(errorRecord, "verificationId") ?? readString(nestedDetails, "verificationId") ?? readString(rootData, "verificationId") ?? readString(root, "verificationId"),
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

/** All browser requests use the same-origin /api/v1 Next.js rewrite. */
async function request(path: string, options: RequestOptions = {}) {
  try {
    const response = await fetch(`/api/v1${path}`, {
      method: options.method ?? "GET",
      credentials: "include",
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
  const csrfCookie = document.cookie.split(";").map((value) => value.trim()).find((value) => value.startsWith("sf_csrf="));
  if (!csrfCookie) return undefined;
  return decodeURIComponent(csrfCookie.slice("sf_csrf=".length));
}

function csrfHeaders(): Record<string, string> {
  const csrfToken = readCsrfToken();
  return csrfToken ? { "X-CSRF-Token": csrfToken } : {};
}

function authorizationHeaders() {
  if (!inMemoryAccessToken) throw new ApiError("UNAUTHENTICATED");
  return { Authorization: `Bearer ${inMemoryAccessToken}` };
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
  const phone = typeof phoneValue === "string" ? phoneValue : "";
  if (!firstName || !lastName || !email) throw new ApiError("UNEXPECTED_RESPONSE");
  return { firstName, lastName, email, phone };
}

export async function registerIndividual(input: { firstName: string; lastName: string; email: string; password: string }): Promise<RegisterIndividualResponse> {
  const data = unwrapPayload(await request("/auth/register", { method: "POST", body: input }));
  const userId = readString(data, "userId");
  const verificationId = readString(data, "verificationId");
  const maskedEmail = readString(data, "maskedEmail");
  const emailVerified = data.emailVerified;
  const nextAction = readString(data, "nextAction");
  if (!userId || !verificationId || !maskedEmail || emailVerified !== false || nextAction !== "VERIFY_EMAIL") throw new ApiError("UNEXPECTED_RESPONSE");
  return { userId, verificationId, maskedEmail, emailVerified: false, nextAction: "VERIFY_EMAIL" };
}

export async function verifyEmail(input: { verificationId: string; code: string }): Promise<EmailVerificationResponse> {
  const data = unwrapPayload(await request("/auth/email/verify", { method: "POST", body: input }));
  return { maskedEmail: readString(data, "maskedEmail") };
}

export async function resendVerificationEmail(input: { verificationId: string }) {
  const data = unwrapPayload(await request("/auth/email/resend", { method: "POST", body: input }));
  return {
    maskedEmail: readString(data, "maskedEmail"),
    cooldownSeconds: readNumber(data, "cooldownSeconds") ?? readNumber(data, "retryAfterSeconds"),
  };
}

export async function loginIndividual(input: { email: string; password: string }) {
  const payload = await request("/auth/login", { method: "POST", body: input });
  const data = unwrapPayload(payload);
  const accessToken = readString(data, "accessToken");
  if (!accessToken) throw new ApiError("UNEXPECTED_RESPONSE");
  setAccessToken(accessToken);
  try {
    return { accessToken, user: normaliseUser(data) };
  } catch (error) {
    if (isApiError(error) && error.code === "UNEXPECTED_RESPONSE") return { accessToken, user: undefined };
    throw error;
  }
}

export async function refreshAccessToken() {
  const data = unwrapPayload(await request("/auth/refresh", { method: "POST", headers: csrfHeaders() }));
  const accessToken = readString(data, "accessToken");
  if (!accessToken) throw new ApiError("UNAUTHENTICATED");
  setAccessToken(accessToken);
  return accessToken;
}

export async function logoutSession() {
  await request("/auth/logout", { method: "POST", headers: csrfHeaders() });
}

export async function getCurrentUser() {
  return normaliseUser(await request("/me", { headers: authorizationHeaders() }));
}

export async function getMyProfile() {
  return normaliseProfile(await request("/me/profile", { headers: authorizationHeaders() }));
}

export async function updateMyProfile(input: { firstName: string; lastName: string; phone: string }) {
  return normaliseProfile(await request("/me/profile", { method: "PUT", body: input, headers: authorizationHeaders() }));
}
