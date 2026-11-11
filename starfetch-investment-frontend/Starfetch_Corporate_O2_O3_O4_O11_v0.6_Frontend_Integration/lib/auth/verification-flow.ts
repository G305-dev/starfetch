"use client";

const pendingVerificationKey = "starfetch_pending_email_verification";
const verifiedEmailKey = "starfetch_verified_email";

type PendingVerification = {
  verificationId: string;
  maskedEmail: string;
};

function hasSessionStorage() {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

/** verificationId is routing state, not an authentication credential. */
export function setPendingVerification(value: PendingVerification) {
  if (!hasSessionStorage()) return;
  window.sessionStorage.setItem(pendingVerificationKey, JSON.stringify(value));
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
    return { verificationId: record.verificationId, maskedEmail: record.maskedEmail };
  } catch {
    return null;
  }
}

export function markVerificationSucceeded(maskedEmail: string) {
  if (!hasSessionStorage()) return;
  window.sessionStorage.removeItem(pendingVerificationKey);
  window.sessionStorage.setItem(verifiedEmailKey, maskedEmail);
}

export function getVerifiedEmail() {
  if (!hasSessionStorage()) return null;
  return window.sessionStorage.getItem(verifiedEmailKey);
}

export function clearVerificationFlow() {
  if (!hasSessionStorage()) return;
  window.sessionStorage.removeItem(pendingVerificationKey);
  window.sessionStorage.removeItem(verifiedEmailKey);
}
