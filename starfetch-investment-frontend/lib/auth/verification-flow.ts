"use client";

const pendingVerificationKey = "starfetch_pending_email_verification";
const verifiedEmailKey = "starfetch_verified_email";

/** Routing/presentation state only — never an authenticated session, credential, or authorisation signal. */
export type RegistrationJourney = "INDIVIDUAL" | "CORPORATE";

type PendingVerification = {
  verificationId: string;
  maskedEmail: string;
  registrationType: RegistrationJourney;
};

type VerifiedEmail = {
  maskedEmail: string;
  registrationType: RegistrationJourney;
};

function hasSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

function isRegistrationJourney(value: unknown): value is RegistrationJourney {
  return value === "INDIVIDUAL" || value === "CORPORATE";
}

/** verificationId is routing state, not an authentication credential. */
export function setPendingVerification(value: Omit<PendingVerification, "registrationType"> & { registrationType?: RegistrationJourney }) {
  if (!hasSessionStorage()) return;
  const pending: PendingVerification = { ...value, registrationType: value.registrationType ?? "INDIVIDUAL" };
  window.sessionStorage.setItem(pendingVerificationKey, JSON.stringify(pending));
}

export function getPendingVerification(): PendingVerification | null {
  if (!hasSessionStorage()) return null;
  const raw = window.sessionStorage.getItem(pendingVerificationKey);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value !== "object" || value === null || Array.isArray(value)) return null;
    const record = value as Record<string, unknown>;
    if (typeof record.verificationId !== "string" || typeof record.maskedEmail !== "string") return null;
    // Existing in-progress Individual registrations stored before Revision 8
    // intentionally remain valid as the legacy Individual path.
    return { verificationId: record.verificationId, maskedEmail: record.maskedEmail, registrationType: isRegistrationJourney(record.registrationType) ? record.registrationType : "INDIVIDUAL" };
  } catch {
    return null;
  }
}

export function markVerificationSucceeded(maskedEmail: string, registrationType: RegistrationJourney = "INDIVIDUAL") {
  if (!hasSessionStorage()) return;
  window.sessionStorage.removeItem(pendingVerificationKey);
  window.sessionStorage.setItem(verifiedEmailKey, JSON.stringify({ maskedEmail, registrationType } satisfies VerifiedEmail));
}

export function getVerifiedEmail() {
  if (!hasSessionStorage()) return null;
  const raw = window.sessionStorage.getItem(verifiedEmailKey);
  if (!raw) return null;
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const record = value as Record<string, unknown>;
      if (typeof record.maskedEmail === "string") return record.maskedEmail;
    }
  } catch {
    // Backward compatibility with the old plain masked-email session value.
  }
  return raw;
}

export function getVerifiedRegistrationType(): RegistrationJourney {
  if (!hasSessionStorage()) return "INDIVIDUAL";
  const raw = window.sessionStorage.getItem(verifiedEmailKey);
  if (!raw) return "INDIVIDUAL";
  try {
    const value: unknown = JSON.parse(raw);
    if (typeof value === "object" && value !== null && !Array.isArray(value)) {
      const registrationType = (value as Record<string, unknown>).registrationType;
      if (isRegistrationJourney(registrationType)) return registrationType;
    }
  } catch {
    // Legacy value means Individual journey.
  }
  return "INDIVIDUAL";
}

export function clearVerificationFlow() {
  if (!hasSessionStorage()) return;
  window.sessionStorage.removeItem(pendingVerificationKey);
  window.sessionStorage.removeItem(verifiedEmailKey);
}
